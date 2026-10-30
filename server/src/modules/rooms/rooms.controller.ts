import { Request, Response, NextFunction } from 'express';
import { roomsService } from './rooms.service.js';

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
    const code = getParam(req.params.code).toUpperCase().trim();
    const room = await roomsService.getRoomByCode(code, req.user!.id);
    res.status(200).json(room);
  } catch (error) {
    next(error);
  }
}

export async function getMyActiveRooms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const rooms = await roomsService.getUserActiveRooms(userId);
    res.status(200).json({ rooms });
  } catch (error) {
    next(error);
  }
}

export async function joinRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { code } = req.body;
    const room = await roomsService.joinRoom(userId, code);
    res.status(200).json(room);
  } catch (error) {
    next(error);
  }
}

export async function leaveRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const roomId = getParam(req.params.id);
    const result = await roomsService.leaveRoom(roomId, userId);
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
    const room = await roomsService.kickParticipant(roomId, userId, targetUserId);
    res.status(200).json(room);
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

