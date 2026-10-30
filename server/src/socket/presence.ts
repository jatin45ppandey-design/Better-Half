/**
 * In-memory presence tracker with reconnection grace period
 */
export class PresenceManager {
  // userId -> Set of active socket IDs
  private userSockets = new Map<string, Set<string>>();

  // userId -> grace period timeout
  private disconnectTimers = new Map<string, NodeJS.Timeout>();

  // roomId -> Set of userIds currently in room
  private roomPresence = new Map<string, Set<string>>();

  // Default grace period: 15 seconds
  private gracePeriodMs: number;

  constructor(gracePeriodMs = 15000) {
    this.gracePeriodMs = gracePeriodMs;
  }

  /**
   * Called when a socket connects and authenticates
   */
  trackConnect(userId: string, socketId: string): { reconnected: boolean } {
    const hadPendingDisconnect = this.disconnectTimers.has(userId);
    if (hadPendingDisconnect) {
      clearTimeout(this.disconnectTimers.get(userId)!);
      this.disconnectTimers.delete(userId);
    }

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    return { reconnected: hadPendingDisconnect };
  }

  /**
   * Called when a socket disconnects. Starts grace period if no sockets remain.
   */
  trackDisconnect(
    userId: string,
    socketId: string,
    onGraceExpired: (userId: string, affectedRooms: string[]) => void
  ): boolean {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);

        // Start grace period timer
        const timer = setTimeout(() => {
          this.disconnectTimers.delete(userId);

          // Capture affected rooms before removing from presence
          const affectedRooms = this.getUserRooms(userId);

          // Remove from all rooms
          for (const [, users] of this.roomPresence.entries()) {
            if (users.has(userId)) {
              users.delete(userId);
            }
          }

          onGraceExpired(userId, affectedRooms);
        }, this.gracePeriodMs);

        this.disconnectTimers.set(userId, timer);
        return true; // Grace period started
      }
    }
    return false;
  }

  /**
   * User enters a room
   */
  joinRoom(roomId: string, userId: string): void {
    if (!this.roomPresence.has(roomId)) {
      this.roomPresence.set(roomId, new Set());
    }
    this.roomPresence.get(roomId)!.add(userId);
  }

  /**
   * User leaves a room
   */
  leaveRoom(roomId: string, userId: string): void {
    const roomUsers = this.roomPresence.get(roomId);
    if (roomUsers) {
      roomUsers.delete(userId);
      if (roomUsers.size === 0) {
        this.roomPresence.delete(roomId);
      }
    }
  }

  /**
   * Check if a user is currently considered online
   */
  isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0 || this.disconnectTimers.has(userId);
  }

  /**
   * Get all online user IDs in a specific room
   */
  getRoomOnlineUsers(roomId: string): string[] {
    const roomUsers = this.roomPresence.get(roomId);
    if (!roomUsers) return [];
    return Array.from(roomUsers).filter((uid) => this.isUserOnline(uid));
  }

  /**
   * Get all rooms a user is present in
   */
  getUserRooms(userId: string): string[] {
    const rooms: string[] = [];
    for (const [roomId, users] of this.roomPresence.entries()) {
      if (users.has(userId)) {
        rooms.push(roomId);
      }
    }
    return rooms;
  }

  /**
   * Clean up all state (for tests)
   */
  reset(): void {
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
    this.userSockets.clear();
    this.roomPresence.clear();
  }
}

export const presenceManager = new PresenceManager();
