import { Request, Response, NextFunction } from 'express';
import { settingsService } from './settings.service.js';

export async function getMySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const settings = await settingsService.getSettings(userId);
    res.status(200).json(settings);
  } catch (error) {
    next(error);
  }
}

export async function updateMySettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const updated = await settingsService.updateSettings(userId, req.body);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
}

