import type { Request, Response } from 'express';
import { rivalryService } from './rivalry.service.js';

export class RivalryController {
  async getRivalries(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = (req as any).user?.id;
      const list = await rivalryService.getRivalries(currentUserId);
      res.json({ success: true, data: list });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to fetch rivalries.' });
    }
  }

  async getRivalryWithUser(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = (req as any).user?.id;
      const rivalUserId = req.params.rivalUserId as string;
      const detail = await rivalryService.getRivalryWithUser(currentUserId, rivalUserId);
      res.json({ success: true, data: detail });
    } catch (err: any) {
      const message = err instanceof Error ? err.message : '';
      const status = message.toLowerCase().includes('not found')
        ? 404
        : message.toLowerCase().includes('private') || message.toLowerCase().includes('not accessible')
          ? 403
          : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to fetch rivalry details.' });
    }
  }

  async getRivalryHistory(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = (req as any).user?.id;
      const rivalUserId = req.params.rivalUserId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const history = await rivalryService.getRivalryHistory(currentUserId, rivalUserId, limit);
      res.json({ success: true, data: history });
    } catch (err: any) {
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      const status = message.includes('private') || message.includes('not accessible') ? 403 : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to fetch rivalry match history.' });
    }
  }
}

export const rivalryController = new RivalryController();

