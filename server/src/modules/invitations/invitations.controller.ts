import { Request, Response, NextFunction } from 'express';
import { invitationsService } from './invitations.service.js';

function getParam(param: string | string[] | undefined): string {
  if (!param) return '';
  return Array.isArray(param) ? param[0] : param;
}

export async function sendRoomInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { roomId, receiverId } = req.body;
    const invite = await invitationsService.sendInvitation(userId, roomId, receiverId);
    res.status(201).json(invite);
  } catch (error) {
    next(error);
  }
}

export async function getReceivedInvitations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const invitations = await invitationsService.getReceivedInvitations(userId);
    res.status(200).json({ invitations });
  } catch (error) {
    next(error);
  }
}

export async function acceptInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const id = getParam(req.params.id);
    const room = await invitationsService.acceptInvitation(id, userId);
    res.status(200).json(room);
  } catch (error) {
    next(error);
  }
}

export async function declineInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const id = getParam(req.params.id);
    const updated = await invitationsService.declineInvitation(id, userId);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

export async function cancelInvitation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const id = getParam(req.params.id);
    const updated = await invitationsService.cancelInvitation(id, userId);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

