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

  // Per-socket event frequency limiter
  const socketRateMap = new Map<string, { count: number; resetAt: number }>();

  // Register room and presence events on connection
  io.on('connection', (socket) => {
    // Socket packet event limiter: max 35 events per second per socket
    socket.use(([event], next) => {
      const now = Date.now();
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
      next();
    });

    socket.on('disconnect', () => {
      socketRateMap.delete(socket.id);
    });

    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
  });

  return io;
}

