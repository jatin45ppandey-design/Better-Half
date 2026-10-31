import { Router } from 'express';
import { adminController } from './admin.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireAdmin, requireModerator } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { adminLimiter } from '../../middleware/rateLimiter.js';
import {
  updateUserStatusSchema,
  assignRoleSchema,
  updateGameConfigSchema,
  createQuestionSchema,
  updateQuestionSchema,
} from './admin.schema.js';

const router = Router();

router.use(requireAuth);
router.use(adminLimiter);

// 1. Overview (Admin & Moderator)
router.get('/overview', requireModerator, (req, res) => adminController.getOverview(req, res));

// 2. User Management
router.get('/users', requireModerator, (req, res) => adminController.getUsers(req, res));
router.get('/users/:userId', requireModerator, (req, res) => adminController.getUser(req, res));
router.patch(
  '/users/:userId/status',
  requireModerator,
  validate(updateUserStatusSchema),
  (req, res) => adminController.updateUserStatus(req, res)
);

// 3. Role Management (Admin only)
router.post(
  '/users/:userId/roles',
  requireAdmin,
  validate(assignRoleSchema),
  (req, res) => adminController.assignRole(req, res)
);
router.delete(
  '/users/:userId/roles/:role',
  requireAdmin,
  (req, res) => adminController.revokeRole(req, res)
);

// 4. Game Configuration (Admin only)
router.get('/games', requireAdmin, (req, res) => adminController.getGames(req, res));
router.patch(
  '/games/:gameId',
  requireAdmin,
  validate(updateGameConfigSchema),
  (req, res) => adminController.updateGame(req, res)
);

// 5. Question Library (Admin only)
router.get('/questions', requireAdmin, (req, res) => adminController.getQuestions(req, res));
router.post(
  '/questions',
  requireAdmin,
  validate(createQuestionSchema),
  (req, res) => adminController.createQuestion(req, res)
);
router.patch(
  '/questions/:questionId',
  requireAdmin,
  validate(updateQuestionSchema),
  (req, res) => adminController.updateQuestion(req, res)
);
router.delete(
  '/questions/:questionId',
  requireAdmin,
  (req, res) => adminController.deleteQuestion(req, res)
);

// 6. Audit Logs (Admin only)
router.get('/audit-logs', requireAdmin, (req, res) => adminController.getAuditLogs(req, res));

// 7. Statistics Reconciliation (Admin only)
router.post('/reconcile/:userId', requireAdmin, (req, res) => adminController.reconcileStats(req, res));

export const adminRouter = router;
