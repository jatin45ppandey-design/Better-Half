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
    } catch {
      res.status(500).json({ success: false, error: 'Match history is temporarily unavailable.' });
    }
  }

  async getMatch(req: Request, res: Response): Promise<void> {
    try {
      const requestingUserId = (req as any).user?.id;
      const matchId = req.params.matchId as string;

      const match = await matchesService.getMatchById(matchId, requestingUserId);
      res.json({ success: true, data: match });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      const normalized = message.toLowerCase();
      const status = normalized.includes('permission') ? 403 : normalized.includes('not found') ? 404 : 500;
      res.status(status).json({
        success: false,
        error: status === 403
          ? 'You do not have permission to view this match.'
          : status === 404
            ? 'Match not found.'
            : 'Match details are temporarily unavailable.',
      });
    }
  }
}

export const matchesController = new MatchesController();
