import { Request, Response, NextFunction } from 'express';
import { friendsService } from './friends.service.js';

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

export async function getFriends(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const friends = await friendsService.listFriends(userId);
    res.status(200).json({ friends });
  } catch (error) {
    next(error);
  }
}

export async function getFriendRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const requests = await friendsService.listRequests(userId);
    res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
}

export async function sendFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const senderId = req.user!.id;
    const result = await friendsService.sendRequest(senderId, req.body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function acceptFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const requestId = getParam(req.params.requestId);
    const result = await friendsService.acceptRequest(userId, requestId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function rejectFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const requestId = getParam(req.params.requestId);
    const result = await friendsService.rejectRequest(userId, requestId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function cancelFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const requestId = getParam(req.params.requestId);
    const result = await friendsService.cancelRequest(userId, requestId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function removeFriend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const friendId = getParam(req.params.friendId);
    const result = await friendsService.removeFriend(userId, friendId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function blockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const blockerId = req.user!.id;
    const userId = getParam(req.params.userId);
    const result = await friendsService.blockUser(blockerId, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function unblockUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const blockerId = req.user!.id;
    const userId = getParam(req.params.userId);
    const result = await friendsService.unblockUser(blockerId, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listBlockedUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const blocked = await friendsService.listBlocked(userId);
    res.status(200).json({ blocked });
  } catch (error) {
    next(error);
  }
}
