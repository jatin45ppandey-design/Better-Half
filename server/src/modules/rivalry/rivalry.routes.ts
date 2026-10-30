import { Router } from 'express';
import { rivalryController } from './rivalry.controller.js';
import { requireAuth } from '../../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => rivalryController.getRivalries(req, res));
router.get('/:rivalUserId', (req, res) => rivalryController.getRivalryWithUser(req, res));
router.get('/:rivalUserId/history', (req, res) => rivalryController.getRivalryHistory(req, res));

export const rivalryRouter = router;

