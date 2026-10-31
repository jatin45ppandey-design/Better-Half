import { prisma } from '../../config/prisma.js';
import { auditService } from './audit.service.js';
import { presenceManager } from '../../socket/presence.js';
import { roomsService } from '../rooms/rooms.service.js';
import { TRUTH_OR_DARE_ITEMS } from '../../data/questions/truthOrDareQuestions.js';
import { WOULD_YOU_RATHER_ITEMS } from '../../data/questions/wouldYouRatherQuestions.js';
import { BETWEEN_US_QUESTIONS } from '../../data/questions/betweenUsQuestions.js';
import { SERVER_GAMES } from '../games/core/gameRegistry.js';

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

    // Weekly active players in last 7 days (distinct match or room participants)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [matchParticipants7d, roomParticipants7d, recentlyActiveProfiles] = await Promise.all([
      prisma.matchParticipant.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.roomParticipant.findMany({
        where: { joinedAt: { gte: sevenDaysAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      prisma.userProfile.count({
        where: { updatedAt: { gte: sevenDaysAgo } },
      }),
    ]);

    const activePlayerIds = new Set([
      ...matchParticipants7d.map((p) => p.userId),
      ...roomParticipants7d.map((p) => p.userId),
    ]);
    const weeklyActivePlayers = activePlayerIds.size;

    // Determine actual database and service health
    let serviceHealth: 'OPERATIONAL' | 'DEGRADED' | 'DOWN' = 'OPERATIONAL';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      serviceHealth = 'DEGRADED';
    }

    return {
      totalUsers,
      activeUsers: weeklyActivePlayers, // Genuine weekly active players based on match/room telemetry
      weeklyActivePlayers,
      recentlyActiveProfiles,
      onlineUsers: presenceManager.getOnlineCount(),
      suspendedUsers,
      activeRooms,
      activeGameSessions,
      totalCompletedMatches,
      completedMatchesToday,
      enabledGames,
      totalQuestions,
      serviceHealth,
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

    const isTargetAdmin = targetUser.roles.some((r) => r.role === 'ADMIN');

    const updatedUser = await prisma.$transaction(async (tx) => {
      // Protect last active administrator from being suspended (transactional race guard)
      if (isTargetAdmin && status === 'SUSPENDED') {
        if (typeof (tx as any).$queryRaw === 'function') await (tx as any).$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "AppRole" WHERE "role" = 'ADMIN' FOR UPDATE`;

        const activeAdminCount = await tx.appRole.count({
          where: {
            role: 'ADMIN',
            user: { accountStatus: 'ACTIVE' },
          },
        });

        if (activeAdminCount <= 1) {
          throw new Error('Cannot suspend the last active administrator.');
        }
      }

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

      // Write immutable audit log within the same transaction
      await auditService.logAction(
        moderatorUserId,
        status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REINSTATED',
        'USER',
        targetUserId,
        { reason, previousStatus: targetUser.accountStatus, newStatus: status },
        tx
      );

      return user;
    });

    // If suspended, actively disconnect any live sockets and handle room lifecycle
    if (status === 'SUSPENDED') {
      try {
        await roomsService.handleUserSuspension(targetUserId);
      } catch (err) {
        console.warn('[Admin] Failed to handle room lifecycle on suspension:', err);
      }

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

    return prisma.$transaction(async (tx) => {
      const newRole = await tx.appRole.upsert({
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

      await auditService.logAction(actorUserId, 'ROLE_GRANTED', 'USER', targetUserId, { role }, tx);
      return newRole;
    });
  }

  async revokeRole(targetUserId: string, role: 'ADMIN' | 'MODERATOR', actorUserId: string) {
    return prisma.$transaction(async (tx) => {
      if (role === 'ADMIN') {
        // Lock ADMIN role records to serialize concurrent role modifications and protect last admin
        if (typeof (tx as any).$queryRaw === 'function') await (tx as any).$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "AppRole" WHERE "role" = 'ADMIN' FOR UPDATE`;

        const activeAdminCount = await tx.appRole.count({
          where: {
            role: 'ADMIN',
            user: { accountStatus: { not: 'SUSPENDED' } },
          },
        });
        if (activeAdminCount <= 1) {
          throw new Error('Cannot revoke role from the last active administrator.');
        }
      }

      const deleted = await tx.appRole.deleteMany({
        where: {
          userId: targetUserId,
          role,
        },
      });

      if (deleted.count === 0) {
        throw new Error('Role record not found for user.');
      }

      await auditService.logAction(actorUserId, 'ROLE_REVOKED', 'USER', targetUserId, { role }, tx);
      return { success: true };
    });
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

    const updated = await prisma.$transaction(async (tx) => {
      const rec = await tx.gameConfiguration.upsert({
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

      await auditService.logAction(actorUserId, 'GAME_CONFIG_UPDATED', 'GAME', gameId, data, tx);
      return rec;
    });
    return updated;
  }

  async isGameEnabledForMode(gameId: string, mode: 'couple' | 'friend'): Promise<boolean> {
    const config = await prisma.gameConfiguration.findUnique({
      where: { gameId },
    });
    if (!config) return true;
    if (!config.isEnabled) return false;
    return mode === 'couple' ? config.coupleEnabled : config.friendEnabled;
  }

  // -------------------------------------------------------------
  // 4. Question Library Management
  // -------------------------------------------------------------
  async seedQuestionLibrary() {
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

    if (data.gameId === 'blind-ranking') {
      throw new Error('Blind Ranking content is curated static items and is not managed through question entries.');
    }

    const SUPPORTED_QUESTION_GAMES = ['truth-or-dare', 'would-you-rather', 'between-us'];
    if (!SUPPORTED_QUESTION_GAMES.includes(data.gameId)) {
      throw new Error(`Game "${data.gameId}" does not support custom question entries.`);
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

    const question = await prisma.$transaction(async (tx) => {
      const q = await tx.questionEntry.create({
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

      await auditService.logAction(actorUserId, 'QUESTION_CREATED', 'QUESTION', q.id, {
        gameId: data.gameId,
        category: data.category,
      }, tx);

      return q;
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

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.questionEntry.update({
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

      await auditService.logAction(actorUserId, 'QUESTION_UPDATED', 'QUESTION', questionId, data, tx);
      return q;
    });
    return updated;
  }

  async deleteQuestion(questionId: string, actorUserId: string) {
    const question = await prisma.questionEntry.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new Error('Question not found.');

    // Soft delete by disabling within the same transaction as audit log
    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.questionEntry.update({
        where: { id: questionId },
        data: { isActive: false, updatedBy: actorUserId },
      });

      await auditService.logAction(actorUserId, 'QUESTION_DISABLED', 'QUESTION', questionId, {
        gameId: question.gameId,
      }, tx);
      return q;
    });

    return updated;
  }
}

export const adminService = new AdminService();
