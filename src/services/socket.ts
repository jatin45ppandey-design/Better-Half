import { io, Socket } from 'socket.io-client';
import { supabase } from '../lib/supabase';

const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const ACK_TIMEOUT_MS = 10_000;

type RoomJoinPayload = {
  roomId?: string;
  code?: string;
};

class SocketService {
  private socket: Socket | null = null;
  private connectionPromise: Promise<Socket | null> | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  // Socket.IO room membership is connection-scoped. Keep the rooms this client
  // has joined so they can be re-authorized and rejoined after reconnect.
  private joinedRooms: Map<string, RoomJoinPayload> = new Map();
  private joinedSessions: Set<string> = new Set();

  /**
   * Initialize or retrieve an authenticated socket connection.
   * Resolves only after the socket connects (or a bounded failure), never with
   * a socket that is still connecting.
   */
  async connect(): Promise<Socket | null> {
    if (this.socket?.connected) return this.socket;
    if (this.connectionPromise) return this.connectionPromise;

    const pending = this.connectInternal();
    this.connectionPromise = pending;

    try {
      return await pending;
    } finally {
      if (this.connectionPromise === pending) {
        this.connectionPromise = null;
      }
    }
  }

  private async connectInternal(): Promise<Socket | null> {
    if (!this.socket) {
      const { data, error } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (error || !token) {
        return null;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: ACK_TIMEOUT_MS,
      });

      this.attachSocketListeners(this.socket);
    }

    const socket = this.socket;
    if (socket.connected) return socket;

    return new Promise<Socket | null>((resolve) => {
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onConnectError);
      };

      const finish = (value: Socket | null) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const onConnect = () => finish(socket);
      const onConnectError = (error: Error) => {
        console.warn('[Socket] Connection error:', error.message);
        finish(null);
      };

      const timeout = setTimeout(() => {
        finish(null);
      }, ACK_TIMEOUT_MS + 1000);

      socket.once('connect', onConnect);
      socket.once('connect_error', onConnectError);

      if (!socket.connected) socket.connect();
      else finish(socket);
    });
  }

  private attachSocketListeners(socket: Socket): void {
    socket.on('connect', () => {
      console.log('[Socket] Connected with ID:', socket.id);

      // A reconnect creates a new server-side socket with no room/session
      // memberships. Rejoin through normal handlers so authorization is rechecked.
      for (const [key, payload] of this.joinedRooms.entries()) {
        socket.timeout(ACK_TIMEOUT_MS).emit('room:join', payload, (error: Error | null, response: any) => {
          if (error || !response?.success) {
            console.warn('[Socket] Room rejoin failed:', key, response?.error || error?.message);
          }
        });
      }

      for (const sessionId of this.joinedSessions) {
        socket.timeout(ACK_TIMEOUT_MS).emit(
          'game:session:join',
          { sessionId },
          (error: Error | null, response: any) => {
            if (error || !response?.success) {
              console.warn(
                '[Socket] Game session rejoin failed:',
                sessionId,
                response?.error || error?.message
              );
            }
          }
        );
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    // Re-attach registered custom listeners to a newly created socket.
    for (const [event, callbacks] of this.listeners.entries()) {
      for (const callback of callbacks) {
        socket.on(event, callback as any);
      }
    }
  }

  private roomKey(payload: RoomJoinPayload | undefined): string | null {
    const identifier = payload?.roomId || payload?.code;
    return typeof identifier === 'string' && identifier.trim()
      ? identifier.trim().toUpperCase()
      : null;
  }

  /**
   * Disconnect the active socket. This is intended for logout/session teardown.
   */
  disconnect(): void {
    this.joinedRooms.clear();
    this.joinedSessions.clear();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionPromise = null;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  on(event: string, callback: (...args: any[]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    if (this.socket) {
      this.socket.on(event, callback);
    }

    return () => this.off(event, callback);
  }

  off(event: string, callback: (...args: any[]) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) this.listeners.delete(event);
    }

    this.socket?.off(event, callback);
  }

  /**
   * Emit an event after a successful connection. Acknowledged events have a
   * finite timeout and return a consistent failure object when unavailable.
   */
  emit(event: string, payload?: any, callback?: (response: any) => void): void {
    const isRoomJoin = event === 'room:join';
    const isRoomLeave = event === 'room:leave';
    const isSessionJoin = event === 'game:session:join';
    const isSessionLeave = event === 'game:session:leave';
    const roomPayload = payload as RoomJoinPayload | undefined;
    const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId : null;

    if (isSessionLeave && sessionId) {
      this.joinedSessions.delete(sessionId);
    }

    if (isRoomLeave) {
      const key = this.roomKey(roomPayload);
      if (key) this.joinedRooms.delete(key);
      if (roomPayload?.code) this.joinedRooms.delete(roomPayload.code.trim().toUpperCase());
    }

    const send = (socket: Socket | null) => {
      if (!socket?.connected) {
        callback?.({ success: false, error: 'Socket not connected' });
        return;
      }

      const shouldAck = typeof callback === 'function' || isRoomJoin || isSessionJoin;
      if (!shouldAck) {
        socket.emit(event, payload);
        return;
      }

      (socket as any).timeout(ACK_TIMEOUT_MS).emit(
        event,
        payload,
        (error: Error | null, response: any) => {
          if (error) {
            callback?.({ success: false, error: 'Socket acknowledgement timed out' });
            return;
          }

          if (isRoomJoin) {
            const key = this.roomKey(roomPayload);
            if (key && response?.success) {
              this.joinedRooms.set(key, roomPayload || {});
            }
          }

          if (isSessionJoin && sessionId && response?.success) {
            this.joinedSessions.add(sessionId);
          }

          callback?.(response ?? { success: false, error: 'No acknowledgement received' });
        }
      );
    };

    if (this.socket?.connected) {
      send(this.socket);
      return;
    }

    this.connect().then(send).catch((error) => {
      console.warn('[Socket] Could not connect before emit:', error);
      callback?.({ success: false, error: 'Socket connection failed' });
    });
  }
}

export const socketService = new SocketService();
