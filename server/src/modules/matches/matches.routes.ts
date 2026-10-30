import { Router } from 'express';
import { matchesController } from './matches.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/history', (req, res) => matchesController.getHistory(req, res));
router.get('/:matchId', (req, res) => matchesController.getMatch(req, res));

export const matchesRouter = router;

