import type { AppSocketServer } from './realtime.js';
import { presenceManager } from './presence.js';

export type RoomMembershipRevocationReason = 'LEFT' | 'KICKED';

/**
 * Revoke a room membership from every active socket belonging to a user.
 *
 * Keep this shared between Socket.IO handlers and REST fallbacks so a leave
 * or kick always evicts all tabs/devices from the canonical room channel.
 */
export async function revokeRoomMembership(
  io: AppSocketServer,
  roomId: string,
  userId: string,
  reason: RoomMembershipRevocationReason
): Promise<string[]> {
  const roomChannel = `room:${roomId}`;

  for (const socketId of presenceManager.getUserSockets(userId)) {
    const userSocket = io.sockets.sockets.get(socketId);
    if (!userSocket) continue;

    userSocket.emit('room:membership:revoked', { roomId, userId, reason });
    if (reason === 'KICKED') {
      userSocket.emit('room:player:kicked', { targetUserId: userId, roomId });
    }
    await userSocket.leave(roomChannel);
  }

  presenceManager.leaveRoom(roomId, userId);
  return presenceManager.getRoomOnlineUsers(roomId);
}
