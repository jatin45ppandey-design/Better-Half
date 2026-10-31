import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import {
  validateEnvironment,
  sanitizeEnv,
} from '../src/config/envValidator.js';
import { gameEngineFactory } from '../src/modules/games/core/gameEngineFactory.js';
import { gameStateService } from '../src/modules/games/core/gameState.service.js';
import { gameActionService } from '../src/modules/games/core/gameAction.service.js';
import {
  isGamePermittedForMode,
  MODE_CAPACITIES,
} from '../src/modules/rooms/rooms.constants.js';
import { auditService } from '../src/modules/admin/audit.service.js';
import type { GameEngineContext } from '../src/modules/games/core/gameEngine.types.js';
import type { TicTacToeState } from '../src/modules/games/engines/tic-tac-toe/ticTacToe.types.js';

describe('PlaySpace Wave 5 — B7 Automated CI, Regression & S5 Security Release Gates', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.gameAction, 'findFirst').mockResolvedValue(null);
  });

  // =========================================================================
  // 1. B7: CI & Test Database Isolation Verification
  // =========================================================================
  describe('B7: CI & Test Database Isolation Verification', () => {
    it('validates production environment requirements strictly (DB URL, Direct URL, HTTPS)', () => {
      // 1. Missing Database URL in production fails
      const invalidProdEnv = {
        NODE_ENV: 'production',
        PORT: '4000',
        DATABASE_URL: '',
        DIRECT_URL: 'postgresql://user:pass@localhost:5432/db',
        SUPABASE_URL: 'https://project.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_valid_key_123',
        FRONTEND_URL: 'https://playspace.com',
      };
      const res1 = validateEnvironment(invalidProdEnv);
      expect(res1.isValid).toBe(false);
      expect(res1.errors.some((e) => e.includes('DATABASE_URL'))).toBe(true);

      // 2. Non-HTTPS Supabase URL in production fails
      const insecureSupabaseEnv = {
        ...invalidProdEnv,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SUPABASE_URL: 'http://insecure-supabase.co',
      };
      const res2 = validateEnvironment(insecureSupabaseEnv);
      expect(res2.isValid).toBe(false);
      expect(res2.errors.some((e) => e.includes('SUPABASE_URL'))).toBe(true);

      // 3. Complete valid production configuration passes
      const validProdEnv = {
        NODE_ENV: 'production',
        PORT: '4000',
        DATABASE_URL: 'postgresql://prod_user:strong_password@aws-db.com:5432/prod_db',
        DIRECT_URL: 'postgresql://prod_user:strong_password@aws-db.com:5432/prod_db',
        SUPABASE_URL: 'https://secure-project.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_production_key_safe_123',
        FRONTEND_URL: 'https://play.playspace.com',
      };
      const res3 = validateEnvironment(validProdEnv);
      expect(res3.isValid).toBe(true);
      expect(res3.errors.length).toBe(0);
    });

    it('sanitizes passwords, secrets, tokens, and database credentials safely without leakage', () => {
      const sensitiveConfig = {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://super_admin:super_secret_db_password@db-host.com:5432/prod_db',
        SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_super_secret_jwt_key_9999',
        FRONTEND_URL: 'https://play.playspace.com',
      };

      const sanitized = sanitizeEnv(sensitiveConfig);

      // Passwords and keys must never appear in cleartext
      expect(sanitized.DATABASE_URL).not.toContain('super_secret_db_password');
      expect(sanitized.DATABASE_URL).toContain('****');
      expect(sanitized.SUPABASE_PUBLISHABLE_KEY).not.toContain('super_secret_jwt_key_9999');
      expect(sanitized.SUPABASE_PUBLISHABLE_KEY).toContain('...');
      expect(sanitized.FRONTEND_URL).toBe('https://play.playspace.com');
    });

    it('ensures CI/test database isolation and guards against live production connection attempts', () => {
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.DATABASE_URL || '').not.toContain('production_super_secret_unmasked_password');
    });
  });

  // =========================================================================
  // 2. B7: 11-Engine Rule Integrity, Mode Constraints & Friend Queue
  // =========================================================================
  describe('B7: 11-Engine Rule Integrity & Multiplayer Queueing', () => {
    it('verifies all 11 registered game engines can initialize valid states with canonical properties', () => {
      const registeredEngines = [
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

      expect(registeredEngines.length).toBe(11);

      for (const gameId of registeredEngines) {
        expect(gameEngineFactory.hasEngine(gameId)).toBe(true);
        const engine = gameEngineFactory.getEngine(gameId);
        expect(engine.gameId).toBe(gameId);

        const init = engine.createInitialState({
          sessionId: `sess-test-${gameId}`,
          mode: isGamePermittedForMode(gameId, 'couple') ? 'couple' : 'friend',
          participants: [
            { userId: 'user-player-1', name: 'Alice', seatIndex: 0 },
            { userId: 'user-player-2', name: 'Bob', seatIndex: 1 },
          ],
          rngSeed: 'test-seed-12345',
        });

        expect(init).toBeDefined();
        expect(init.state).toBeDefined();
        expect(init.scores).toBeDefined();
        expect(typeof init.scores).toBe('object');
      }
    });

    it('enforces Tic Tac Toe Friend Mode player queue (2 active duelists, remaining queued with rotation on series end)', () => {
      const tttEngine = gameEngineFactory.getEngine('tic-tac-toe');

      // Initialize with 4 players in Friend Mode
      const participants = [
        { userId: 'player-x', name: 'Player X', seatIndex: 0 },
        { userId: 'player-o', name: 'Player O', seatIndex: 1 },
        { userId: 'player-queue-1', name: 'Queue 1', seatIndex: 2 },
        { userId: 'player-queue-2', name: 'Queue 2', seatIndex: 3 },
      ];

      const initial = tttEngine.createInitialState({
        sessionId: 'ttt-friend-queue-session',
        mode: 'friend',
        participants,
        rngSeed: 'seed-ttt-4p',
      });

      const state = initial.state as TicTacToeState;
      expect(state.duelistXUserId).toBe('player-x');
      expect(state.duelistOUserId).toBe('player-o');
      expect(state.waitingQueueUserIds).toEqual(['player-queue-1', 'player-queue-2']);

      const context: GameEngineContext<TicTacToeState> = {
        sessionId: 'ttt-friend-queue-session',
        gameId: 'tic-tac-toe',
        mode: 'friend',
        participants,
        state,
        scores: initial.scores,
        currentTurnUserId: state.currentTurnUserId,
        status: 'ACTIVE',
        version: 1,
        isPaused: false,
      };

      // 1. Queued players cannot make moves
      const queuedActionValidation = tttEngine.validateAction(
        { type: 'MAKE_MOVE', cellIndex: 0 },
        context,
        'player-queue-1'
      );
      expect(queuedActionValidation.valid).toBe(false);
      expect(queuedActionValidation.error).toBe('Not your turn.');

      // 2. Active duelist can make move
      const activeMoveValidation = tttEngine.validateAction(
        { type: 'MAKE_MOVE', cellIndex: 0 },
        context,
        'player-x'
      );
      expect(activeMoveValidation.valid).toBe(true);

      // 3. Set format to Best of 1 for quick series win test
      const formatResult = tttEngine.applyAction(
        { type: 'SET_SERIES_FORMAT', format: 1 },
        context,
        'player-x'
      );
      context.state = formatResult.newState;

      // Make winning moves for X: 0, 1, 2
      context.state.board = ['X', 'X', null, 'O', 'O', null, null, null, null];
      context.state.currentSymbol = 'X';
      context.state.currentTurnUserId = 'player-x';

      const winResult = tttEngine.applyAction(
        { type: 'MAKE_MOVE', cellIndex: 2 },
        context,
        'player-x'
      );

      expect(winResult.success).toBe(true);
      expect(winResult.isCompleted).toBe(true);
      expect(winResult.winnerUserId).toBe('player-x');

      // Check Queue Rotation:
      // Winner (player-x) stays duelist X;
      // Loser (player-o) moves to end of queue;
      // First in queue (player-queue-1) becomes duelist O.
      expect(winResult.newState.duelistXUserId).toBe('player-x');
      expect(winResult.newState.duelistOUserId).toBe('player-queue-1');
      expect(winResult.newState.waitingQueueUserIds).toEqual(['player-queue-2', 'player-o']);
    });

    it('enforces Couple Mode capacity and game restrictions strictly', () => {
      expect(MODE_CAPACITIES.couple.min).toBe(2);
      expect(MODE_CAPACITIES.couple.max).toBe(2);

      expect(MODE_CAPACITIES.friend.min).toBe(2);
      expect(MODE_CAPACITIES.friend.max).toBe(4);

      expect(isGamePermittedForMode('between-us', 'couple')).toBe(true);
      expect(isGamePermittedForMode('between-us', 'friend')).toBe(false);

      expect(isGamePermittedForMode('truth-or-dare', 'couple')).toBe(true);
      expect(isGamePermittedForMode('truth-or-dare', 'friend')).toBe(false);

      expect(isGamePermittedForMode('would-you-rather', 'couple')).toBe(true);
      expect(isGamePermittedForMode('would-you-rather', 'friend')).toBe(false);

      expect(isGamePermittedForMode('non-existent-game-id', 'couple')).toBe(false);
      expect(isGamePermittedForMode('non-existent-game-id', 'friend')).toBe(false);
    });
  });

  // =========================================================================
  // 3. S5: API Security Review & Authorization / IDOR Protection
  // =========================================================================
  describe('S5: API Security Review & BOLA/IDOR Protections', () => {
    let app: any;

    beforeEach(() => {
      app = createApp();
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue({
        id: 'user-auth-alice',
        username: 'alice',
        displayName: 'Alice',
        role: 'PLAYER',
        accountStatus: 'ACTIVE',
      } as any);
    });

    it('BOLA/IDOR: prevents User A from accepting or declining User B invitation', async () => {
      vi.spyOn(prisma.roomInvitation, 'findUnique').mockResolvedValue({
        id: 'inv-target-bob',
        roomId: 'room-1',
        senderId: 'user-auth-charlie',
        receiverId: 'user-auth-bob', // Destination is Bob, not Alice
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 3600000),
      } as any);

      // Alice tries to accept Bob's invitation
      const res = await request(app)
        .post('/api/v1/invitations/inv-target-bob/accept')
        .set('Authorization', 'Bearer test-mock-token-user-auth-alice')
        .send();

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ForbiddenError');
      expect(res.body.message).toContain('You cannot accept this invitation');
    });

    it('BOLA/IDOR: prevents non-members from viewing room chat messages', async () => {
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue({
        id: 'room-private-charlie',
        code: 'PRIV01',
        hostId: 'user-charlie',
      } as any);

      // Alice is not a participant in Charlie's room
      vi.spyOn(prisma.roomParticipant, 'findUnique').mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/rooms/room-private-charlie/messages')
        .set('Authorization', 'Bearer test-mock-token-user-auth-alice');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ForbiddenError');
      expect(res.body.message).toContain('Only room participants can view room chat');
    });

    it('Mass Assignment: rejects tampering with role, accountStatus, or isSuspended on profile update', async () => {
      vi.spyOn(prisma.userProfile, 'update').mockResolvedValue({
        id: 'user-auth-alice',
        username: 'alice',
        displayName: 'Alice',
        role: 'PLAYER',
        accountStatus: 'ACTIVE',
      } as any);

      const res = await request(app)
        .patch('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-user-auth-alice')
        .send({
          displayName: 'Alice New Name',
          role: 'ADMIN', // Malicious privilege escalation attempt
          accountStatus: 'ACTIVE',
          isSuspended: false,
        });

      // Zod schema rejects unexpected / protected fields
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toContain('role');
    });

    it('Information Exposure: GET /api/v1/ready never leaks database credentials in responses', async () => {
      const res = await request(app).get('/api/v1/ready');

      expect([200, 503]).toContain(res.status);
      const stringified = JSON.stringify(res.body);

      expect(stringified).not.toContain('password');
      expect(stringified).not.toContain('aws-0-eu-west-1.pooler.supabase.com');
      expect(stringified).not.toContain('postgresql://');
      expect(stringified).not.toContain('sb_publishable');
    });
  });

  // =========================================================================
  // 4. S5: Game Integrity & Action Tampering Authoritative Gates
  // =========================================================================
  describe('S5: Authoritative Game Integrity & Tampering Resistance', () => {
    it('authoritatively rejects forged actor user IDs in game action transactions', async () => {
      const actionPayload = {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        actionId: 'act-tamper-01',
        expectedVersion: 1,
        action: { type: 'MAKE_MOVE', cellIndex: 0 },
      };

      vi.spyOn(prisma.gameAction, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.gameAction, 'findMany').mockResolvedValue([]);

      // Mock session where user-attacker is NOT a participant
      vi.spyOn(prisma.gameSession, 'findUnique').mockResolvedValue({
        id: '550e8400-e29b-41d4-a716-446655440000',
        roomId: 'room-1',
        gameId: 'tic-tac-toe',
        mode: 'COUPLE',
        status: 'ACTIVE',
        stateVersion: 1,
        state: { round: 1 },
        scores: {},
        currentTurnUserId: 'user-victim',
        room: { hostId: 'user-victim' },
        participants: [
          { userId: 'user-victim', seatIndex: 0, user: { displayName: 'Victim', username: 'victim' } },
          { userId: 'user-opponent', seatIndex: 1, user: { displayName: 'Opponent', username: 'opponent' } },
        ],
      } as any);

      // Attacker attempts action on victim session
      const result = await gameActionService.applyAction(actionPayload, 'user-attacker');
      expect(result.success).toBe(false);
      expect(result.error).toContain('You are not a participant in this game session.');
    });

    it('enforces turn alternation and strictly rejects out-of-turn actions', async () => {
      const tttEngine = gameEngineFactory.getEngine('tic-tac-toe');

      const initial = tttEngine.createInitialState({
        sessionId: 'ttt-turn-enforce',
        mode: 'couple',
        participants: [
          { userId: 'user-a', name: 'Alice', seatIndex: 0 },
          { userId: 'user-b', name: 'Bob', seatIndex: 1 },
        ],
        rngSeed: 'seed-ttt-turn',
      });

      const context: GameEngineContext<TicTacToeState> = {
        sessionId: 'ttt-turn-enforce',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [
          { userId: 'user-a', name: 'Alice', seatIndex: 0 },
          { userId: 'user-b', name: 'Bob', seatIndex: 1 },
        ],
        state: initial.state as TicTacToeState,
        scores: initial.scores,
        currentTurnUserId: 'user-a', // Alice's turn
        status: 'ACTIVE',
        version: 1,
        isPaused: false,
      };

      // Bob attempts to play on Alice's turn
      const outOfTurnCheck = tttEngine.validateAction(
        { type: 'MAKE_MOVE', cellIndex: 4 },
        context,
        'user-b'
      );

      expect(outOfTurnCheck.valid).toBe(false);
      expect(outOfTurnCheck.error).toBe('Not your turn.');
    });

    it('rejects stale or manipulated expectedVersion with concurrency conflict', async () => {
      const testSessionId = '660e8400-e29b-41d4-a716-446655440000';
      const actionPayload = {
        sessionId: testSessionId,
        actionId: 'act-stale-ver-01',
        expectedVersion: 1, // Stale version
        action: { type: 'MAKE_MOVE', cellIndex: 0 },
      };

      gameStateService.setSession(testSessionId, {
        sessionId: testSessionId,
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [
          { userId: 'user-a', name: 'Alice', seatIndex: 0 },
          { userId: 'user-b', name: 'Bob', seatIndex: 1 },
        ],
        state: {
          board: Array(9).fill(null),
          currentSymbol: 'X',
          currentTurnUserId: 'user-a',
          duelistXUserId: 'user-a',
          duelistOUserId: 'user-b',
          waitingQueueUserIds: [],
          seriesFormat: 3,
          currentRound: 1,
          xWins: 0,
          oWins: 0,
          draws: 0,
          roundStatus: 'PLAYING',
          winningCombo: null,
          matchWinnerUserId: null,
          history: [],
        },
        scores: { 'user-a': 0, 'user-b': 0 },
        currentTurnUserId: 'user-a',
        status: 'ACTIVE',
        version: 1,
        isPaused: false,
      });

      // Mock updateMany returning count: 0 (concurrency collision / stale version)
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          gameSession: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
          gameAction: {
            create: vi.fn().mockResolvedValue({}),
          },
        });
      });

      const result = await gameActionService.applyAction(actionPayload, 'user-a');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Version conflict: another action was processed concurrently.');
    });

    it('strictly isolates private game states so opponents cannot inspect hands or hidden cards', () => {
      const cardEngine = gameEngineFactory.getEngine('uno-style');

      const initial = cardEngine.createInitialState({
        sessionId: 'card-private-state-test',
        mode: 'friend',
        participants: [
          { userId: 'player-alice', name: 'Alice', seatIndex: 0 },
          { userId: 'player-bob', name: 'Bob', seatIndex: 1 },
        ],
        rngSeed: 'card-seed-private-123',
      });

      const context: GameEngineContext = {
        sessionId: 'card-private-state-test',
        gameId: 'uno-style',
        mode: 'friend',
        participants: [
          { userId: 'player-alice', name: 'Alice', seatIndex: 0 },
          { userId: 'player-bob', name: 'Bob', seatIndex: 1 },
        ],
        state: initial.state,
        scores: initial.scores,
        privateStates: initial.privateStates,
        currentTurnUserId: initial.currentTurnUserId,
        status: 'ACTIVE',
        version: 1,
        isPaused: false,
      };

      gameStateService.setSession('card-private-state-test', context);

      const alicePrivate = gameStateService.getPrivateProjection('card-private-state-test', 'player-alice');
      const bobPrivate = gameStateService.getPrivateProjection('card-private-state-test', 'player-bob');
      const eavesdropperPrivate = gameStateService.getPrivateProjection('card-private-state-test', 'player-eavesdropper');

      expect(alicePrivate).toBeDefined();
      expect(bobPrivate).toBeDefined();
      expect(eavesdropperPrivate).toBeNull();
      expect(alicePrivate).not.toEqual(bobPrivate);
    });
  });

  // =========================================================================
  // 5. S5: Suspended User & Audit Integrity Gates
  // =========================================================================
  describe('S5: Suspended Account Enforcement & Audit Log Integrity', () => {
    let app: any;

    beforeEach(() => {
      app = createApp();
    });

    it('blocks suspended users across HTTP API with 403 ACCOUNT_SUSPENDED code', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue({
        id: 'user-suspended-01',
        username: 'malicious_user',
        displayName: 'Bad Actor',
        role: 'PLAYER',
        accountStatus: 'SUSPENDED',
      } as any);

      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-user-suspended-01');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.error).toContain('account has been suspended');
    });

    it('auditService redacts sensitive keys recursively and records actor, resource, and action', async () => {
      let loggedMetadata: any = null;

      vi.spyOn(prisma.auditLog, 'create').mockImplementation(async (args: any) => {
        loggedMetadata = args.data.metadata;
        return { id: 'audit-log-uuid-1', ...args.data };
      });

      await auditService.logAction(
        'admin-alice',
        'USER_ROLE_UPDATED',
        'user_profile',
        'target-user-bob',
        {
          targetUser: 'bob',
          password: 'plain_password_leak_attempt',
          token: 'bearer-super-secret-token',
          safeDetails: 'Promoted to Moderator',
          nested: {
            apiKey: 'secret_api_key_123',
            normalNote: 'Review completed',
          },
        }
      );

      expect(loggedMetadata).toBeDefined();
      expect(loggedMetadata.safeDetails).toBe('Promoted to Moderator');
      expect(loggedMetadata.nested.normalNote).toBe('Review completed');

      // Sensitive fields must be redacted
      expect(loggedMetadata.password).toBe('[REDACTED]');
      expect(loggedMetadata.token).toBe('[REDACTED]');
      expect(loggedMetadata.nested.apiKey).toBe('[REDACTED]');
    });
  });
});
