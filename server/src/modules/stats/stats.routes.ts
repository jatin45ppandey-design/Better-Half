import { Router } from 'express';
import { statsController } from './stats.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/me', (req, res) => statsController.getMyStats(req, res));
router.get('/me/games', (req, res) => statsController.getMyGames(req, res));
router.get('/me/recent', (req, res) => statsController.getMyRecent(req, res));

router.get('/users/:userId', (req, res) => statsController.getUserStats(req, res));
router.get('/users/:userId/games', (req, res) => statsController.getUserGames(req, res));

export const statsRouter = router;

