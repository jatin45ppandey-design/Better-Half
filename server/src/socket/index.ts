import type http from 'node:http';
import { Server } from 'socket.io';
import { isOriginAllowed } from '../config/cors.js';
import { socketAuthMiddleware } from './authMiddleware.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerGameHandlers } from './gameHandlers.js';
import { setRealtimeServer } from './realtime.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types.js';

export function createSocketServer(httpServer: http.Server) {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS origin "${origin}" not allowed`), false);
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    maxHttpBufferSize: 1e5, // 100 KB payload limit to prevent buffer exhaustion
  });

  setRealtimeServer(io);

  const MAX_CONNECTIONS = 5000;
  io.use((socket, next) => {
    if (io.engine.clientsCount > MAX_CONNECTIONS) {
      return next(new Error('Real-time server capacity reached. Please retry shortly.'));
    }
    next();
  });

  // Supabase Auth verification handshake
  io.use(socketAuthMiddleware);

  // Per-socket and account-level event frequency tracking
  const socketRateMap = new Map<string, { count: number; resetAt: number }>();
  const userRateMap = new Map<string, { count: number; resetAt: number }>();
  const userSocketsMap = new Map<string, Set<string>>();
  const MAX_CONCURRENT_SOCKETS_PER_USER = 10;

  // Register room and presence events on connection
  io.on('connection', (socket) => {
    const userId = socket.data.userId;

    // Track concurrent connections per account
    let userSockets = userSocketsMap.get(userId);
    if (!userSockets) {
      userSockets = new Set();
      userSocketsMap.set(userId, userSockets);
    }
    if (userSockets.size >= MAX_CONCURRENT_SOCKETS_PER_USER) {
      socket.emit('room:error', {
        code: 'CONCURRENT_LIMIT',
        message: 'Too many concurrent socket connections for this account.',
      });
      socket.disconnect(true);
      return;
    }
    userSockets.add(socket.id);

    // Socket packet event limiter: max 35 per socket, max 60 per account per second
    socket.use(([event], next) => {
      const now = Date.now();

      // 1. Per-socket limit
      let limit = socketRateMap.get(socket.id);
      if (!limit || now > limit.resetAt) {
        limit = { count: 1, resetAt: now + 1000 };
        socketRateMap.set(socket.id, limit);
      } else {
        limit.count++;
      }
      if (limit.count > 35) {
        return next(new Error('Rate limit exceeded: too many socket events per second.'));
      }

      // 2. Account-level multi-socket limit
      let userLimit = userRateMap.get(userId);
      if (!userLimit || now > userLimit.resetAt) {
        userLimit = { count: 1, resetAt: now + 1000 };
        userRateMap.set(userId, userLimit);
      } else {
        userLimit.count++;
      }
      if (userLimit.count > 60) {
        return next(new Error('Account rate limit exceeded: too many socket events per second across connections.'));
      }

      next();
    });

    socket.on('disconnect', () => {
      socketRateMap.delete(socket.id);
      const activeSockets = userSocketsMap.get(userId);
      if (activeSockets) {
        activeSockets.delete(socket.id);
        if (activeSockets.size === 0) {
          userSocketsMap.delete(userId);
          userRateMap.delete(userId);
        }
      }
    });

    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
  });

  return io;
}

