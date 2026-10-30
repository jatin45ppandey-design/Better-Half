import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { gamesController } from './games.controller.js';

export const gamesRouter = Router();

// Protect all game endpoints with Supabase Auth
gamesRouter.use(requireAuth);

gamesRouter.get('/catalog', gamesController.getCatalog);
gamesRouter.post('/rooms/:roomId/start', gamesController.startRoomGame);
gamesRouter.get('/sessions/:sessionId', gamesController.getSession);
gamesRouter.get('/sessions/:sessionId/state', gamesController.getSessionState);
gamesRouter.post('/sessions/:sessionId/rematch', gamesController.rematch);

