import type { Request, Response } from 'express';
import { adminService } from './admin.service.js';
import { auditService } from './audit.service.js';
import { statsService } from '../stats/stats.service.js';

export class AdminController {
  // 1. Overview
  async getOverview(_req: Request, res: Response): Promise<void> {
    try {
      const metrics = await adminService.getOverviewMetrics();
      res.json({ success: true, data: metrics });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to load platform overview.' });
    }
  }

  // 2. Users
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const search = req.query.search as string | undefined;
      const status = req.query.status as string | undefined;
      const role = req.query.role as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const users = await adminService.listUsers({ search, status, role, limit, offset });
      res.json({ success: true, data: users });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to list users.' });
    }
  }

  async getUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.params.userId as string;
      const details = await adminService.getUserDetails(userId);
      res.json({ success: true, data: details });
    } catch (err: any) {
      const status = err.message?.includes('not found') ? 404 : 400;
      res.status(status).json({ success: false, error: err.message || 'Failed to fetch user details.' });
    }
  }

  async updateUserStatus(req: Request, res: Response): Promise<void> {
    try {
      const targetUserId = req.params.userId as string;
      const moderatorUserId = (req as any).user?.id;
      const { status, reason } = req.body;

      if (!['ACTIVE', 'SUSPENDED'].includes(status)) {
        res.status(400).json({ success: false, error: 'Status must be ACTIVE or SUSPENDED.' });
        return;
      }

      const updated = await adminService.updateUserStatus(
        targetUserId,
        status,
        reason,
        moderatorUserId,
        req.app.get('io')
      );
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to update user status.' });
    }
  }

  async assignRole(req: Request, res: Response): Promise<void> {
    try {
      const targetUserId = req.params.userId as string;
      const actorUserId = (req as any).user?.id;
      const { role } = req.body;

      if (!['ADMIN', 'MODERATOR'].includes(role)) {
        res.status(400).json({ success: false, error: 'Role must be ADMIN or MODERATOR.' });
        return;
      }

      const result = await adminService.assignRole(targetUserId, role, actorUserId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to assign role.' });
    }
  }

  async revokeRole(req: Request, res: Response): Promise<void> {
    try {
      const targetUserId = req.params.userId as string;
      const actorUserId = (req as any).user?.id;
      const role = req.params.role as 'ADMIN' | 'MODERATOR';

      const result = await adminService.revokeRole(targetUserId, role, actorUserId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to revoke role.' });
    }
  }

  // 3. Games Configuration
  async getGames(_req: Request, res: Response): Promise<void> {
    try {
      const games = await adminService.listGames();
      res.json({ success: true, data: games });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list games.' });
    }
  }

  async updateGame(req: Request, res: Response): Promise<void> {
    try {
      const gameId = req.params.gameId as string;
      const actorUserId = (req as any).user?.id;
      const { isEnabled, coupleEnabled, friendEnabled, maintenanceMessage } = req.body;

      const updated = await adminService.updateGameConfig(
        gameId,
        { isEnabled, coupleEnabled, friendEnabled, maintenanceMessage },
        actorUserId
      );
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to update game.' });
    }
  }

  // 4. Questions Library
  async getQuestions(req: Request, res: Response): Promise<void> {
    try {
      const gameId = req.query.gameId as string | undefined;
      const category = req.query.category as string | undefined;
      const intensity = req.query.intensity ? parseInt(req.query.intensity as string, 10) : undefined;
      const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
      const cursor = req.query.cursor as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;

      const questions = await adminService.listQuestions({
        gameId,
        category,
        intensity,
        isActive,
        cursor,
        limit,
      });
      res.json({ success: true, data: questions });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to list questions.' });
    }
  }

  async createQuestion(req: Request, res: Response): Promise<void> {
    try {
      const actorUserId = (req as any).user?.id;
      const question = await adminService.createQuestion(req.body, actorUserId);
      res.status(201).json({ success: true, data: question });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to create question.' });
    }
  }

  async updateQuestion(req: Request, res: Response): Promise<void> {
    try {
      const questionId = req.params.questionId as string;
      const actorUserId = (req as any).user?.id;
      const updated = await adminService.updateQuestion(questionId, req.body, actorUserId);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to update question.' });
    }
  }

  async deleteQuestion(req: Request, res: Response): Promise<void> {
    try {
      const questionId = req.params.questionId as string;
      const actorUserId = (req as any).user?.id;
      const updated = await adminService.deleteQuestion(questionId, actorUserId);
      res.json({ success: true, data: updated });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to delete question.' });
    }
  }

  // 5. Audit Logs
  async getAuditLogs(req: Request, res: Response): Promise<void> {
    try {
      const action = req.query.action as string | undefined;
      const actorUserId = req.query.actorUserId as string | undefined;
      const targetType = req.query.targetType as string | undefined;
      const cursor = req.query.cursor as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;

      const logs = await auditService.listAuditLogs({ action, actorUserId, targetType, cursor, limit });
      res.json({ success: true, data: logs });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to list audit logs.' });
    }
  }

  // 6. Reconciliation
  async reconcileStats(req: Request, res: Response): Promise<void> {
    try {
      const targetUserId = req.params.userId as string;
      const result = await statsService.reconcileUserStats(targetUserId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to reconcile stats.' });
    }
  }
}

export const adminController = new AdminController();

