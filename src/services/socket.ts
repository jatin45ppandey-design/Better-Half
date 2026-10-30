import { io, Socket } from 'socket.io-client';
import { supabase } from '../lib/supabase';

const SOCKET_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');

class SocketService {
  private socket: Socket | null = null;
  private isConnecting = false;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * Initialize or retrieve active socket connection
   */
  async connect(): Promise<Socket | null> {
    if (this.socket?.connected) {
      return this.socket;
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.socket?.connected) {
            clearInterval(check);
            resolve(this.socket);
          }
        }, 100);
      });
    }

    this.isConnecting = true;

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        this.isConnecting = false;
        return null;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      this.socket.on('connect', () => {
        console.log('[Socket] Connected with ID:', this.socket?.id);
        this.isConnecting = false;
      });

      this.socket.on('connect_error', (err) => {
        console.warn('[Socket] Connection error:', err.message);
        this.isConnecting = false;
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
      });

      // Re-attach registered custom listeners
      for (const [event, callbacks] of this.listeners.entries()) {
        for (const cb of callbacks) {
          this.socket.on(event, cb as any);
        }
      }

      return this.socket;
    } catch (err) {
      console.error('[Socket] Failed to connect:', err);
      this.isConnecting = false;
      return null;
    }
  }

  /**
   * Disconnect active socket
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
  }

  /**
   * Get current socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Register event listener
   */
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

  /**
   * Remove event listener
   */
  off(event: string, callback: (...args: any[]) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.listeners.delete(event);
      }
    }

    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  /**
   * Emit event with optional callback
   */
  emit(event: string, payload?: any, callback?: (response: any) => void): void {
    if (!this.socket?.connected) {
      // Attempt connect first then emit
      this.connect().then((sock) => {
        if (sock?.connected) {
          sock.emit(event, payload, callback);
        } else {
          callback?.({ success: false, error: 'Socket not connected' });
        }
      });
      return;
    }

    this.socket.emit(event, payload, callback);
  }
}

export const socketService = new SocketService();

