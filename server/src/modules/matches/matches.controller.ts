import type { Request, Response } from 'express';
import { matchesService } from './matches.service.js';

export class MatchesController {
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = (req as any).user?.id;
      const gameId = req.query.gameId as string | undefined;
      const mode = req.query.mode as string | undefined;
      const cursor = req.query.cursor as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const result = await matchesService.getMatchHistory(requestingUserId, requestingUserId, {
        gameId,
        mode,
        cursor,
        limit,
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to fetch match history.' });
    }
  }

  async getMatch(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = (req as any).user?.id;
      const matchId = req.params.matchId as string;

      const match = await matchesService.getMatchById(matchId, requestingUserId);
      res.json({ success: true, data: match });
    } catch (err: any) {
      const status = err.message?.includes('permission') ? 403 : err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to fetch match.' });
    }
  }
}

export const matchesController = new MatchesController();

