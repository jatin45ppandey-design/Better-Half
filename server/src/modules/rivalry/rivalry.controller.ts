import type { Request, Response } from 'express';
import { rivalryService } from './rivalry.service.js';

function normalizeError(error: unknown): string {
  return error instanceof Error ? error.message.toLowerCase() : '';
}

export class RivalryController {
  async getRivalries(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = (req as any).user?.id;
      const list = await rivalryService.getRivalries(currentUserId);
      res.json({ success: true, data: list });
    } catch {
      res.status(500).json({ success: false, error: 'Rivalry data is temporarily unavailable.' });
    }
  }

  async getRivalryWithUser(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = (req as any).user?.id;
      const rivalUserId = req.params.rivalUserId as string;
      const detail = await rivalryService.getRivalryWithUser(currentUserId, rivalUserId);
      res.json({ success: true, data: detail });
    } catch (err: unknown) {
      const message = normalizeError(err);
      const status = message.includes('not found')
        ? 404
        : message.includes('private') || message.includes('not accessible')
          ? 403
          : message.includes('oneself')
            ? 400
            : 500;
      res.status(status).json({
        success: false,
        error: status === 404
          ? 'Rival not found.'
          : status === 403
            ? 'This rivalry is not accessible.'
            : status === 400
              ? 'You cannot view a rivalry with yourself.'
              : 'Rivalry details are temporarily unavailable.',
      });
    }
  }

  async getRivalryHistory(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = (req as any).user?.id;
      const rivalUserId = req.params.rivalUserId as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const history = await rivalryService.getRivalryHistory(currentUserId, rivalUserId, limit);
      res.json({ success: true, data: history });
    } catch (err: unknown) {
      const message = normalizeError(err);
      const status = message.includes('private') || message.includes('not accessible')
        ? 403
        : message.includes('oneself')
          ? 400
          : 500;
      res.status(status).json({
        success: false,
        error: status === 403
          ? 'This rivalry history is not accessible.'
          : status === 400
            ? 'You cannot view rivalry history with yourself.'
            : 'Rivalry history is temporarily unavailable.',
      });
    }
  }
}

export const rivalryController = new RivalryController();
