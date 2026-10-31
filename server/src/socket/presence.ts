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

  // userId -> Privacy configuration
  private userPrivacy = new Map<string, { showOnlineStatus: boolean; ghostMode: boolean }>();

  // Default grace period: 15 seconds
  private gracePeriodMs: number;
  private maxPrivacyEntries = 10000;
  private privacySweepInterval: NodeJS.Timeout | null = null;

  getOnlineCount(): number {
    return this.userSockets.size;
  }

  constructor(gracePeriodMs = 15000) {
    this.gracePeriodMs = gracePeriodMs;

    this.privacySweepInterval = setInterval(() => {
      this.pruneStaleUserPrivacy();
    }, 5 * 60 * 1000);
    if (typeof this.privacySweepInterval.unref === 'function') {
      this.privacySweepInterval.unref();
    }
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

          // Remove from all rooms and prune empty room sets to prevent memory leaks
          for (const [roomId, users] of this.roomPresence.entries()) {
            if (users.has(userId)) {
              users.delete(userId);
              if (users.size === 0) {
                this.roomPresence.delete(roomId);
              }
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
   * Get all active socket IDs for a user
   */
  getUserSockets(userId: string): string[] {
    const sockets = this.userSockets.get(userId);
    return sockets ? Array.from(sockets) : [];
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
   * Set user privacy settings for presence visibility
   */
  setUserPrivacy(userId: string, privacy: { showOnlineStatus?: boolean; ghostMode?: boolean }): void {
    if (this.userPrivacy.size >= this.maxPrivacyEntries && !this.userPrivacy.has(userId)) {
      const oldestKey = this.userPrivacy.keys().next().value;
      if (oldestKey) this.userPrivacy.delete(oldestKey);
    }
    const existing = this.userPrivacy.get(userId) || { showOnlineStatus: true, ghostMode: false };
    this.userPrivacy.set(userId, {
      showOnlineStatus: privacy.showOnlineStatus !== undefined ? privacy.showOnlineStatus : existing.showOnlineStatus,
      ghostMode: privacy.ghostMode !== undefined ? privacy.ghostMode : existing.ghostMode,
    });
  }

  /**
   * Prune privacy entries for users who are fully offline and not in any rooms
   */
  pruneStaleUserPrivacy(): void {
    for (const userId of this.userPrivacy.keys()) {
      if (!this.isUserOnline(userId) && this.getUserRooms(userId).length === 0) {
        this.userPrivacy.delete(userId);
      }
    }
  }

  /**
   * Determine if a user's presence should be visible to other players
   */
  isUserVisible(userId: string): boolean {
    const priv = this.userPrivacy.get(userId);
    if (!priv) return true;
    if (priv.ghostMode) return false;
    if (priv.showOnlineStatus === false) return false;
    return true;
  }

  /**
   * Check if a user is currently considered online
   */
  isUserOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0 || this.disconnectTimers.has(userId);
  }

  /**
   * Get all online user IDs in a specific room, respecting user privacy settings.
   * If requestingUserId is supplied, that user always sees their own online presence.
   */
  getRoomOnlineUsers(roomId: string, requestingUserId?: string): string[] {
    const roomUsers = this.roomPresence.get(roomId);
    if (!roomUsers) return [];
    return Array.from(roomUsers).filter((uid) => {
      const isOnline = this.isUserOnline(uid);
      if (!isOnline) return false;
      if (requestingUserId && uid === requestingUserId) return true;
      return this.isUserVisible(uid);
    });
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
   * Graceful shutdown of presence timers
   */
  shutdown(): void {
    for (const timer of this.disconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.disconnectTimers.clear();
    if (this.privacySweepInterval) {
      clearInterval(this.privacySweepInterval);
      this.privacySweepInterval = null;
    }
  }

  /**
   * Clean up all state (for tests)
   */
  reset(): void {
    this.shutdown();
    this.userSockets.clear();
    this.roomPresence.clear();
    this.userPrivacy.clear();
  }
}

export const presenceManager = new PresenceManager();
