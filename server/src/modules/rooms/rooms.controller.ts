import { Request, Response, NextFunction } from 'express';
import { roomsService } from './rooms.service.js';
import { getRealtimeServer } from '../../socket/realtime.js';
import { revokeRoomMembership } from '../../socket/roomMembership.js';
import { NotFoundError } from '../../utils/errors.js';
import {
  getClientIp,
  isRoomLookupBlocked,
  recordFailedRoomLookup,
} from '../../middleware/rateLimiter.js';

function getParam(param: string | string[] | undefined): string {
  if (!param) return '';
  return Array.isArray(param) ? param[0] : param;
}

export async function createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const room = await roomsService.createRoom(userId, req.body);
    res.status(201).json(room);
  } catch (error) {
    next(error);
  }
}

export async function getRoomById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const roomId = getParam(req.params.id);
    const room = await roomsService.getRoomById(roomId, req.user!.id);
    res.status(200).json(room);
  } catch (error) {
    next(error);
  }
}

export async function getRoomByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.user?.id || getClientIp(req);
    const bruteForceCheck = isRoomLookupBlocked(key);
    if (bruteForceCheck.blocked) {
      res.setHeader('Retry-After', bruteForceCheck.retryAfterSeconds);
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many failed room lookup attempts. Please wait before trying again.',
        retryAfter: bruteForceCheck.retryAfterSeconds,
      });
      return;
    }

    const code = getParam(req.params.code).toUpperCase().trim();
    const room = await roomsService.getRoomByCode(code, req.user!.id);
    res.status(200).json(room);
  } catch (error) {
    if (error instanceof NotFoundError) {
      const key = req.user?.id || getClientIp(req);
      recordFailedRoomLookup(key);
    }
    next(error);
  }
}

export async function getMyActiveRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 100) : undefined;
    const offset = req.query.offset ? Math.max(0, parseInt(req.query.offset as string, 10) || 0) : undefined;
    const rooms = await roomsService.getUserActiveRooms(userId, { limit, offset });
    res.status(200).json({ rooms });
  } catch (error) {
    next(error);
  }
}

export async function joinRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const key = req.user?.id || getClientIp(req);
    const bruteForceCheck = isRoomLookupBlocked(key);
    if (bruteForceCheck.blocked) {
      res.setHeader('Retry-After', bruteForceCheck.retryAfterSeconds);
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Too many failed room lookup attempts. Please wait before trying again.',
        retryAfter: bruteForceCheck.retryAfterSeconds,
      });
      return;
    }

    const userId = req.user!.id;
    const { code } = req.body;
    const room = await roomsService.joinRoom(userId, code);
    res.status(200).json(room);
  } catch (error) {
    if (error instanceof NotFoundError) {
      const key = req.user?.id || getClientIp(req);
      recordFailedRoomLookup(key);
    }
    next(error);
  }
}

export async function leaveRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomIdentifier = getParam(req.params.id);
    let canonicalRoomId: string;
    try {
      canonicalRoomId = await roomsService.getCanonicalRoomId(roomIdentifier);
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        res.status(200).json({ success: true, code: 'ROOM_NOT_FOUND', message: 'Room not found or already closed.' });
        return;
      }
      throw err;
    }
    const result = await roomsService.leaveRoom(canonicalRoomId, userId);
    const realtimeServer = getRealtimeServer();

    if (realtimeServer) {
      const roomChannel = `room:${canonicalRoomId}`;
      const onlineUserIds = await revokeRoomMembership(
        realtimeServer,
        canonicalRoomId,
        userId,
        'LEFT'
      );

      if (result && 'room' in result && result.room) {
        realtimeServer.to(roomChannel).emit('room:player:left', {
          userId,
          ...(result.newHostId ? { newHostId: result.newHostId } : {}),
          roomClosed: result.roomClosed,
        });
        realtimeServer.to(roomChannel).emit('room:state', result.room);
      }
      realtimeServer.to(roomChannel).emit('room:presence:update', { onlineUserIds });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function closeRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const room = await roomsService.closeRoom(roomId, userId);
    res.status(200).json(room);
  } catch (error) {
    next(error);
  }
}

export async function toggleReady(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const { isReady } = req.body;
    const participant = await roomsService.toggleReady(roomId, userId, isReady);
    res.status(200).json(participant);
  } catch (error) {
    next(error);
  }
}

export async function voteGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const { gameId } = req.body;
    const vote = await roomsService.voteGame(roomId, userId, gameId);
    res.status(200).json(vote);
  } catch (error) {
    next(error);
  }
}

export async function selectGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const { gameId } = req.body;
    const room = await roomsService.selectGame(roomId, userId, gameId);
    res.status(200).json(room);
  } catch (error) {
    next(error);
  }
}

export async function canStartGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const check = await roomsService.canStartGame(roomId, userId);
    res.status(200).json(check);
  } catch (error) {
    next(error);
  }
}

export async function transferHost(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const { newHostId } = req.body;
    const room = await roomsService.transferHost(roomId, userId, newHostId);
    res.status(200).json(room);
  } catch (error) {
    next(error);
  }
}

export async function kickParticipant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const { targetUserId } = req.body;
    const result = await roomsService.kickParticipant(roomId, userId, targetUserId);
    const realtimeServer = getRealtimeServer();

    if (realtimeServer && result.room?.id) {
      const canonicalRoomId = result.room.id;
      const roomChannel = `room:${canonicalRoomId}`;
      const onlineUserIds = await revokeRoomMembership(
        realtimeServer,
        canonicalRoomId,
        targetUserId,
        'KICKED'
      );

      realtimeServer.to(roomChannel).emit('room:player:kicked', {
        targetUserId,
        roomId: canonicalRoomId,
      });
      realtimeServer.to(roomChannel).emit('room:state', result.room);
      realtimeServer.to(roomChannel).emit('room:presence:update', { onlineUserIds });
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const result = await roomsService.getMessages(roomId, userId, { cursor, limit });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function postMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const { message } = req.body;
    const saved = await roomsService.postMessage(roomId, userId, message);
    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
}

