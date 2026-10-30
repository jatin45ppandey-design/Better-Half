import type { Request, Response } from 'express';
import { statsService } from './stats.service.js';

function isPrivacyDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('private') || message.includes('not accessible');
}

export class StatsController {
  async getMyStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const stats = await statsService.getUserStats(userId, userId);
      res.json({ success: true, data: stats });
    } catch {
      res.status(500).json({ success: false, error: 'Player statistics are temporarily unavailable.' });
    }
  }

  async getMyGames(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const games = await statsService.getUserGameStats(userId, userId);
      res.json({ success: true, data: games });
    } catch {
      res.status(500).json({ success: false, error: 'Game statistics are temporarily unavailable.' });
    }
  }

  async getMyRecent(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const recent = await statsService.getRecentPerformance(userId, userId);
      res.json({ success: true, data: recent });
    } catch {
      res.status(500).json({ success: false, error: 'Recent match data is temporarily unavailable.' });
    }
  }

  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = (req as any).user?.id;
      const targetUserId = req.params.userId as string;
      const stats = await statsService.getUserStats(targetUserId, requestingUserId);
      res.json({ success: true, data: stats });
    } catch (err: unknown) {
      const denied = isPrivacyDenied(err);
      const message = err instanceof Error ? err.message : '';
      res.status(denied ? 403 : 500).json({
        success: false,
        error: denied ? message : 'Player statistics are temporarily unavailable.',
      });
    }
  }

  async getUserGames(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = (req as any).user?.id;
      const targetUserId = req.params.userId as string;
      const games = await statsService.getUserGameStats(targetUserId, requestingUserId);
      res.json({ success: true, data: games });
    } catch (err: unknown) {
      const denied = isPrivacyDenied(err);
      const message = err instanceof Error ? err.message : '';
      res.status(denied ? 403 : 500).json({
        success: false,
        error: denied ? message : 'Game statistics are temporarily unavailable.',
      });
    }
  }
}

export const statsController = new StatsController();
