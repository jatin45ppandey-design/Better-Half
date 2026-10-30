import type { Request, Response } from 'express';
import { gameSessionService } from './core/gameSession.service.js';
import { gameStateService } from './core/gameState.service.js';
import { adminService } from '../admin/admin.service.js';
import { AppError } from '../../utils/errors.js';

export const gamesController = {
  async getCatalog(_req: Request, res: Response) {
    try {
      const configs = await adminService.listGames();
      const catalog = configs.map((c) => ({
        gameId: c.gameId,
        isEnabled: c.isEnabled,
        coupleEnabled: c.coupleEnabled,
        friendEnabled: c.friendEnabled,
        maintenanceMessage: c.maintenanceMessage,
      }));
      return res.json({ success: true, data: catalog });
    } catch {
      return res.status(503).json({
        success: false,
        error: 'Game catalog is temporarily unavailable.',
      });
    }
  },
  async startRoomGame(req: Request, res: Response) {
    try {
      const roomId = req.params.roomId as string;
      const { gameId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { session, roomCode } = await gameSessionService.createSession(
        roomId,
        gameId,
        userId
      );

      const publicState = gameStateService.getPublicProjection(session.sessionId);
      const userPrivateState = gameStateService.getPrivateProjection(session.sessionId, userId);

      return res.status(201).json({
        sessionId: session.sessionId,
        roomCode,
        gameId: session.gameId,
        mode: session.mode,
        publicState,
        privateState: userPrivateState,
      });
    } catch (err: unknown) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Unable to start the game session.' });
    }
  },

  async getSession(req: Request, res: Response) {
    try {
      const sessionId = req.params.sessionId as string;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const session = await gameSessionService.getOrRestoreSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Game session not found' });
      }

      if (!gameStateService.getSessionForParticipant(sessionId, userId)) {
        return res.status(403).json({ error: 'Not a participant of this game session' });
      }

      const publicState = gameStateService.getPublicProjection(sessionId);
      const privateState = gameStateService.getPrivateProjection(sessionId, userId);

      return res.status(200).json({
        sessionId: session.sessionId,
        gameId: session.gameId,
        mode: session.mode,
        publicState,
        privateState,
      });
    } catch {
      return res.status(500).json({ error: 'Game session is temporarily unavailable.' });
    }
  },

  async getSessionState(req: Request, res: Response) {
    try {
      const sessionId = req.params.sessionId as string;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const session = await gameSessionService.getOrRestoreSession(sessionId);
      if (!session) return res.status(404).json({ error: 'Game session not found' });

      if (!gameStateService.getSessionForParticipant(sessionId, userId)) {
        return res.status(403).json({ error: 'Not a participant of this game session' });
      }

      const publicState = gameStateService.getPublicProjection(sessionId);
      if (!publicState) return res.status(404).json({ error: 'Game session not found' });

      const privateState = gameStateService.getPrivateProjection(sessionId, userId);
      return res.status(200).json({ sessionId, publicState, privateState });
    } catch {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Unable to retrieve game session state.',
      });
    }
  },

  async rematch(req: Request, res: Response) {
    try {
      const sessionId = req.params.sessionId as string;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const newSession = await gameSessionService.rematchSession(sessionId, userId);
      const publicState = gameStateService.getPublicProjection(newSession.sessionId);
      const privateState = gameStateService.getPrivateProjection(newSession.sessionId, userId);

      return res.status(201).json({
        sessionId: newSession.sessionId,
        gameId: newSession.gameId,
        mode: newSession.mode,
        publicState,
        privateState,
      });
    } catch (err: unknown) {
      if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      return res.status(500).json({ error: 'Unable to initialize the rematch.' });
    }
  },
};
