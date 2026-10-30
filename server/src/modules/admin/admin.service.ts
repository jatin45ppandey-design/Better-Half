import { prisma } from '../../config/prisma.js';
import { auditService } from './audit.service.js';
import { presenceManager } from '../../socket/presence.js';
import { TRUTH_OR_DARE_ITEMS } from '../../data/questions/truthOrDareQuestions.js';
import { WOULD_YOU_RATHER_ITEMS } from '../../data/questions/wouldYouRatherQuestions.js';
import { BETWEEN_US_QUESTIONS } from '../../data/questions/betweenUsQuestions.js';
import { SERVER_GAMES } from '../games/core/gameRegistry.js';
import { logger } from '../../utils/logger.js';

export interface UserFilterOptions {
  search?: string;
  status?: string;
  role?: string;
  limit?: number;
  offset?: number;
}

export interface QuestionFilterOptions {
  gameId?: string;
  category?: string;
  intensity?: number;
  isActive?: boolean;
  limit?: number;
  cursor?: string;
}

export class AdminService {
  // -------------------------------------------------------------
  // 1. Platform Overview Metrics
  // -------------------------------------------------------------
  async getOverviewMetrics() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      suspendedUsers,
      activeRooms,
      activeGameSessions,
      totalCompletedMatches,
      completedMatchesToday,
      enabledGames,
      totalQuestions,
    ] = await Promise.all([
      prisma.userProfile.count(),
      prisma.userProfile.count({ where: { accountStatus: 'SUSPENDED' } }),
      prisma.room.count({
        where: { status: { in: ['WAITING', 'READY_TO_START', 'IN_PROGRESS'] } },
      }),
      prisma.gameSession.count({ where: { status: 'ACTIVE' } }),
      prisma.match.count(),
      prisma.match.count({ where: { completedAt: { gte: startOfToday } } }),
      prisma.gameConfiguration.count({ where: { isEnabled: true } }),
      prisma.questionEntry.count({ where: { isActive: true } }),
    ]);

    // Active users in last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeUsers = await prisma.userProfile.count({
      where: { updatedAt: { gte: sevenDaysAgo } },
    });

    return {
      totalUsers,
      activeUsers,
      suspendedUsers,
      activeRooms,
      activeGameSessions,
      totalCompletedMatches,
      completedMatchesToday,
      enabledGames,
      totalQuestions,
      serviceHealth: 'OPERATIONAL',
      serverTimestamp: new Date().toISOString(),
    };
  }

  // -------------------------------------------------------------
  // 2. User Management & Moderation
  // -------------------------------------------------------------
  async listUsers(options: UserFilterOptions = {}) {
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);
    const offset = Math.max(options.offset || 0, 0);

    const where: any = {};
    if (options.status) {
      where.accountStatus = options.status.toUpperCase();
    }
    if (options.search) {
      where.OR = [
        { username: { contains: options.search, mode: 'insensitive' } },
        { displayName: { contains: options.search, mode: 'insensitive' } },
      ];
    }
    if (options.role) {
      where.roles = { some: { role: options.role.toUpperCase() } };
    }

    const [users, totalCount] = await Promise.all([
      prisma.userProfile.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
        include: {
          roles: { select: { role: true, createdAt: true } },
          _count: {
            select: {
              matchParticipations: true,
              hostedRooms: true,
            },
          },
        },
      }),
      prisma.userProfile.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        avatarColor: u.avatarColor,
        avatarInitials: u.avatarInitials,
        accountStatus: u.accountStatus,
        roles: u.roles.map((r) => r.role),
        matchesPlayed: u._count.matchParticipations,
        roomsHosted: u._count.hostedRooms,
        createdAt: u.createdAt,
      })),
      totalCount,
      limit,
      offset,
    };
  }

  async getUserDetails(userId: string) {
    const user = await prisma.userProfile.findUnique({
      where: { id: userId },
      include: {
        roles: true,
        moderations: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            moderator: {
              select: { id: true, displayName: true, username: true },
            },
          },
        },
        _count: {
          select: {
            matchParticipations: true,
            matchesWon: true,
            friendships: true,
          },
        },
      },
    });

    if (!user) throw new Error('User not found.');
    return user;
  }

  async updateUserStatus(
    targetUserId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    reason: string | undefined,
    moderatorUserId: string,
    io?: any
  ) {
    if (targetUserId === moderatorUserId) {
      throw new Error('Administrators cannot moderate their own account.');
    }

    const targetUser = await prisma.userProfile.findUnique({
      where: { id: targetUserId },
      include: { roles: true },
    });

    if (!targetUser) throw new Error('Target user not found.');

    // Protect last active administrator from being suspended
    const isTargetAdmin = targetUser.roles.some((r) => r.role === 'ADMIN');
    if (isTargetAdmin && status === 'SUSPENDED') {
      const activeAdminCount = await prisma.appRole.count({
        where: {
          role: 'ADMIN',
          user: { accountStatus: 'ACTIVE' },
        },
      });

      if (activeAdminCount <= 1) {
        throw new Error('Cannot suspend the last active administrator.');
      }
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.userProfile.update({
        where: { id: targetUserId },
        data: { accountStatus: status },
      });

      await tx.userModeration.create({
        data: {
          userId: targetUserId,
          status,
          reason: reason || null,
          moderatorId: moderatorUserId,
        },
      });

      return user;
    });

    // Write immutable audit log
    await auditService.logAction(
      moderatorUserId,
      status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REINSTATED',
      'USER',
      targetUserId,
      { reason, previousStatus: targetUser.accountStatus, newStatus: status }
    );

    // If suspended, actively disconnect any live sockets
    if (status === 'SUSPENDED') {
      const socketIds = presenceManager.getUserSockets(targetUserId);
      if (io && socketIds.length > 0) {
        socketIds.forEach((sId) => {
          const s = io.sockets.sockets.get(sId);
          if (s) {
            s.emit('room:error', { code: 'ACCOUNT_SUSPENDED', message: 'Account has been suspended.' });
            s.disconnect(true);
          }
        });
      }
    }

    return updatedUser;
  }

  async assignRole(targetUserId: string, role: 'ADMIN' | 'MODERATOR', actorUserId: string) {
    const user = await prisma.userProfile.findUnique({ where: { id: targetUserId } });
    if (!user) throw new Error('Target user not found.');

    const newRole = await prisma.appRole.upsert({
      where: {
        userId_role: {
          userId: targetUserId,
          role,
        },
      },
      update: {},
      create: {
        userId: targetUserId,
        role,
        assignedBy: actorUserId,
      },
    });

    await auditService.logAction(actorUserId, 'ROLE_GRANTED', 'USER', targetUserId, { role });
    return newRole;
  }

  async revokeRole(targetUserId: string, role: 'ADMIN' | 'MODERATOR', actorUserId: string) {
    if (role === 'ADMIN') {
      const adminCount = await prisma.appRole.count({
        where: { role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        throw new Error('Cannot revoke role from the last active administrator.');
      }
    }

    await prisma.appRole.deleteMany({
      where: {
        userId: targetUserId,
        role,
      },
    });

    await auditService.logAction(actorUserId, 'ROLE_REVOKED', 'USER', targetUserId, { role });
    return { success: true };
  }

  // -------------------------------------------------------------
  // 3. Game Availability Management
  // -------------------------------------------------------------
  async seedInitialGameConfigs() {
    for (const [gameId, def] of Object.entries(SERVER_GAMES)) {
      const isCoupleOnly = def.modes.length === 1 && def.modes[0] === 'couple';
      await prisma.gameConfiguration.upsert({
        where: { gameId },
        update: {},
        create: {
          gameId,
          isEnabled: true,
          coupleEnabled: def.modes.includes('couple'),
          friendEnabled: !isCoupleOnly && def.modes.includes('friend'),
          maintenanceMessage: null,
        },
      });
    }
  }

  async listGames() {
    await this.seedInitialGameConfigs();
    return prisma.gameConfiguration.findMany({
      orderBy: { gameId: 'asc' },
    });
  }

  async updateGameConfig(
    gameId: string,
    data: {
      isEnabled?: boolean;
      coupleEnabled?: boolean;
      friendEnabled?: boolean;
      maintenanceMessage?: string | null;
    },
    actorUserId: string
  ) {
    const def = SERVER_GAMES[gameId];
    if (!def) {
      throw new Error(`Unknown game ID: ${gameId}`);
    }

    // Couple-only validation
    const isCoupleOnly = def.modes.length === 1 && def.modes[0] === 'couple';
    if (isCoupleOnly && data.friendEnabled === true) {
      throw new Error(`Game "${def.name}" is strictly Couple-only and cannot be enabled in Friend Mode.`);
    }

    const updated = await prisma.gameConfiguration.upsert({
      where: { gameId },
      update: {
        ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
        ...(data.coupleEnabled !== undefined ? { coupleEnabled: data.coupleEnabled } : {}),
        ...(data.friendEnabled !== undefined ? { friendEnabled: data.friendEnabled } : {}),
        ...(data.maintenanceMessage !== undefined ? { maintenanceMessage: data.maintenanceMessage } : {}),
        updatedBy: actorUserId,
      },
      create: {
        gameId,
        isEnabled: data.isEnabled ?? true,
        coupleEnabled: data.coupleEnabled ?? def.modes.includes('couple'),
        friendEnabled: isCoupleOnly ? false : (data.friendEnabled ?? def.modes.includes('friend')),
        maintenanceMessage: data.maintenanceMessage || null,
        updatedBy: actorUserId,
      },
    });

    await auditService.logAction(actorUserId, 'GAME_CONFIG_UPDATED', 'GAME', gameId, data);
    return updated;
  }

  async isGameEnabledForMode(gameId: string, mode: 'couple' | 'friend'): Promise<boolean> {
    try {
      const config = await prisma.gameConfiguration.findUnique({
        where: { gameId },
      });
      if (!config) return true;
      if (!config.isEnabled) return false;
      return mode === 'couple' ? config.coupleEnabled : config.friendEnabled;
    } catch {
      return true;
    }
  }

  // -------------------------------------------------------------
  // 4. Question Library Management
  // -------------------------------------------------------------
  async seedQuestionLibrary() {
    try {
      // 1. Seed Truth or Dare
      for (const item of TRUTH_OR_DARE_ITEMS) {
        const sourceKey = `tod-${item.id}`;
        const intensityNum = item.intensity === 'Soft' ? 1 : item.intensity === 'Spicy' ? 2 : 3;
        await prisma.questionEntry.upsert({
          where: { sourceKey },
          update: {},
          create: {
            gameId: 'truth-or-dare',
            sourceKey,
            prompt: item.text,
            questionType: item.type.toUpperCase(),
            category: item.category,
            intensity: intensityNum,
            isActive: true,
          },
        });
      }

      // 2. Seed Would You Rather
      for (const item of WOULD_YOU_RATHER_ITEMS) {
        const sourceKey = `wyr-${item.id}`;
        await prisma.questionEntry.upsert({
          where: { sourceKey },
          update: {},
          create: {
            gameId: 'would-you-rather',
            sourceKey,
            prompt: `${item.optionA} OR ${item.optionB}`,
            optionA: item.optionA,
            optionB: item.optionB,
            category: item.category,
            isActive: true,
          },
        });
      }

      // 3. Seed BETWEEN US
      for (const item of BETWEEN_US_QUESTIONS) {
        const sourceKey = `bu-${item.id}`;
        await prisma.questionEntry.upsert({
          where: { sourceKey },
          update: {},
          create: {
            gameId: 'between-us',
            sourceKey,
            prompt: item.prompt,
            category: item.category,
            intensity: item.intensity,
            isActive: true,
          },
        });
      }
    } catch (err: any) {
      logger.warn(`Question library seed non-blocking error: ${err?.message || err}`);
    }
  }

  async listQuestions(options: QuestionFilterOptions = {}) {
    const limit = Math.min(Math.max(options.limit || 20, 1), 100);

    const where: any = {};
    if (options.gameId) where.gameId = options.gameId;
    if (options.category) where.category = options.category;
    if (options.intensity) where.intensity = options.intensity;
    if (options.isActive !== undefined) where.isActive = options.isActive;

    const [items, totalCount] = await Promise.all([
      prisma.questionEntry.findMany({
        where,
        take: limit + 1,
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.questionEntry.count({ where }),
    ]);

    const hasMore = items.length > limit;
    const questions = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? questions[questions.length - 1].id : null;

    return {
      questions,
      totalCount,
      nextCursor,
      hasMore,
    };
  }

  async createQuestion(
    data: {
      gameId: string;
      prompt: string;
      questionType?: 'TRUTH' | 'DARE';
      optionA?: string;
      optionB?: string;
      category?: string;
      intensity?: number;
    },
    actorUserId: string
  ) {
    if (!data.gameId || !data.prompt) {
      throw new Error('Game ID and prompt are required.');
    }

    if (data.gameId === 'would-you-rather') {
      if (!data.optionA || !data.optionB) {
        throw new Error('Would You Rather questions require both Option A and Option B.');
      }
    }

    if (data.gameId === 'truth-or-dare') {
      if (!data.questionType || !['TRUTH', 'DARE'].includes(data.questionType)) {
        throw new Error('Truth or Dare questions must specify questionType as either TRUTH or DARE.');
      }
    }

    const sourceKey = `custom-${data.gameId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const question = await prisma.questionEntry.create({
      data: {
        gameId: data.gameId,
        sourceKey,
        prompt: data.prompt,
        questionType: data.questionType || null,
        optionA: data.optionA || null,
        optionB: data.optionB || null,
        category: data.category || null,
        intensity: data.intensity || null,
        isActive: true,
        createdBy: actorUserId,
      },
    });

    await auditService.logAction(actorUserId, 'QUESTION_CREATED', 'QUESTION', question.id, {
      gameId: data.gameId,
      category: data.category,
    });

    return question;
  }

  async updateQuestion(
    questionId: string,
    data: {
      prompt?: string;
      questionType?: 'TRUTH' | 'DARE';
      optionA?: string;
      optionB?: string;
      category?: string;
      intensity?: number;
      isActive?: boolean;
    },
    actorUserId: string
  ) {
    const question = await prisma.questionEntry.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new Error('Question not found.');

    const updated = await prisma.questionEntry.update({
      where: { id: questionId },
      data: {
        ...(data.prompt !== undefined ? { prompt: data.prompt } : {}),
        ...(data.questionType !== undefined ? { questionType: data.questionType } : {}),
        ...(data.optionA !== undefined ? { optionA: data.optionA } : {}),
        ...(data.optionB !== undefined ? { optionB: data.optionB } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.intensity !== undefined ? { intensity: data.intensity } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedBy: actorUserId,
      },
    });

    await auditService.logAction(actorUserId, 'QUESTION_UPDATED', 'QUESTION', questionId, data);
    return updated;
  }

  async deleteQuestion(questionId: string, actorUserId: string) {
    const question = await prisma.questionEntry.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new Error('Question not found.');

    // Soft delete by disabling
    const updated = await prisma.questionEntry.update({
      where: { id: questionId },
      data: { isActive: false, updatedBy: actorUserId },
    });

    await auditService.logAction(actorUserId, 'QUESTION_DISABLED', 'QUESTION', questionId, {
      gameId: question.gameId,
    });

    return updated;
  }
}

export const adminService = new AdminService();
