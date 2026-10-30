import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { evaluateGameResult } from '../src/modules/games/match/resultPolicies.js';
import { matchFinalizationService } from '../src/modules/games/match/matchFinalization.service.js';
import { statsService } from '../src/modules/stats/stats.service.js';
import { adminService } from '../src/modules/admin/admin.service.js';
import { auditService } from '../src/modules/admin/audit.service.js';
import { gameActionService } from '../src/modules/games/core/gameAction.service.js';
import { gameStateService } from '../src/modules/games/core/gameState.service.js';
import type { GameEngineContext } from '../src/modules/games/core/gameEngine.types.js';

describe('PlaySpace Wave 3 — B4, B5, S3 Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Phase B4 — Match Finalization, Results & Rivalry Correctness
  // =========================================================================
  describe('Phase B4: Match Outcomes, Multiplayer Rivalry & Stats', () => {
    it('verifies validated result contracts across all 11 games (cooperative, competitive, and lowest-strokes)', () => {
      const allGameIds = [
        'truth-or-dare',
        'would-you-rather',
        'blind-ranking',
        'uno-style',
        'tic-tac-toe',
        'pen-fight',
        'kabza',
        'basketball-rivalry',
        'snatch-the-fries',
        'aloo-golf',
        'between-us',
      ];

      for (const gameId of allGameIds) {
        const isCoopGame = ['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId);
        const context: GameEngineContext = {
          sessionId: `sess-contract-${gameId}`,
          gameId,
          mode: isCoopGame ? 'couple' : 'friend',
          participants: [
            { userId: 'player-a', name: 'Alice', seatIndex: 0 },
            { userId: 'player-b', name: 'Bob', seatIndex: 1 },
          ],
          state: { round: 1 },
          scores: { 'player-a': 10, 'player-b': 5 },
          currentTurnUserId: null,
          status: 'COMPLETED',
          version: 2,
          isPaused: false,
        };

        const result = evaluateGameResult(context);
        expect(result).toBeDefined();
        expect(['COMPETITIVE', 'COOPERATIVE', 'DRAW', 'ABANDONED']).toContain(result.resultType);
        expect(result.participants.length).toBe(2);

        for (const p of result.participants) {
          expect(p.placement).toBeGreaterThanOrEqual(1);
          expect(typeof p.scoreValue).toBe('number');
          expect(typeof p.scoreLabel).toBe('string');
          expect(['WIN', 'LOSS', 'DRAW', 'COMPLETED', 'ABANDONED']).toContain(p.outcome);
        }

        // Cooperative games must never declare arbitrary winners
        if (isCoopGame) {
          expect(result.resultType).toBe('COOPERATIVE');
          expect(result.winnerUserId).toBeNull();
          expect(result.participants[0].outcome).toBe('COMPLETED');
          expect(result.participants[1].outcome).toBe('COMPLETED');
          expect(result.participants[0].isWinner).toBe(false);
          expect(result.participants[1].isWinner).toBe(false);
        }

        // In Aloo Golf, player with 5 strokes beats player with 10 strokes
        if (gameId === 'aloo-golf') {
          expect(result.resultType).toBe('COMPETITIVE');
          expect(result.winnerUserId).toBe('player-b'); // 5 strokes < 10 strokes!
          expect(result.participants.find((p) => p.userId === 'player-b')!.isWinner).toBe(true);
          expect(result.participants.find((p) => p.userId === 'player-a')!.outcome).toBe('LOSS');
        }
      }
    });

    it('correctly derives pairwise rivalry in a 4-player game with a 1st place tie (no false draws for other pairs)', async () => {
      // 4-player game: P1 and P2 tie for 1st with 20 pts, P3 is 3rd with 15 pts, P4 is 4th with 10 pts
      const context: GameEngineContext = {
        sessionId: 'sess-multi-draw-1',
        gameId: 'uno-style',
        mode: 'friend',
        participants: [
          { userId: 'u1', name: 'Alice', seatIndex: 0 },
          { userId: 'u2', name: 'Bob', seatIndex: 1 },
          { userId: 'u3', name: 'Charlie', seatIndex: 2 },
          { userId: 'u4', name: 'David', seatIndex: 3 },
        ],
        state: { round: 1 },
        privateStates: {},
        version: 5,
        isPaused: false,
        status: 'COMPLETED',
        scores: {
          u1: 20,
          u2: 20,
          u3: 15,
          u4: 10,
        },
        roomId: 'room-multi-1',
      };

      const evaluation = evaluateGameResult(context);
      expect(evaluation.resultType).toBe('DRAW'); // Overall match had a tie for first
      expect(evaluation.winnerUserId).toBeNull();

      // Check individual placements
      const p1 = evaluation.participants.find((p) => p.userId === 'u1')!;
      const p2 = evaluation.participants.find((p) => p.userId === 'u2')!;
      const p3 = evaluation.participants.find((p) => p.userId === 'u3')!;
      const p4 = evaluation.participants.find((p) => p.userId === 'u4')!;

      expect(p1.placement).toBe(1);
      expect(p2.placement).toBe(1);
      expect(p3.placement).toBe(3);
      expect(p4.placement).toBe(4);

      // Now verify finalization pairwise calculations
      const rivalryUpserts: any[] = [];
      const mockTx = {
        match: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'match-multi-1', gameId: 'uno-style', mode: 'FRIEND', resultType: 'DRAW', durationSeconds: 60, participants: [] }),
        },
        userProfile: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'u1', displayName: 'Alice', username: 'alice', avatarUrl: null },
            { id: 'u2', displayName: 'Bob', username: 'bob', avatarUrl: null },
            { id: 'u3', displayName: 'Charlie', username: 'charlie', avatarUrl: null },
            { id: 'u4', displayName: 'David', username: 'david', avatarUrl: null },
          ]),
        },
        matchParticipant: {
          create: vi.fn().mockResolvedValue({}),
        },
        userGameStats: {
          upsert: vi.fn().mockResolvedValue({}),
        },
        rivalryStats: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockImplementation((args) => {
            rivalryUpserts.push(args);
            return Promise.resolve({});
          }),
        },
        room: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      };

      await matchFinalizationService.finalizeMatch(context, mockTx);

      // 4 players = 6 distinct pairs:
      // (u1, u2): tied -> draws = 1, userLowWins = 0, userHighWins = 0
      // (u1, u3): u1 won -> userLowWins = 1, userHighWins = 0, draws = 0
      // (u1, u4): u1 won -> userLowWins = 1, userHighWins = 0, draws = 0
      // (u2, u3): u2 won -> userLowWins = 1, userHighWins = 0, draws = 0
      // (u2, u4): u2 won -> userLowWins = 1, userHighWins = 0, draws = 0
      // (u3, u4): u3 won -> userLowWins = 1, userHighWins = 0, draws = 0
      expect(rivalryUpserts.length).toBe(6);

      const pair12 = rivalryUpserts.find(
        (u) => (u.where.userLowId_userHighId.userLowId === 'u1' && u.where.userLowId_userHighId.userHighId === 'u2')
      );
      expect(pair12.update.draws.increment).toBe(1);
      expect(pair12.update.userLowWins.increment).toBe(0);
      expect(pair12.update.userHighWins.increment).toBe(0);

      const pair13 = rivalryUpserts.find(
        (u) => (u.where.userLowId_userHighId.userLowId === 'u1' && u.where.userLowId_userHighId.userHighId === 'u3')
      );
      // u1 beat u3! Must NOT be a draw!
      expect(pair13.update.draws.increment).toBe(0);
      expect(pair13.update.userLowWins.increment).toBe(1);

      const pair34 = rivalryUpserts.find(
        (u) => (u.where.userLowId_userHighId.userLowId === 'u3' && u.where.userLowId_userHighId.userHighId === 'u4')
      );
      // u3 beat u4!
      expect(pair34.update.draws.increment).toBe(0);
      expect(pair34.update.userLowWins.increment).toBe(1);
    });

    it('evaluates abandoned matches without awarding wins or losses', () => {
      const context: GameEngineContext = {
        sessionId: 'sess-abandon-1',
        gameId: 'basketball-rivalry',
        mode: 'couple',
        participants: [
          { userId: 'u1', name: 'Alice', seatIndex: 0 },
          { userId: 'u2', name: 'Bob', seatIndex: 1 },
        ],
        state: { round: 2 },
        privateStates: {},
        version: 3,
        isPaused: false,
        status: 'ABANDONED',
        scores: { u1: 5, u2: 2 },
        roomId: 'room-ab-1',
      };

      const result = evaluateGameResult(context);
      expect(result.resultType).toBe('ABANDONED');
      expect(result.winnerUserId).toBeNull();
      expect(result.participants[0].outcome).toBe('ABANDONED');
      expect(result.participants[0].isWinner).toBe(false);
      expect(result.participants[1].outcome).toBe('ABANDONED');
      expect(result.participants[1].isWinner).toBe(false);
    });

    it('cleans up stale aggregates during reconciliation when source matches no longer exist', async () => {
      vi.spyOn(prisma.matchParticipant, 'findMany').mockResolvedValueOnce([
        {
          userId: 'user-rec-1',
          outcome: 'WIN',
          match: { gameId: 'aloo-golf', completedAt: new Date() },
        },
      ] as any);

      const updateManySpy = vi.spyOn(prisma.userGameStats, 'updateMany').mockResolvedValueOnce({ count: 1 } as any);
      vi.spyOn(prisma.userGameStats, 'upsert').mockResolvedValueOnce({} as any);

      const res = await statsService.reconcileUserStats('user-rec-1');
      expect(res.reconciledGames).toBe(1);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-rec-1',
            gameId: { notIn: ['aloo-golf'] },
          },
          data: expect.objectContaining({
            matchesPlayed: 0,
            wins: 0,
            losses: 0,
          }),
        })
      );
    });
  });

  // =========================================================================
  // 2. Phase B5 — Admin, Moderation & Role Management Safeguards
  // =========================================================================
  describe('Phase B5: Admin Role Safeguards & Content Management', () => {
    it('prevents revoking the last active administrator role transactionally', async () => {
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          appRole: {
            count: vi.fn().mockResolvedValue(1), // Only 1 active admin!
            deleteMany: vi.fn(),
          },
        });
      });

      await expect(
        adminService.revokeRole('admin-1', 'ADMIN', 'actor-1')
      ).rejects.toThrow('Cannot revoke role from the last active administrator.');
    });

    it('rejects creating questions for Blind Ranking (which is curated static content)', async () => {
      await expect(
        adminService.createQuestion(
          {
            gameId: 'blind-ranking',
            prompt: 'Rate these fruits',
          },
          'admin-1'
        )
      ).rejects.toThrow('Blind Ranking content is curated static items');
    });

    it('rejects question creation for non-question games like tic-tac-toe', async () => {
      await expect(
        adminService.createQuestion(
          {
            gameId: 'tic-tac-toe',
            prompt: 'Invalid prompt for board game',
          },
          'admin-1'
        )
      ).rejects.toThrow('does not support custom question entries');
    });

    it('lists games directly without performing redundant seeding queries on each request', async () => {
      const findManySpy = vi.spyOn(prisma.gameConfiguration, 'findMany').mockResolvedValueOnce([
        { gameId: 'truth-or-dare', isEnabled: true },
      ] as any);
      const seedSpy = vi.spyOn(adminService, 'seedInitialGameConfigs');

      const games = await adminService.listGames();
      expect(games.length).toBe(1);
      expect(findManySpy).toHaveBeenCalled();
      expect(seedSpy).not.toHaveBeenCalled();
    });

    it('strictly separates ADMIN from MODERATOR permissions (MODERATOR blocked from role grants and questions)', async () => {
      const app = createApp();
      const modUser = { id: 'mod-user-1', username: 'mod', displayName: 'Mod', accountStatus: 'ACTIVE' };
      const modToken = 'test-mock-token-mod-user-1';

      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(modUser as any);
      vi.spyOn(prisma.appRole, 'findFirst').mockImplementation(async ({ where }: any) => {
        // If query asks for ADMIN specifically, moderator does NOT have it!
        if (where?.role === 'ADMIN') return null;
        // If query asks for { in: ['ADMIN', 'MODERATOR'] }, moderator has it!
        if (where?.role?.in?.includes('MODERATOR')) return { id: 'r1', userId: modUser.id, role: 'MODERATOR' } as any;
        return null;
      });

      // 1. Overview is accessible to MODERATOR (200)
      vi.spyOn(prisma, '$queryRaw').mockResolvedValue([1] as any);
      vi.spyOn(prisma.userProfile, 'count').mockResolvedValue(10);
      vi.spyOn(prisma.room, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.gameSession, 'count').mockResolvedValue(1);
      vi.spyOn(prisma.match, 'count').mockResolvedValue(5);
      vi.spyOn(prisma.gameConfiguration, 'count').mockResolvedValue(11);
      vi.spyOn(prisma.questionEntry, 'count').mockResolvedValue(50);
      vi.spyOn(prisma.matchParticipant, 'findMany').mockResolvedValue([]);
      vi.spyOn(prisma.roomParticipant, 'findMany').mockResolvedValue([]);

      const overviewRes = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${modToken}`);
      expect(overviewRes.status).toBe(200);

      // 2. Role assignment is BLOCKED for MODERATOR (403 FORBIDDEN_ADMIN_REQUIRED)
      const roleRes = await request(app)
        .post('/api/v1/admin/users/target-1/roles')
        .set('Authorization', `Bearer ${modToken}`)
        .send({ role: 'MODERATOR' });
      expect(roleRes.status).toBe(403);
      expect(roleRes.body.code).toBe('FORBIDDEN_ADMIN_REQUIRED');

      // 3. Question creation is BLOCKED for MODERATOR (403 FORBIDDEN_ADMIN_REQUIRED)
      const questionRes = await request(app)
        .post('/api/v1/admin/questions')
        .set('Authorization', `Bearer ${modToken}`)
        .send({ gameId: 'truth-or-dare', prompt: 'test' });
      expect(questionRes.status).toBe(403);
      expect(questionRes.body.code).toBe('FORBIDDEN_ADMIN_REQUIRED');
    });
  });

  // =========================================================================
  // 3. Phase S3 — Security, Privacy & Audit Trail Integrity
  // =========================================================================
  describe('Phase S3: Security, Privacy & Audit Trail Integrity', () => {
    it('recursively redacts passwords, tokens, secrets, and answers from audit metadata', async () => {
      let loggedMetadata: any = null;
      vi.spyOn(prisma.auditLog, 'create').mockImplementation(async (args: any) => {
        loggedMetadata = args.data.metadata;
        return {} as any;
      });

      await auditService.logAction('actor-1', 'TEST_ACTION', 'USER', 'target-1', {
        publicInfo: 'safe_value',
        credentials: {
          password: 'super_secret_password',
          accessToken: 'bearer_token_123',
        },
        gameData: {
          answer: 'deep_secret_answer',
          answers: ['answer_1', 'answer_2'],
          nested: {
            secret: 'top_secret',
          },
        },
      });

      expect(loggedMetadata).toBeDefined();
      expect(loggedMetadata.publicInfo).toBe('safe_value');
      expect(loggedMetadata.credentials.password).toBe('[REDACTED]');
      expect(loggedMetadata.credentials.accessToken).toBe('[REDACTED]');
      expect(loggedMetadata.gameData.answer).toBe('[REDACTED]');
      expect(loggedMetadata.gameData.answers).toBe('[REDACTED]');
      expect(loggedMetadata.gameData.nested.secret).toBe('[REDACTED]');
    });

    it('propagates database error when audit logging fails instead of silently swallowing it', async () => {
      vi.spyOn(prisma.auditLog, 'create').mockRejectedValueOnce(new Error('Audit table disk full'));

      await expect(
        auditService.logAction('actor-1', 'SECURITY_ACTION', 'SYSTEM', null, {})
      ).rejects.toThrow('Audit table disk full');
    });

    it('rejects action tampering attempts: out-of-turn, non-participant, and version conflict', async () => {
      const sessionId = 'sess-tamper-test';
      const context: GameEngineContext = {
        sessionId,
        gameId: 'tic-tac-toe',
        mode: 'friend',
        participants: [
          { userId: 'player-x', name: 'Player X', seatIndex: 0 },
          { userId: 'player-o', name: 'Player O', seatIndex: 1 },
        ],
        state: {
          board: [null, null, null, null, null, null, null, null, null],
          winningLine: null,
          isDraw: false,
          currentSymbol: 'X',
          currentTurnUserId: 'player-x',
          roundStatus: 'PLAYING',
          currentRound: 1,
        },
        privateStates: {},
        version: 5,
        isPaused: false,
        status: 'ACTIVE',
        scores: { 'player-x': 0, 'player-o': 0 },
        currentTurnUserId: 'player-x', // Player X's turn!
      };
      gameStateService.setSession(sessionId, context);
      vi.spyOn(prisma.gameAction, 'findFirst').mockResolvedValue(null);

      // 1. Non-participant tampering
      const nonParticipantResult = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-tamper-1',
          expectedVersion: 5,
          action: { type: 'MAKE_MOVE', cellIndex: 0 },
        },
        'unauthorized-hacker'
      );
      expect(nonParticipantResult.success).toBe(false);
      expect(nonParticipantResult.error).toContain('not a participant');

      // 2. Out-of-turn tampering (Player O tries to move on Player X's turn)
      const outOfTurnResult = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-tamper-2',
          expectedVersion: 5,
          action: { type: 'MAKE_MOVE', cellIndex: 0 },
        },
        'player-o'
      );
      expect(outOfTurnResult.success).toBe(false);
      expect(outOfTurnResult.error).toContain('Not your turn');

      // 3. Stale session version tampering
      const staleVersionResult = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-tamper-3',
          expectedVersion: 3, // Stale! Server is at 5
          action: { type: 'MAKE_MOVE', cellIndex: 0 },
        },
        'player-x'
      );
      expect(staleVersionResult.success).toBe(false);
      expect(staleVersionResult.error).toContain('Version conflict');
    });
  });
});
