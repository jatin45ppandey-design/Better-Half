import type { Server, Socket } from 'socket.io';
import { roomsService } from '../modules/rooms/rooms.service.js';
import { gameSessionService } from '../modules/games/core/gameSession.service.js';
import { presenceManager } from './presence.js';
import { prisma } from '../config/prisma.js';
import { safeSocketError } from './safeError.js';
import {
  roomJoinSchema,
  roomLeaveSchema,
  roomReadyUpdateSchema,
  roomGameVoteSchema,
  roomGameSelectSchema,
  roomStartPrepareSchema,
  roomHostTransferSchema,
  roomPlayerKickSchema,
  roomChatSendSchema,
  roomReactionSendSchema,
  validateSocketPayload,
} from './socketSchemas.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  RoomSnapshot,
} from './types.js';

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

// Transient rate limit for emojis/reactions: userId -> count & resetTime
const reactionRateLimits = new Map<string, { count: number; resetAt: number }>();

export function registerRoomHandlers(io: AppServer, socket: AppSocket): void {
  const userId = socket.data.userId;

  // Track socket connection in presence manager
  presenceManager.trackConnect(userId, socket.id);

  const checkSuspension = (callback?: (res: { success: false; error: string }) => void): boolean => {
    if (socket.data.accountStatus === 'SUSPENDED') {
      callback?.({ success: false, error: 'Your account is suspended' });
      socket.disconnect(true);
      return true;
    }
    if (socket.data.tokenExp && Date.now() > socket.data.tokenExp) {
      callback?.({ success: false, error: 'Authentication token has expired' });
      socket.emit('room:error', { code: 'TOKEN_EXPIRED', message: 'Authentication token has expired.' });
      socket.disconnect(true);
      return true;
    }
    return false;
  };

  /**
   * room:join
   */
  socket.on('room:join', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomJoinSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { roomId, code } = payload;
      let targetRoom: any;

      if (roomId) {
        try {
          targetRoom = await roomsService.getRoomById(roomId, userId);
        } catch {
          if (code) targetRoom = await roomsService.getRoomByCode(code, userId);
          else throw new Error('Room not found');
        }
      } else if (code) {
        targetRoom = await roomsService.getRoomByCode(code, userId);
      }

      if (!targetRoom) {
        callback?.({ success: false, error: 'Room not found' });
        return;
      }

      let roomSnapshot: RoomSnapshot;
      if (targetRoom.isJoinPreview) {
        if (!targetRoom.canJoin) {
          callback?.({ success: false, error: targetRoom.joinUnavailableReason || 'This room cannot be joined.' });
          return;
        }
        const joined = await roomsService.joinRoom(userId, targetRoom.code);
        if (!joined.room) {
          callback?.({ success: false, error: 'Failed to join room' });
          return;
        }
        roomSnapshot = joined.room;
      } else {
        roomSnapshot = targetRoom as RoomSnapshot;
      }

      const roomChannel = `room:${roomSnapshot.id}`;
      await socket.join(roomChannel);

      // Track presence
      presenceManager.joinRoom(roomSnapshot.id, userId);

      // Broadcast player joined to others in room
      const currentParticipant = roomSnapshot.participants.find(
        (p: { userId: string }) => p.userId === userId
      );
      if (currentParticipant) {
        socket.to(roomChannel).emit('room:player:joined', {
          participant: {
            ...currentParticipant,
            isOnline: true,
          },
        });
      }

      // Send state to joining user
      socket.emit('room:state', roomSnapshot);

      // Broadcast updated online presence to room
      const onlineUserIds = presenceManager.getRoomOnlineUsers(roomSnapshot.id);
      io.to(roomChannel).emit('room:presence:update', { onlineUserIds });

      callback?.({ success: true, room: roomSnapshot });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to join room') });
    }
  });

  /**
   * room:leave
   */
  socket.on('room:leave', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomLeaveSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { roomId: roomIdentifier } = payload;
      const roomId = await roomsService.getCanonicalRoomId(roomIdentifier);
      const result = await roomsService.leaveRoom(roomId, userId);

      const roomChannel = `room:${roomId}`;
      // Leaving a room removes every active tab/device for this user so no
      // stale socket can continue receiving private room broadcasts.
      const userSocketIds = presenceManager.getUserSockets(userId);
      for (const socketId of userSocketIds) {
        const userSocket = io.sockets.sockets.get(socketId);
        if (userSocket) await userSocket.leave(roomChannel);
      }
      await socket.leave(roomChannel);
      presenceManager.leaveRoom(roomId, userId);

      if (result) {
        io.to(roomChannel).emit('room:player:left', {
          userId,
          newHostId: result.newHostId ?? undefined,
          roomClosed: result.roomClosed,
        });

        if (result.room) {
          io.to(roomChannel).emit('room:state', result.room);
        }

        const onlineUserIds = presenceManager.getRoomOnlineUsers(roomId);
        io.to(roomChannel).emit('room:presence:update', { onlineUserIds });
      }

      callback?.({ success: true });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to leave room') });
    }
  });

  /**
   * room:ready:update
   */
  socket.on('room:ready:update', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomReadyUpdateSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { roomId: roomIdentifier, isReady } = payload;
      const roomId = await roomsService.getCanonicalRoomId(roomIdentifier);
      const updatedRoom = await roomsService.toggleReady(roomId, userId, isReady);
      if (!updatedRoom) {
        callback?.({ success: false, error: 'Room not found' });
        return;
      }

      const participant = updatedRoom.participants.find(
        (p: { userId: string }) => p.userId === userId
      );

      const roomChannel = `room:${roomId}`;
      io.to(roomChannel).emit('room:player:ready', {
        userId,
        isReady: participant ? participant.isReady : (isReady ?? false),
        roomStatus: updatedRoom.status,
      });

      io.to(roomChannel).emit('room:state', updatedRoom);

      callback?.({
        success: true,
        isReady: participant ? participant.isReady : (isReady ?? false),
      });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to update ready status') });
    }
  });

  /**
   * room:game:vote
   */
  socket.on('room:game:vote', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomGameVoteSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { roomId: roomIdentifier, gameId } = payload;
      const roomId = await roomsService.getCanonicalRoomId(roomIdentifier);
      const updatedRoom = await roomsService.voteGame(roomId, userId, gameId);
      if (!updatedRoom) {
        callback?.({ success: false, error: 'Room not found' });
        return;
      }

      const roomChannel = `room:${roomId}`;
      io.to(roomChannel).emit('room:game:voted', {
        userId,
        gameId,
        votes: updatedRoom.gameVotes,
      });

      io.to(roomChannel).emit('room:state', updatedRoom);

      callback?.({ success: true, votes: updatedRoom.gameVotes });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to submit vote') });
    }
  });

  /**
   * room:game:select
   */
  socket.on('room:game:select', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomGameSelectSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { roomId: roomIdentifier, gameId } = payload;
      const roomId = await roomsService.getCanonicalRoomId(roomIdentifier);
      const updatedRoom = await roomsService.selectGame(roomId, userId, gameId);
      if (!updatedRoom) {
        callback?.({ success: false, error: 'Room not found' });
        return;
      }

      const roomChannel = `room:${roomId}`;
      io.to(roomChannel).emit('room:game:selected', {
        selectedGameId: gameId,
      });

      io.to(roomChannel).emit('room:state', updatedRoom);

      callback?.({ success: true });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to select game') });
    }
  });

  /**
   * room:start:prepare
   */
  socket.on('room:start:prepare', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomStartPrepareSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { roomId: roomIdentifier } = payload;
      const roomId = await roomsService.getCanonicalRoomId(roomIdentifier);
      const check = await roomsService.canStartGame(roomId, userId);

      if (!check.canStart) {
        callback?.({ success: false, error: check.reason || 'Cannot start game yet' });
        return;
      }

      const room = await roomsService.getRoomById(roomId, userId);
      if (!room) {
        callback?.({ success: false, error: 'Room not found' });
        return;
      }
      if (!room.selectedGameId) {
        callback?.({ success: false, error: 'No game selected' });
        return;
      }

      // Initialize authoritative Phase 3 Game Session
      let sessionId = '';
      try {
        const { session } = await gameSessionService.createSession(
          roomId,
          room.selectedGameId,
          userId
        );
        sessionId = session.sessionId;
      } catch (err: any) {
        callback?.({ success: false, error: safeSocketError(err, 'Failed to create game session') });
        return;
      }

      const roomChannel = `room:${roomId}`;
      io.to(roomChannel).emit('game:session:started', {
        sessionId,
        gameId: room.selectedGameId,
        roomCode: room.code,
      });

      io.to(roomChannel).emit('room:start:launch', {
        gameId: room.selectedGameId,
        launchedAt: new Date().toISOString(),
      });

      callback?.({ success: true });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to start game') });
    }
  });

  /**
   * room:host:transfer
   */
  socket.on('room:host:transfer', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomHostTransferSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { roomId: roomIdentifier, newHostId } = payload;
      const roomId = await roomsService.getCanonicalRoomId(roomIdentifier);
      const updatedRoom = await roomsService.transferHost(roomId, userId, newHostId);
      if (!updatedRoom) {
        callback?.({ success: false, error: 'Room not found' });
        return;
      }

      const roomChannel = `room:${roomId}`;
      io.to(roomChannel).emit('room:host:changed', {
        hostId: newHostId,
        hostName: updatedRoom.hostName,
      });

      io.to(roomChannel).emit('room:state', updatedRoom);

      callback?.({ success: true });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to transfer host') });
    }
  });

  /**
   * room:player:kick
   */
  socket.on('room:player:kick', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomPlayerKickSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { roomId: roomIdentifier, targetUserId } = payload;
      const roomId = await roomsService.getCanonicalRoomId(roomIdentifier);
      const result = await roomsService.kickParticipant(roomId, userId, targetUserId);

      const roomChannel = `room:${roomId}`;

      // Evict target user's active sockets from room channel and notify them
      const targetSockets = presenceManager.getUserSockets(targetUserId);
      for (const sId of targetSockets) {
        const s = io.sockets.sockets.get(sId);
        if (s) {
          s.leave(roomChannel);
          s.emit('room:player:kicked', { targetUserId, roomId });
        }
      }

      io.to(roomChannel).emit('room:player:kicked', { targetUserId, roomId });
      if (result.room) {
        io.to(roomChannel).emit('room:state', result.room);
      }

      // Remove target user's presence
      presenceManager.leaveRoom(roomId, targetUserId);
      const onlineUserIds = presenceManager.getRoomOnlineUsers(roomId);
      io.to(roomChannel).emit('room:presence:update', { onlineUserIds });

      callback?.({ success: true });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to kick player') });
    }
  });

  /**
   * room:chat:send
   */
  socket.on('room:chat:send', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomChatSendSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { roomId: roomIdentifier, message } = payload;
      const roomId = await roomsService.getCanonicalRoomId(roomIdentifier);
      const createdMessage = await roomsService.postMessage(roomId, userId, message);

      const roomChannel = `room:${roomId}`;
      io.to(roomChannel).emit('room:chat:new', createdMessage);

      callback?.({ success: true, message: createdMessage });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to send message') });
    }
  });

  /**
   * room:reaction:send
   */
  socket.on('room:reaction:send', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(roomReactionSendSchema, rawPayload, callback);
    if (!payload) return;

    const { roomId: roomIdentifier, reaction } = payload;

    try {
      // Presence alone is not authorization: confirm active database membership
      // and normalize the room code/ID before checking presence or broadcasting.
      const roomId = await roomsService.getActiveRoomIdForUser(roomIdentifier, userId);
      const userRooms = presenceManager.getUserRooms(userId);
      if (!userRooms.includes(roomId)) {
        callback?.({ success: false, error: 'You are not present in this room' });
        return;
      }

      const now = Date.now();
      for (const [limitedUserId, limit] of reactionRateLimits.entries()) {
        if (now > limit.resetAt) reactionRateLimits.delete(limitedUserId);
      }

      const limit = reactionRateLimits.get(userId) || { count: 0, resetAt: now + 3000 };
      if (now > limit.resetAt) {
        limit.count = 1;
        limit.resetAt = now + 3000;
      } else {
        limit.count++;
      }
      reactionRateLimits.set(userId, limit);

      if (limit.count > 10) {
        callback?.({ success: false, error: 'Too many reactions sent. Please slow down.' });
        return;
      }

      io.to(`room:${roomId}`).emit('room:reaction:new', {
        senderId: userId,
        reaction,
        timestamp: new Date().toISOString(),
      });

      callback?.({ success: true });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to send reaction') });
    }
  });

  /**
   * disconnect — handled with in-memory grace period
   */
  socket.on('disconnect', () => {
    presenceManager.trackDisconnect(userId, socket.id, async (offlineUserId, affectedRooms) => {
      // Grace period expired without reconnection
      for (const roomId of affectedRooms) {
        const roomChannel = `room:${roomId}`;
        const onlineUserIds = presenceManager.getRoomOnlineUsers(roomId);
        io.to(roomChannel).emit('room:presence:update', { onlineUserIds });

        // If the disconnected user was the room host, safely migrate host ownership
        try {
          const room = await prisma.room.findFirst({
            where: {
              OR: [{ id: roomId }, { code: roomId.toUpperCase() }],
            },
            include: {
              participants: {
                where: { leftAt: null },
                orderBy: { joinedAt: 'asc' },
                include: { user: true },
              },
            },
          });

          if (
            room &&
            room.hostId === offlineUserId &&
            (room.status === 'WAITING' || room.status === 'READY_TO_START')
          ) {
            const activeOthers = room.participants.filter((p) => p.userId !== offlineUserId);
            if (activeOthers.length > 0) {
              // Prioritize currently online participant, else oldest active participant
              const candidate =
                activeOthers.find((p) => presenceManager.isUserOnline(p.userId)) || activeOthers[0];

              const updatedRoom = await roomsService.transferHost(
                room.id,
                offlineUserId,
                candidate.userId
              );

              if (updatedRoom) {
                io.to(roomChannel).emit('room:host:changed', {
                  hostId: candidate.userId,
                  hostName: updatedRoom.hostName,
                });
                io.to(roomChannel).emit('room:state', updatedRoom);
              }
            }
          }
        } catch (err) {
          console.warn('[Presence] Host migration on disconnect failed:', err);
        }
      }
    });
  });
}
