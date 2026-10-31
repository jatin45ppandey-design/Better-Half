import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { createSocketServer } from '../src/socket/index.js';
import { prisma } from '../src/config/prisma.js';
import { gameSessionService } from '../src/modules/games/core/gameSession.service.js';
import { gameActionService } from '../src/modules/games/core/gameAction.service.js';
import { gameStateService } from '../src/modules/games/core/gameState.service.js';
import { matchFinalizationService } from '../src/modules/games/match/matchFinalization.service.js';
import { evaluateGameResult } from '../src/modules/games/match/resultPolicies.js';
import type { GameEngineContext } from '../src/modules/games/core/gameEngine.types.js';

describe('PlaySpace Phase 4.1 — Production Correctness & Reliability Remediation', () => {
  let app: any;
  let server: http.Server;
  let ioServer: any;
  let serverPort: number;

  const userHost = {
    id: 'user-host-41',
    username: 'host_player',
    displayName: 'Host Player',
    accountStatus: 'ACTIVE',
  };

  const userGuest = {
    id: 'user-guest-41',
    username: 'guest_player',
    displayName: 'Guest Player',
    accountStatus: 'ACTIVE',
  };

  const userSuspended = {
    id: 'user-suspended-41',
    username: 'suspended_bad',
    displayName: 'Suspended Bad',
    accountStatus: 'SUSPENDED',
  };

  beforeAll(async () => {
    app = createApp();
    server = http.createServer(app);
    ioServer = createSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    ioServer?.close();
    await new Promise<void>((resolve) => {
      if (server?.listening) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(prisma.gameSession, 'findFirst').mockResolvedValue(null);
  });

  // =========================================================================
  // 1. Durable Game-Session Creation & Rematch
  // =========================================================================
  describe('Durable Game-Session Creation & Rematch', () => {
    it('1. Session creation fails when DB persistence fails', async () => {
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue({
        id: 'room-fail-1',
        code: 'FAIL01',
        hostId: userHost.id,
        mode: 'COUPLE',
        selectedGameId: 'basketball-rivalry',
        participants: [
          { userId: userHost.id, isReady: true, leftAt: null, user: userHost },
          { userId: userGuest.id, isReady: true, leftAt: null, user: userGuest },
        ],
      } as any);

      vi.spyOn(prisma.gameConfiguration, 'findUnique').mockResolvedValue({
        gameId: 'basketball-rivalry',
        isEnabled: true,
        coupleEnabled: true,
        friendEnabled: true,
      } as any);

      // Force DB transaction failure
      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(
        new Error('Database disk full / transaction aborted')
      );

      await expect(
        gameSessionService.createSession('FAIL01', 'basketball-rivalry', userHost.id)
      ).rejects.toThrow('Database disk full');
    });

    it('2. No memory-only session is exposed after failed DB creation', async () => {
      const activeSessionsCountBefore = Object.keys((gameStateService as any).sessions || {}).length;

      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue({
        id: 'room-fail-2',
        code: 'FAIL02',
        hostId: userHost.id,
        mode: 'COUPLE',
        selectedGameId: 'basketball-rivalry',
        participants: [
          { userId: userHost.id, isReady: true, leftAt: null, user: userHost },
          { userId: userGuest.id, isReady: true, leftAt: null, user: userGuest },
        ],
      } as any);

      vi.spyOn(prisma.gameConfiguration, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('DB failure'));

      try {
        await gameSessionService.createSession('FAIL02', 'basketball-rivalry', userHost.id);
      } catch {
        // Expected
      }

      const activeSessionsCountAfter = Object.keys((gameStateService as any).sessions || {}).length;
      expect(activeSessionsCountAfter).toBe(activeSessionsCountBefore);
    });

    it('3. Rematch persists successfully in DB before registering in memory', async () => {
      const existingSession: GameEngineContext = {
        sessionId: 'sess-prev-1',
        gameId: 'basketball-rivalry',
        mode: 'couple',
        participants: [
          { userId: userHost.id, name: userHost.displayName, seatIndex: 0, isHost: true },
          { userId: userGuest.id, name: userGuest.displayName, seatIndex: 1, isHost: false },
        ],
        state: { round: 3 },
        privateStates: {},
        version: 5,
        isPaused: false,
        status: 'COMPLETED',
        scores: { [userHost.id]: 10, [userGuest.id]: 8 },
        roomId: 'room-rematch-1',
      };
      gameStateService.setSession('sess-prev-1', existingSession);

      vi.spyOn(prisma.gameConfiguration, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue({
        id: 'room-rematch-1',
        code: 'RMTCH1',
        hostId: userHost.id,
        mode: 'COUPLE',
        status: 'COMPLETED',
        participants: [
          { userId: userHost.id, leftAt: null, isReady: true, user: userHost },
          { userId: userGuest.id, leftAt: null, isReady: true, user: userGuest },
        ],
      } as any);
      const txClient = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        room: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'room-rematch-1',
            code: 'RMTCH1',
            hostId: userHost.id,
            mode: 'COUPLE',
            status: 'COMPLETED',
            expiresAt: new Date(Date.now() + 3600000),
            participants: [
              { userId: userHost.id, leftAt: null, isReady: true, user: userHost },
              { userId: userGuest.id, leftAt: null, isReady: true, user: userGuest },
            ],
          }),
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        gameSession: {
          findUnique: vi.fn().mockResolvedValue({
            status: 'COMPLETED',
            roomId: 'room-rematch-1',
            gameId: 'basketball-rivalry',
          }),
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({ id: 'rematch-new-session' }),
        },
        gameConfiguration: { findUnique: vi.fn().mockResolvedValue(null) },
      };
      const txSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback(txClient));

      const rematch = await gameSessionService.rematchSession('sess-prev-1', userHost.id);

      expect(txSpy).toHaveBeenCalled();
      expect(rematch.sessionId).not.toBe('sess-prev-1');
      expect(rematch.gameId).toBe('basketball-rivalry');
      expect(rematch.mode).toBe('couple');
      expect(rematch.version).toBe(1);
      expect(gameStateService.getSession(rematch.sessionId)).not.toBeNull();
    });
  });

  // =========================================================================
  // 2. Transactional Action Processing & Privacy
  // =========================================================================
  describe('Transactional Action Processing & Concurrency', () => {
    it('4. Action persistence failure restores the complete original state', async () => {
      const sessionId = 'sess-action-test-1';
      const initialContext: GameEngineContext = {
        sessionId,
        gameId: 'basketball-rivalry',
        mode: 'couple',
        participants: [
          { userId: userHost.id, name: userHost.displayName, seatIndex: 0, isHost: true },
          { userId: userGuest.id, name: userGuest.displayName, seatIndex: 1, isHost: false },
        ],
        state: {
          round: 1,
          turnIndex: 0,
          currentTurnUserId: userHost.id,
          ballState: { inFlight: false, x: 50, y: 300, vx: 0, vy: 0 },
          shotClock: 24,
          streak: { [userHost.id]: 0, [userGuest.id]: 0 },
          shotsTaken: { [userHost.id]: 0, [userGuest.id]: 0 },
        },
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: { [userHost.id]: 0, [userGuest.id]: 0 },
        currentTurnUserId: userHost.id,
      };
      gameStateService.setSession(sessionId, initialContext);

      vi.spyOn(prisma.gameAction, 'findFirst').mockResolvedValue(null);
      // Simulate database failure during transaction
      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('Transaction lock timeout'));

      const result = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-fail-1',
          expectedVersion: 1,
          action: { type: 'SHOOT', angle: 55, power: 60 },
        },
        userHost.id
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Action persistence failed');

      // Verify memory state is preserved at version 1 without partial mutations
      const sessionAfter = gameStateService.getSession(sessionId);
      expect(sessionAfter?.version).toBe(1);
      expect(sessionAfter?.scores[userHost.id]).toBe(0);
      expect(gameStateService.isActionProcessed(sessionId, 'act-fail-1')).toBe(false);
    });

    it('5. Private state is persisted only according to privacy rules (BETWEEN US & Would You Rather)', async () => {
      const sessionId = 'sess-bu-privacy';
      const buContext: GameEngineContext = {
        sessionId,
        gameId: 'between-us',
        mode: 'couple',
        participants: [
          { userId: userHost.id, name: userHost.displayName, seatIndex: 0 },
          { userId: userGuest.id, name: userGuest.displayName, seatIndex: 1 },
        ],
        state: {
          category: 'All',
          intensity: 2,
          questionIndex: 0,
          currentQuestion: { id: 'bu-1', prompt: 'Secret question', category: 'Deep', intensity: 2 },
          phase: 'ANSWERING',
          submittedUserIds: [],
          revealedAnswers: null,
          totalAnswered: 0,
          history: [],
        },
        privateStates: {
          [userHost.id]: { pendingAnswer: null },
          [userGuest.id]: { pendingAnswer: null },
        },
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: { [userHost.id]: 0, [userGuest.id]: 0 },
      };
      gameStateService.setSession(sessionId, buContext);

      vi.spyOn(prisma.gameAction, 'findFirst').mockResolvedValue(null);

      let capturedParticipantUpdates: any[] = [];
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          gameSession: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          gameAction: {
            create: vi.fn().mockResolvedValue({}),
          },
          gameSessionParticipant: {
            updateMany: vi.fn().mockImplementation((args: any) => {
              capturedParticipantUpdates.push(args);
              return { count: 1 };
            }),
          },
        });
      });

      const res = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-bu-1',
          expectedVersion: 1,
          action: { type: 'SUBMIT_ANSWER', answer: 'Very intimate personal confession' },
        },
        userHost.id
      );

      expect(res.success).toBe(true);
      // Pending answer state is durable in per-player private columns, never in
      // the public session snapshot or the sanitized action audit metadata.
      expect(capturedParticipantUpdates).toHaveLength(2);
      expect(capturedParticipantUpdates.every((updateCall) => updateCall.data.privateState !== undefined)).toBe(true);
    });

    it('6. Duplicate action IDs cannot double-apply', async () => {
      const sessionId = 'sess-idempotency-1';
      const sessionContext: GameEngineContext = {
        sessionId,
        gameId: 'basketball-rivalry',
        mode: 'couple',
        participants: [
          { userId: userHost.id, name: userHost.displayName, seatIndex: 0 },
          { userId: userGuest.id, name: userGuest.displayName, seatIndex: 1 },
        ],
        state: {
          round: 1,
          turnIndex: 0,
          currentTurnUserId: userHost.id,
          shotClock: 24,
          streak: {},
          shotsTaken: { [userHost.id]: 0, [userGuest.id]: 0 },
        },
        privateStates: {},
        version: 3,
        isPaused: false,
        status: 'ACTIVE',
        scores: { [userHost.id]: 6, [userGuest.id]: 4 },
      };
      gameStateService.setSession(sessionId, sessionContext);

      // Pre-mark action as processed
      gameStateService.markActionProcessed(sessionId, 'act-already-done');

      const res = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-already-done',
          expectedVersion: 3,
          action: { type: 'SHOOT', angle: 55, power: 60 },
        },
        userHost.id
      );

      expect(res.success).toBe(true);
      expect(res.version).toBe(3); // Version unchanged
    });

    it('7. Concurrent actions cannot commit against the same expected version', async () => {
      const sessionId = 'sess-concurrency-1';
      const sessionContext: GameEngineContext = {
        sessionId,
        gameId: 'basketball-rivalry',
        mode: 'couple',
        participants: [
          { userId: userHost.id, name: userHost.displayName, seatIndex: 0 },
          { userId: userGuest.id, name: userGuest.displayName, seatIndex: 1 },
        ],
        state: {
          round: 1,
          turnIndex: 0,
          currentTurnUserId: userHost.id,
          shotClock: 24,
          streak: {},
          shotsTaken: { [userHost.id]: 0, [userGuest.id]: 0 },
        },
        privateStates: {},
        version: 2,
        isPaused: false,
        status: 'ACTIVE',
        scores: { [userHost.id]: 2, [userGuest.id]: 2 },
      };
      gameStateService.setSession(sessionId, sessionContext);

      vi.spyOn(prisma.gameAction, 'findFirst').mockResolvedValue(null);
      // Simulate updateMany returning 0 because a concurrent transaction bumped version
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          gameSession: {
            updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        });
      });

      const res = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-race-1',
          expectedVersion: 2,
          action: { type: 'SHOOT', vx: 10, vy: 10 },
        },
        userHost.id
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('Version conflict');
      expect(gameStateService.getSession(sessionId)?.version).toBe(2);
    });
  });

  // =========================================================================
  // 3. Match Finalization Reliability & Scoring Rules
  // =========================================================================
  describe('Match Finalization Reliability & Multi-Player Scoring', () => {
    it('8. Match finalization failure cannot return a fake match ID', async () => {
      const session: GameEngineContext = {
        sessionId: 'sess-match-fail-1',
        roomId: 'room-1',
        gameId: 'basketball-rivalry',
        mode: 'couple',
        participants: [
          { userId: userHost.id, name: userHost.displayName, seatIndex: 0 },
          { userId: userGuest.id, name: userGuest.displayName, seatIndex: 1 },
        ],
        state: {},
        privateStates: {},
        version: 10,
        isPaused: false,
        status: 'COMPLETED',
        scores: { [userHost.id]: 15, [userGuest.id]: 10 },
      };

      vi.spyOn(prisma.match, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('Match table constraint violation'));

      await expect(matchFinalizationService.finalizeMatch(session)).rejects.toThrow(
        'Match table constraint violation'
      );
    });

    it('9. Match finalization retries do not double-count statistics', async () => {
      const session: GameEngineContext = {
        sessionId: 'sess-match-retry-1',
        roomId: 'room-1',
        gameId: 'basketball-rivalry',
        mode: 'couple',
        participants: [
          { userId: userHost.id, name: userHost.displayName, seatIndex: 0 },
          { userId: userGuest.id, name: userGuest.displayName, seatIndex: 1 },
        ],
        state: {},
        privateStates: {},
        version: 10,
        isPaused: false,
        status: 'COMPLETED',
        scores: { [userHost.id]: 15, [userGuest.id]: 10 },
      };

      const existingMatch = {
        id: 'match-existing-real-id',
        gameSessionId: 'sess-match-retry-1',
        gameId: 'basketball-rivalry',
        mode: 'COUPLE',
        resultType: 'COMPETITIVE',
        winnerUserId: userHost.id,
        durationSeconds: 120,
        participants: [
          { userId: userHost.id, playerNameSnapshot: userHost.displayName, scoreValue: 15, scoreLabel: '15 pts', placement: 1, outcome: 'WIN', isWinner: true },
          { userId: userGuest.id, playerNameSnapshot: userGuest.displayName, scoreValue: 10, scoreLabel: '10 pts', placement: 2, outcome: 'LOSS', isWinner: false },
        ],
      };

      const findSpy = vi.spyOn(prisma.match, 'findUnique').mockResolvedValue(existingMatch as any);
      const upsertStatsSpy = vi.spyOn(prisma.userGameStats, 'upsert');

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        if (typeof callback === 'function') {
          return callback(prisma);
        }
        return [{}, {}];
      });

      const result = await matchFinalizationService.finalizeMatch(session);

      expect(result.matchId).toBe('match-existing-real-id');
      expect(findSpy).toHaveBeenCalled();
      // Ensure stats upsert is NOT called on idempotent retry!
      expect(upsertStatsSpy).not.toHaveBeenCalled();
    });

    it('10. Competitive ties and multiplayer placements (2, 3, 4 players)', () => {
      // A. 2-player competitive tie
      const context2PTie: GameEngineContext = {
        sessionId: 's-2p',
        gameId: 'basketball-rivalry',
        mode: 'couple',
        participants: [
          { userId: 'p1', name: 'P1', seatIndex: 0 },
          { userId: 'p2', name: 'P2', seatIndex: 1 },
        ],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'COMPLETED',
        scores: { p1: 12, p2: 12 },
      };
      const res2PTie = evaluateGameResult(context2PTie);
      expect(res2PTie.resultType).toBe('DRAW');
      expect(res2PTie.winnerUserId).toBeNull();
      expect(res2PTie.participants.every((p) => p.placement === 1 && p.outcome === 'DRAW')).toBe(true);

      // B. 3-player game with tie for 1st place
      const context3P: GameEngineContext = {
        sessionId: 's-3p',
        gameId: 'snatch-the-fries',
        mode: 'friend',
        participants: [
          { userId: 'p1', name: 'P1', seatIndex: 0 },
          { userId: 'p2', name: 'P2', seatIndex: 1 },
          { userId: 'p3', name: 'P3', seatIndex: 2 },
        ],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'COMPLETED',
        scores: { p1: 20, p2: 20, p3: 10 },
      };
      const res3P = evaluateGameResult(context3P);
      expect(res3P.resultType).toBe('DRAW');
      const p1 = res3P.participants.find((p) => p.userId === 'p1');
      const p2 = res3P.participants.find((p) => p.userId === 'p2');
      const p3 = res3P.participants.find((p) => p.userId === 'p3');
      expect(p1?.placement).toBe(1);
      expect(p1?.outcome).toBe('DRAW');
      expect(p2?.placement).toBe(1);
      expect(p2?.outcome).toBe('DRAW');
      expect(p3?.placement).toBe(3);
      expect(p3?.outcome).toBe('LOSS');

      // C. 4-player game distinct placements
      const context4P: GameEngineContext = {
        sessionId: 's-4p',
        gameId: 'uno-style',
        mode: 'friend',
        participants: [
          { userId: 'p1', name: 'P1', seatIndex: 0 },
          { userId: 'p2', name: 'P2', seatIndex: 1 },
          { userId: 'p3', name: 'P3', seatIndex: 2 },
          { userId: 'p4', name: 'P4', seatIndex: 3 },
        ],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'COMPLETED',
        scores: { p1: 100, p2: 75, p3: 50, p4: 25 },
      };
      const res4P = evaluateGameResult(context4P);
      expect(res4P.resultType).toBe('COMPETITIVE');
      expect(res4P.winnerUserId).toBe('p1');
      expect(res4P.participants.find((p) => p.userId === 'p1')?.placement).toBe(1);
      expect(res4P.participants.find((p) => p.userId === 'p2')?.placement).toBe(2);
      expect(res4P.participants.find((p) => p.userId === 'p3')?.placement).toBe(3);
      expect(res4P.participants.find((p) => p.userId === 'p4')?.placement).toBe(4);

      // D. Aloo Golf: LOWEST strokes wins
      const contextGolf: GameEngineContext = {
        sessionId: 's-golf',
        gameId: 'aloo-golf',
        mode: 'couple',
        participants: [
          { userId: 'p1', name: 'P1', seatIndex: 0 },
          { userId: 'p2', name: 'P2', seatIndex: 1 },
        ],
        state: { totalHoles: 3 },
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'COMPLETED',
        scores: { p1: 4, p2: 6 }, // p1 took fewer strokes!
      };
      const resGolf = evaluateGameResult(contextGolf);
      expect(resGolf.resultType).toBe('COMPETITIVE');
      expect(resGolf.winnerUserId).toBe('p1');
      expect(resGolf.participants.find((p) => p.userId === 'p1')?.outcome).toBe('WIN');
      expect(resGolf.participants.find((p) => p.userId === 'p2')?.outcome).toBe('LOSS');
    });
  });

  // =========================================================================
  // 4. CORS Enforcement (HTTP and Socket.IO)
  // =========================================================================
  describe('CORS Enforcement in HTTP & Socket.IO', () => {
    it('11. Unknown browser origins are rejected with CORS error', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'https://malicious-attacker-site.com');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('CORS Forbidden');
      expect(res.body.message).toContain('CORS origin "https://malicious-attacker-site.com" not allowed');
    });

    it('11b. Permitted origins succeed with credentials header', async () => {
      const res = await request(app)
        .get('/api/v1/health')
        .set('Origin', 'http://localhost:5173');

      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  // =========================================================================
  // 5. Account Suspension & Availability Enforcement
  // =========================================================================
  describe('Account Status & Availability Enforcement', () => {
    it('12. Suspended accounts cannot access protected REST routes (403)', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(userSuspended as any);

      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-user-suspended-41');

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('12b. Suspended accounts cannot establish Socket.IO connection', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(userSuspended as any);

      const clientSocket: ClientSocketType = ClientSocket(`http://127.0.0.1:${serverPort}`, {
        auth: { token: 'test-mock-token-user-suspended-41' },
        transports: ['websocket'],
        reconnection: false,
      });

      const err: Error = await new Promise((resolve) => {
        clientSocket.on('connect_error', (e) => resolve(e));
        clientSocket.on('connect', () => resolve(new Error('Unexpectedly connected!')));
      });

      clientSocket.close();
      expect(err.message).toContain('Account has been suspended');
    });

    it('13. Database failure does not bypass account checks (503)', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockRejectedValueOnce(
        new Error('Database connection pool exhausted')
      );

      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-user-host-41');

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('DATABASE_UNAVAILABLE');
    });

    it('13b. Missing profile cannot bypass account check (403)', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-non-existent-user')
        .send({ displayName: 'New Name' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('PROFILE_NOT_FOUND');
    });

    it('14. Disabled games cannot start through direct API calls', async () => {
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue({
        id: 'room-dis-1',
        code: 'DIS001',
        hostId: userHost.id,
        mode: 'COUPLE',
        selectedGameId: 'kabza',
        participants: [
          { userId: userHost.id, isReady: true, leftAt: null, user: userHost },
          { userId: userGuest.id, isReady: true, leftAt: null, user: userGuest },
        ],
      } as any);

      vi.spyOn(prisma.gameConfiguration, 'findUnique').mockResolvedValue({
        gameId: 'kabza',
        isEnabled: false, // Disabled by admin!
        coupleEnabled: true,
        friendEnabled: true,
      } as any);

      await expect(
        gameSessionService.createSession('DIS001', 'kabza', userHost.id)
      ).rejects.toThrow('currently disabled by administrators');
    });

    it('15. Couple-only restrictions cannot be bypassed in Friend Mode', async () => {
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue({
        id: 'room-co-1',
        code: 'FRND99',
        hostId: userHost.id,
        mode: 'FRIEND', // Friend mode room!
        selectedGameId: 'truth-or-dare',
        participants: [
          { userId: userHost.id, isReady: true, leftAt: null, user: userHost },
          { userId: userGuest.id, isReady: true, leftAt: null, user: userGuest },
          { userId: 'u3', isReady: true, leftAt: null, user: { displayName: 'P3' } },
        ],
      } as any);

      await expect(
        gameSessionService.createSession('FRND99', 'truth-or-dare', userHost.id)
      ).rejects.toThrow('restricted to Couple Mode only');
    });
  });
});
