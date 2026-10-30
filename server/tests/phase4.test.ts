import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { evaluateGameResult } from '../src/modules/games/match/resultPolicies.js';
import { matchFinalizationService } from '../src/modules/games/match/matchFinalization.service.js';
import { statsService } from '../src/modules/stats/stats.service.js';
import { matchesService } from '../src/modules/matches/matches.service.js';
import { rivalryService } from '../src/modules/rivalry/rivalry.service.js';
import { adminService } from '../src/modules/admin/admin.service.js';
import { gamesController } from '../src/modules/games/games.controller.js';
import { auditService } from '../src/modules/admin/audit.service.js';
import type { GameEngineContext } from '../src/modules/games/core/gameEngine.types.js';

describe('PlaySpace Phase 4 — Match History, Stats, Rivalry, RBAC & Admin Suite', () => {
  let app: any;
  let server: http.Server;
  let serverPort: number;

  const adminUser = {
    id: 'user-admin-uuid-1',
    username: 'admin_boss',
    displayName: 'Admin Boss',
    accountStatus: 'ACTIVE',
  };

  const moderatorUser = {
    id: 'user-mod-uuid-1',
    username: 'moderator_jordan',
    displayName: 'Mod Jordan',
    accountStatus: 'ACTIVE',
  };

  const normalUserA = {
    id: 'user-player-uuid-a',
    username: 'alex_gamer',
    displayName: 'Alex Gamer',
    accountStatus: 'ACTIVE',
  };

  const normalUserB = {
    id: 'user-player-uuid-b',
    username: 'taylor_gamer',
    displayName: 'Taylor Gamer',
    accountStatus: 'ACTIVE',
  };

  const suspendedUser = {
    id: 'user-suspended-uuid-1',
    username: 'bad_actor',
    displayName: 'Bad Actor',
    accountStatus: 'SUSPENDED',
  };

  const adminToken = 'test-mock-token-user-admin-uuid-1';
  const modToken = 'test-mock-token-user-mod-uuid-1';
  const playerAToken = 'test-mock-token-user-player-uuid-a';
  const playerBToken = 'test-mock-token-user-player-uuid-b';
  const suspendedToken = 'test-mock-token-user-suspended-uuid-1';

  beforeAll(async () => {
    app = createApp();
    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      if (server?.listening) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Result Policies & Match Evaluation
  // =========================================================================
  describe('Game-Specific Result Policies', () => {
    it('evaluates basketball rivalry competitively: highest score wins', () => {
      const context: GameEngineContext = {
        sessionId: 'sess-bball-1',
        gameId: 'basketball-rivalry',
        mode: 'couple',
        participants: [
          { userId: normalUserA.id, name: normalUserA.displayName, seatIndex: 0 },
          { userId: normalUserB.id, name: normalUserB.displayName, seatIndex: 1 },
        ],
        state: { round: 5 },
        privateStates: {},
        version: 10,
        isPaused: false,
        status: 'COMPLETED',
        scores: {
          [normalUserA.id]: 12,
          [normalUserB.id]: 8,
        },
      };

      const result = evaluateGameResult(context);
      expect(result.resultType).toBe('COMPETITIVE');
      expect(result.winnerUserId).toBe(normalUserA.id);
      expect(result.participants[0].userId).toBe(normalUserA.id);
      expect(result.participants[0].isWinner).toBe(true);
      expect(result.participants[0].outcome).toBe('WIN');
      expect(result.participants[1].outcome).toBe('LOSS');
    });

    it('evaluates aloo golf competitively: LOWEST total strokes wins', () => {
      const context: GameEngineContext = {
        sessionId: 'sess-golf-1',
        gameId: 'aloo-golf',
        mode: 'couple',
        participants: [
          { userId: normalUserA.id, name: normalUserA.displayName, seatIndex: 0 },
          { userId: normalUserB.id, name: normalUserB.displayName, seatIndex: 1 },
        ],
        state: { totalHoles: 3 },
        privateStates: {},
        version: 8,
        isPaused: false,
        status: 'COMPLETED',
        scores: {
          [normalUserA.id]: 7, // 7 strokes -> Better!
          [normalUserB.id]: 11, // 11 strokes -> Worse!
        },
      };

      const result = evaluateGameResult(context);
      expect(result.resultType).toBe('COMPETITIVE');
      expect(result.winnerUserId).toBe(normalUserA.id); // Lowest strokes wins!
      expect(result.participants[0].userId).toBe(normalUserA.id);
      expect(result.participants[0].isWinner).toBe(true);
      expect(result.participants[0].placement).toBe(1);
      expect(result.participants[1].placement).toBe(2);
      expect(result.participants[1].outcome).toBe('LOSS');
    });

    it('evaluates cooperative games (Truth or Dare, Would You Rather, BETWEEN US) honestly without winner/loser', () => {
      const context: GameEngineContext = {
        sessionId: 'sess-coop-1',
        gameId: 'between-us',
        mode: 'couple',
        participants: [
          { userId: normalUserA.id, name: normalUserA.displayName, seatIndex: 0 },
          { userId: normalUserB.id, name: normalUserB.displayName, seatIndex: 1 },
        ],
        state: { round: 5 },
        privateStates: {},
        version: 5,
        isPaused: false,
        status: 'COMPLETED',
        scores: { [normalUserA.id]: 5, [normalUserB.id]: 5 },
      };

      const result = evaluateGameResult(context);
      expect(result.resultType).toBe('COOPERATIVE');
      expect(result.winnerUserId).toBeNull();
      expect(result.participants[0].outcome).toBe('COMPLETED');
      expect(result.participants[1].outcome).toBe('COMPLETED');
      expect(result.participants[0].isWinner).toBe(false);
      expect(result.participants[1].isWinner).toBe(false);
    });
  });

  // =========================================================================
  // 2. Match Finalization & Idempotency
  // =========================================================================
  describe('Match Finalization & Idempotency', () => {
    it('creates permanent match and participant records without duplicate finalization', async () => {
      const mockMatchRecord = {
        id: 'match-real-123',
        gameSessionId: 'sess-final-1',
        roomId: 'room-123',
        gameId: 'tic-tac-toe',
        mode: 'COUPLE',
        resultType: 'COMPETITIVE',
        winnerUserId: normalUserA.id,
        startedAt: new Date(Date.now() - 300000),
        completedAt: new Date(),
        durationSeconds: 300,
        roundsPlayed: 3,
        resultSummary: { scores: { [normalUserA.id]: 2, [normalUserB.id]: 1 } },
        participants: [
          {
            id: 'mp-1',
            matchId: 'match-real-123',
            userId: normalUserA.id,
            playerNameSnapshot: normalUserA.displayName,
            usernameSnapshot: normalUserA.username,
            avatarUrlSnapshot: null,
            scoreValue: 2,
            scoreLabel: '2 pts',
            placement: 1,
            outcome: 'WIN',
            isWinner: true,
          },
          {
            id: 'mp-2',
            matchId: 'match-real-123',
            userId: normalUserB.id,
            playerNameSnapshot: normalUserB.displayName,
            usernameSnapshot: normalUserB.username,
            avatarUrlSnapshot: null,
            scoreValue: 1,
            scoreLabel: '1 pts',
            placement: 2,
            outcome: 'LOSS',
            isWinner: false,
          },
        ],
      };

      // Mock findUnique to simulate existing match on second call
      const findSpy = vi.spyOn(prisma.match, 'findUnique');
      findSpy.mockResolvedValueOnce(null as any); // First call: does not exist yet

      vi.spyOn(prisma.userProfile, 'findMany').mockResolvedValue([
        { id: normalUserA.id, displayName: normalUserA.displayName, username: normalUserA.username, avatarUrl: null },
        { id: normalUserB.id, displayName: normalUserB.displayName, username: normalUserB.username, avatarUrl: null },
      ] as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          return callback({
            userProfile: {
              findMany: vi.fn().mockResolvedValue([
                { id: normalUserA.id, displayName: normalUserA.displayName, username: normalUserA.username, avatarUrl: null },
                { id: normalUserB.id, displayName: normalUserB.displayName, username: normalUserB.username, avatarUrl: null },
              ]),
            },
            match: {
              findUnique: vi.fn().mockResolvedValue(null),
              create: vi.fn().mockResolvedValue(mockMatchRecord),
            },
            matchParticipant: {
              create: vi.fn().mockResolvedValue({}),
            },
            userGameStats: {
              upsert: vi.fn().mockResolvedValue({}),
            },
            rivalryStats: {
              findUnique: vi.fn().mockResolvedValue(null),
              upsert: vi.fn().mockResolvedValue({}),
            },
          });
        }
        return [{}, {}];
      });

      const context: GameEngineContext = {
        sessionId: 'sess-final-1',
        roomId: 'room-123',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [
          { userId: normalUserA.id, name: normalUserA.displayName, seatIndex: 0 },
          { userId: normalUserB.id, name: normalUserB.displayName, seatIndex: 1 },
        ],
        state: { round: 3 },
        privateStates: {},
        version: 7,
        isPaused: false,
        status: 'COMPLETED',
        winnerUserId: normalUserA.id,
        scores: { [normalUserA.id]: 2, [normalUserB.id]: 1 },
      };

      // First finalization
      const firstFinal = await matchFinalizationService.finalizeMatch(context);
      expect(firstFinal).not.toBeNull();
      expect(firstFinal?.winnerUserId).toBe(normalUserA.id);

      // Second finalization: simulate idempotent return
      findSpy.mockResolvedValueOnce(mockMatchRecord as any);
      const secondFinal = await matchFinalizationService.finalizeMatch(context);
      expect(secondFinal?.matchId).toBe(mockMatchRecord.id);
    });
  });

  // =========================================================================
  // 3. User Statistics & Reconciliation
  // =========================================================================
  describe('User Statistics & Reconciliation', () => {
    it('aggregates total matches, wins, winRate, and streak accurately', async () => {
      vi.spyOn(prisma.userGameStats, 'findMany').mockResolvedValue([
        {
          id: 'ugs-1',
          userId: normalUserA.id,
          gameId: 'basketball-rivalry',
          matchesPlayed: 10,
          wins: 8,
          losses: 2,
          draws: 0,
          cooperativeCompletions: 0,
          lastPlayedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'ugs-2',
          userId: normalUserA.id,
          gameId: 'between-us',
          matchesPlayed: 5,
          wins: 0,
          losses: 0,
          draws: 0,
          cooperativeCompletions: 5,
          lastPlayedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      vi.spyOn(prisma.matchParticipant, 'findMany').mockResolvedValue([
        { outcome: 'WIN' },
        { outcome: 'WIN' },
        { outcome: 'WIN' },
        { outcome: 'LOSS' },
      ] as any);

      const stats = await statsService.getUserStats(normalUserA.id, normalUserA.id);
      expect(stats.totalMatches).toBe(15);
      expect(stats.competitiveMatches).toBe(10);
      expect(stats.wins).toBe(8);
      expect(stats.losses).toBe(2);
      expect(stats.cooperativeCompletions).toBe(5);
      expect(stats.winRate).toBe(80); // 8 / 10 = 80%
      expect(stats.currentStreak).toBe(3); // 3 consecutive wins
      expect(stats.mostPlayedGame).toBe('basketball-rivalry');
    });

    it('enforces privacy setting if user disabled publicMatchHistory', async () => {
      vi.spyOn(prisma.userSettings, 'findUnique').mockResolvedValue({
        id: 'set-1',
        userId: normalUserB.id,
        publicMatchHistory: false, // Private!
      } as any);

      await expect(
        statsService.getUserStats(normalUserB.id, normalUserA.id)
      ).rejects.toThrow('User statistics are private');
    });

    it('reconciles UserGameStats from raw MatchParticipant records', async () => {
      vi.spyOn(prisma.matchParticipant, 'findMany').mockResolvedValue([
        {
          userId: normalUserA.id,
          outcome: 'WIN',
          match: { gameId: 'tic-tac-toe', completedAt: new Date() },
        },
        {
          userId: normalUserA.id,
          outcome: 'WIN',
          match: { gameId: 'tic-tac-toe', completedAt: new Date() },
        },
        {
          userId: normalUserA.id,
          outcome: 'LOSS',
          match: { gameId: 'tic-tac-toe', completedAt: new Date() },
        },
      ] as any);

      const upsertSpy = vi.spyOn(prisma.userGameStats, 'upsert').mockResolvedValue({} as any);
      const res = await statsService.reconcileUserStats(normalUserA.id);
      expect(res.reconciledGames).toBe(1);
      expect(upsertSpy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 4. Rivalry System & Canonical User Ordering
  // =========================================================================
  describe('Rivalry System', () => {
    it('retrieves rivalry using canonical ordering regardless of requester order', async () => {
      const userLowId = normalUserA.id < normalUserB.id ? normalUserA.id : normalUserB.id;
      const userHighId = normalUserA.id < normalUserB.id ? normalUserB.id : normalUserA.id;

      vi.spyOn(prisma.userSettings, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.rivalryStats, 'findUnique').mockResolvedValue({
        id: 'riv-1',
        userLowId,
        userHighId,
        matchesPlayed: 6,
        competitiveMatches: 6,
        userLowWins: 4,
        userHighWins: 2,
        draws: 0,
        cooperativeCompletions: 0,
        currentStreakHolder: userLowId,
        currentStreakCount: 2,
        lastMatchAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(normalUserB as any);
      vi.spyOn(prisma.match, 'findMany').mockResolvedValue([
        { gameId: 'basketball-rivalry' },
        { gameId: 'basketball-rivalry' },
        { gameId: 'tic-tac-toe' },
      ] as any);

      const rivalry = await rivalryService.getRivalryWithUser(normalUserA.id, normalUserB.id);
      expect(rivalry.matchesPlayed).toBe(6);
      expect(rivalry.userWins).toBe(normalUserA.id === userLowId ? 4 : 2);
      expect(rivalry.favoriteGames[0].gameId).toBe('basketball-rivalry');
      expect(rivalry.favoriteGames[0].count).toBe(2);
    });

    it('does not disclose rivalry detail when the rival made match history private', async () => {
      vi.spyOn(prisma.userSettings, 'findUnique').mockResolvedValueOnce({
        userId: normalUserB.id,
        publicMatchHistory: false,
      } as any);
      vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValueOnce(null);

      await expect(
        rivalryService.getRivalryWithUser(normalUserA.id, normalUserB.id)
      ).rejects.toThrow('User statistics are private');
    });

    it('does not disclose rivalry history when either player blocked the other', async () => {
      vi.spyOn(prisma.userSettings, 'findUnique').mockResolvedValueOnce({
        userId: normalUserB.id,
        publicMatchHistory: true,
      } as any);
      vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValueOnce({
        id: 'block-relationship',
      } as any);

      await expect(
        rivalryService.getRivalryHistory(normalUserA.id, normalUserB.id)
      ).rejects.toThrow('User profile is not accessible');
    });

    it('hides rivalries from the list when the rival is private or blocked', async () => {
      const record = {
        id: 'rivalry-hidden',
        userLowId: normalUserA.id < normalUserB.id ? normalUserA.id : normalUserB.id,
        userHighId: normalUserA.id < normalUserB.id ? normalUserB.id : normalUserA.id,
        matchesPlayed: 4,
        competitiveMatches: 4,
        userLowWins: 2,
        userHighWins: 2,
        draws: 0,
        cooperativeCompletions: 0,
        currentStreakHolder: null,
        currentStreakCount: 0,
        lastMatchAt: new Date(),
        userLow: normalUserA.id < normalUserB.id ? normalUserA : normalUserB,
        userHigh: normalUserA.id < normalUserB.id ? normalUserB : normalUserA,
      };
      vi.spyOn(prisma.rivalryStats, 'findMany').mockResolvedValueOnce([record] as any);
      vi.spyOn(prisma.userSettings, 'findMany').mockResolvedValueOnce([{
        userId: normalUserB.id,
        publicMatchHistory: false,
      }] as any);
      vi.spyOn(prisma.blockedUser, 'findMany').mockResolvedValueOnce([]);

      const result = await rivalryService.getRivalries(normalUserA.id);
      expect(result).toHaveLength(0);
    });

    it('does not disclose match details to a blocked non-participant', async () => {
      vi.spyOn(prisma.match, 'findUnique').mockResolvedValueOnce({
        id: 'private-match',
        participants: [
          { userId: normalUserA.id },
          { userId: normalUserB.id },
        ],
      } as any);
      vi.spyOn(prisma.userSettings, 'findFirst').mockResolvedValueOnce(null);
      vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValueOnce({
        id: 'block-match-viewer',
      } as any);

      await expect(
        matchesService.getMatchById('private-match', 'unrelated-viewer')
      ).rejects.toThrow('You do not have permission to view this match');
    });

    it('keeps match details available to a participant even when public history is disabled', async () => {
      vi.spyOn(prisma.match, 'findUnique').mockResolvedValueOnce({
        id: 'own-match',
        participants: [{ userId: normalUserA.id }],
      } as any);

      const match = await matchesService.getMatchById('own-match', normalUserA.id);
      expect(match.id).toBe('own-match');
    });

    it('rejects rivalry with oneself', async () => {
      await expect(
        rivalryService.getRivalryWithUser(normalUserA.id, normalUserA.id)
      ).rejects.toThrow('Cannot view rivalry with oneself');
    });
  });

  // =========================================================================
  // 5. Admin RBAC, Moderation & Audit Logs
  // =========================================================================
  describe('Admin RBAC, User Moderation & Audit Logs', () => {
    it('rejects unprivileged user from accessing admin overview (403)', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(normalUserA as any);
      vi.spyOn(prisma.appRole, 'findFirst').mockResolvedValue(null); // No admin role!

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${playerAToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('privileges required');
    });

    it('allows verified admin to view overview metrics (200)', async () => {
      vi.spyOn(prisma, '$queryRaw').mockResolvedValue([1] as any);
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(adminUser as any);
      vi.spyOn(prisma.appRole, 'findFirst').mockResolvedValue({
        id: 'role-1',
        userId: adminUser.id,
        role: 'ADMIN',
      } as any);

      vi.spyOn(prisma.userProfile, 'count').mockResolvedValue(125);
      vi.spyOn(prisma.room, 'count').mockResolvedValue(4);
      vi.spyOn(prisma.gameSession, 'count').mockResolvedValue(2);
      vi.spyOn(prisma.match, 'count').mockResolvedValue(450);
      vi.spyOn(prisma.gameConfiguration, 'count').mockResolvedValue(11);
      vi.spyOn(prisma.questionEntry, 'count').mockResolvedValue(300);

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.totalUsers).toBe(125);
      expect(res.body.data.serviceHealth).toBe('OPERATIONAL');
    });

    it('blocks self-suspension by administrator', async () => {
      await expect(
        adminService.updateUserStatus(adminUser.id, 'SUSPENDED', 'Self suspend test', adminUser.id)
      ).rejects.toThrow('cannot moderate their own account');
    });

    it('blocks suspended user from making protected API requests', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(suspendedUser as any);

      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', `Bearer ${suspendedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('logs administrative actions into append-only audit trail', async () => {
      const createSpy = vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({} as any);
      await auditService.logAction(
        adminUser.id,
        'GAME_CONFIG_UPDATED',
        'GAME',
        'truth-or-dare',
        { isEnabled: false }
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actorUserId: adminUser.id,
            action: 'GAME_CONFIG_UPDATED',
            targetType: 'GAME',
            targetId: 'truth-or-dare',
          }),
        })
      );
    });
  });

  describe('Wave 1 — Safe game catalog failure', () => {
    it('does not return a successful empty catalog when the database service fails', async () => {
      vi.spyOn(adminService, 'listGames').mockRejectedValueOnce(
        new Error('database password must never reach the client')
      );
      const status = vi.fn().mockReturnThis();
      const json = vi.fn();

      await gamesController.getCatalog({} as any, { status, json } as any);

      expect(status).toHaveBeenCalledWith(503);
      expect(json).toHaveBeenCalledWith({
        success: false,
        error: 'Game catalog is temporarily unavailable.',
      });
      expect(JSON.stringify(json.mock.calls[0][0])).not.toContain('database password');
    });
  });

  // =========================================================================
  // 6. Game Availability & Question Library Management
  // =========================================================================
  describe('Game Availability & Question Library Management', () => {
    it('prevents enabling couple-only games in friend mode', async () => {
      await expect(
        adminService.updateGameConfig(
          'truth-or-dare',
          { friendEnabled: true },
          adminUser.id
        )
      ).rejects.toThrow('strictly Couple-only and cannot be enabled in Friend Mode');
    });

    it('validates question creation requirements (Would You Rather requires both options)', async () => {
      await expect(
        adminService.createQuestion(
          {
            gameId: 'would-you-rather',
            prompt: 'Test dilemma',
            optionA: 'Only A',
            optionB: '', // Missing option B!
          },
          adminUser.id
        )
      ).rejects.toThrow('require both Option A and Option B');
    });
  });
});

