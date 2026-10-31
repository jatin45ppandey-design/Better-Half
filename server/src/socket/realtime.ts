import type { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types.js';

export type AppSocketServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let realtimeServer: AppSocketServer | null = null;

/**
 * Expose the single Socket.IO server to REST controllers so fallback HTTP
 * actions can publish the same committed state transitions as socket actions.
 */
export function setRealtimeServer(server: AppSocketServer): void {
  realtimeServer = server;
}

export function getRealtimeServer(): AppSocketServer | null {
  return realtimeServer;
}
