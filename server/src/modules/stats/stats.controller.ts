import type { Request, Response } from 'express';
import { statsService } from './stats.service.js';

export class StatsController {
  async getMyStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const stats = await statsService.getUserStats(userId, userId);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to fetch player stats.' });
    }
  }

  async getMyGames(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const games = await statsService.getUserGameStats(userId, userId);
      res.json({ success: true, data: games });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to fetch game stats.' });
    }
  }

  async getMyRecent(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const recent = await statsService.getRecentPerformance(userId, userId);
      res.json({ success: true, data: recent });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to fetch recent stats.' });
    }
  }

  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = (req as any).user?.id;
      const targetUserId = req.params.userId as string;
      const stats = await statsService.getUserStats(targetUserId, requestingUserId);
      res.json({ success: true, data: stats });
    } catch (err: any) {
      const status = err.message?.includes('private') ? 403 : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to fetch player stats.' });
    }
  }

  async getUserGames(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = (req as any).user?.id;
      const targetUserId = req.params.userId as string;
      const games = await statsService.getUserGameStats(targetUserId, requestingUserId);
      res.json({ success: true, data: games });
    } catch (err: any) {
      const status = err.message?.includes('private') ? 403 : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to fetch game stats.' });
    }
  }
}

export const statsController = new StatsController();

