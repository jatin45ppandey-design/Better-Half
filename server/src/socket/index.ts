import type http from 'node:http';
import { Server } from 'socket.io';
import { isOriginAllowed } from '../config/cors.js';
import { socketAuthMiddleware } from './authMiddleware.js';
import { registerRoomHandlers } from './roomHandlers.js';
import { registerGameHandlers } from './gameHandlers.js';
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
  });

  // Supabase Auth verification handshake
  io.use(socketAuthMiddleware);

  // Register room and presence events on connection
  io.on('connection', (socket) => {
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
  });

  return io;
}

