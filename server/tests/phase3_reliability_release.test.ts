import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { GameStateService, gameStateService } from '../src/modules/games/core/gameState.service.js';
import { gameSessionService } from '../src/modules/games/core/gameSession.service.js';
import { gameActionService, setTestRoomVerifier } from '../src/modules/games/core/gameAction.service.js';
import { presenceManager, PresenceManager } from '../src/socket/presence.js';
import { cancelSnatchTimer, cleanupSnatchTimers } from '../src/socket/gameHandlers.js';
import { roomsService } from '../src/modules/rooms/rooms.service.js';
import {
  markServerShuttingDown,
  resetServerShuttingDown,
} from '../src/modules/health/health.controller.js';
import { createShutdownHandler } from '../src/lifecycle/shutdown.js';
import type { GameEngineContext } from '../src/modules/games/core/gameEngine.types.js';

describe('PlaySpace Phase 3 — Reliability, Scalability & Release Readiness Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    gameStateService.reset();
    presenceManager.reset();
    setTestRoomVerifier(null);
    resetServerShuttingDown();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setTestRoomVerifier(null);
    resetServerShuttingDown();
  });

  describe('1. Runtime Memory & LRU Cache Management', () => {
    it('evicts least recently accessed session when maxSessions limit is reached', () => {
      const lruStateService = new GameStateService({
        maxSessions: 2,
        sweepIntervalMs: 0,
      });

      const session1: GameEngineContext = {
        sessionId: 'sess-1',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [{ userId: 'u1', name: 'User 1', seatIndex: 0, isHost: true }],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };

      const session2: GameEngineContext = {
        sessionId: 'sess-2',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [{ userId: 'u2', name: 'User 2', seatIndex: 0, isHost: true }],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };

      const session3: GameEngineContext = {
        sessionId: 'sess-3',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [{ userId: 'u3', name: 'User 3', seatIndex: 0, isHost: true }],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };

      lruStateService.setSession('sess-1', session1);
      lruStateService.setSession('sess-2', session2);

      // Access session 1 so session 2 becomes the LRU candidate
      lruStateService.getSession('sess-1');

      // Adding session 3 must trigger eviction of sess-2
      lruStateService.setSession('sess-3', session3);

      expect(lruStateService.getSession('sess-1')).not.toBeNull();
      expect(lruStateService.getSession('sess-2')).toBeNull();
      expect(lruStateService.getSession('sess-3')).not.toBeNull();
      expect(lruStateService.getActiveSessionCount()).toBe(2);

      lruStateService.shutdown();
    });

    it('protects Between Us sessions with unrevealed volatile private answers from eviction', () => {
      const protectedService = new GameStateService({
        maxSessions: 2,
        sweepIntervalMs: 0,
      });

      // sess-protected has pending unrevealed answers in memory
      const betweenUsSession: GameEngineContext = {
        sessionId: 'sess-bu-protected',
        gameId: 'between-us',
        mode: 'couple',
        participants: [
          { userId: 'u1', name: 'User 1', seatIndex: 0, isHost: true },
          { userId: 'u2', name: 'User 2', seatIndex: 1, isHost: false },
        ],
        state: {
          phase: 'ANSWERING',
          questionIndex: 1,
        },
        privateStates: {
          u1: { pendingAnswer: 'Secret confession from player 1' },
          u2: { pendingAnswer: null },
        },
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };

      const regularSession: GameEngineContext = {
        sessionId: 'sess-regular',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [{ userId: 'u3', name: 'User 3', seatIndex: 0, isHost: true }],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };

      const thirdSession: GameEngineContext = {
        sessionId: 'sess-third',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [{ userId: 'u4', name: 'User 4', seatIndex: 0, isHost: true }],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };

      protectedService.setSession('sess-bu-protected', betweenUsSession);
      protectedService.setSession('sess-regular', regularSession);

      // Verify that between-us is marked as eviction-protected
      expect(protectedService.isEvictionProtected(betweenUsSession)).toBe(true);

      // Access regular session so between-us is older in access time
      protectedService.getSession('sess-regular');

      // Adding third session: between-us is older, but it is eviction-protected,
      // so regularSession must be evicted instead!
      protectedService.setSession('sess-third', thirdSession);

      expect(protectedService.getSession('sess-bu-protected')).not.toBeNull();
      expect(protectedService.getSession('sess-third')).not.toBeNull();

      protectedService.shutdown();
    });

    it('bounds per-session processedActionIds ring buffer to prevent unbounded growth', () => {
      const service = new GameStateService({
        maxActionsPerSession: 5,
        sweepIntervalMs: 0,
      });

      const sessionId = 'sess-bounded-act';
      service.setSession(sessionId, {
        sessionId,
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      });

      // Mark 8 actions
      for (let i = 1; i <= 8; i++) {
        service.markActionProcessed(sessionId, `act-${i}`);
      }

      // Actions 1, 2, 3 must have been purged from the 5-item buffer
      expect(service.isActionProcessed(sessionId, 'act-1')).toBe(false);
      expect(service.isActionProcessed(sessionId, 'act-2')).toBe(false);
      expect(service.isActionProcessed(sessionId, 'act-3')).toBe(false);
      // Actions 4..8 must be present
      expect(service.isActionProcessed(sessionId, 'act-4')).toBe(true);
      expect(service.isActionProcessed(sessionId, 'act-8')).toBe(true);

      service.shutdown();
    });
  });

  describe('2. PresenceManager Memory Leak Remediation', () => {
    it('deletes empty room keys from roomPresence when disconnect grace expires', async () => {
      vi.useFakeTimers();
      const pm = new PresenceManager(100);

      pm.trackConnect('user-pm-1', 'sock-1');
      pm.joinRoom('room-leak-test', 'user-pm-1');

      expect(pm.getUserRooms('user-pm-1')).toContain('room-leak-test');

      let graceExpiredFired = false;
      pm.trackDisconnect('user-pm-1', 'sock-1', () => {
        graceExpiredFired = true;
      });

      // Fast forward past the 100ms grace period
      vi.advanceTimersByTime(150);

      expect(graceExpiredFired).toBe(true);
      expect(pm.getUserRooms('user-pm-1')).toHaveLength(0);
      expect(pm.getRoomOnlineUsers('room-leak-test')).toHaveLength(0);

      pm.shutdown();
      vi.useRealTimers();
    });

    it('shutdown clears all pending disconnect timers safely', () => {
      vi.useFakeTimers();
      const pm = new PresenceManager(15000);

      pm.trackConnect('user-shut-1', 'sock-shut-1');
      pm.trackDisconnect('user-shut-1', 'sock-shut-1', () => {});

      // Calling shutdown must clear the timer
      pm.shutdown();

      // Advancing timers should not cause any callback invocation or error
      vi.advanceTimersByTime(20000);

      pm.reset();
      vi.useRealTimers();
    });
  });

  describe('3. Session Recovery & Concurrent In-Flight Deduplication', () => {
    it('deduplicates concurrent getOrRestoreSession calls into a single database query', async () => {
      const sessionId = 'sess-dedup-concurrency';
      let dbLookupCount = 0;

      vi.spyOn(prisma.gameSession, 'findUnique').mockImplementation(async () => {
        dbLookupCount++;
        // Simulate small database latency
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          id: sessionId,
          gameId: 'tic-tac-toe',
          mode: 'COUPLE',
          status: 'ACTIVE',
          stateVersion: 1,
          publicState: { board: Array(9).fill(null) },
          currentTurnUserId: 'user-1',
          participants: [
            { userId: 'user-1', seatIndex: 0, score: 0, user: { displayName: 'User 1' } },
            { userId: 'user-2', seatIndex: 1, score: 0, user: { displayName: 'User 2' } },
          ],
          room: { hostId: 'user-1' },
        } as any;
      });

      vi.spyOn(prisma.gameAction, 'findMany').mockResolvedValue([]);

      // Fire 5 concurrent calls to getOrRestoreSession
      const results = await Promise.all([
        gameSessionService.getOrRestoreSession(sessionId),
        gameSessionService.getOrRestoreSession(sessionId),
        gameSessionService.getOrRestoreSession(sessionId),
        gameSessionService.getOrRestoreSession(sessionId),
        gameSessionService.getOrRestoreSession(sessionId),
      ]);

      // All 5 must receive the restored context
      expect(results).toHaveLength(5);
      results.forEach((r) => {
        expect(r).not.toBeNull();
        expect(r?.sessionId).toBe(sessionId);
      });

      // Critical: The database findUnique query was executed exactly once!
      expect(dbLookupCount).toBe(1);
    });

    it('bounds past actions query during restoration with take: 50', async () => {
      const sessionId = 'sess-bounded-actions';

      vi.spyOn(prisma.gameSession, 'findUnique').mockResolvedValue({
        id: sessionId,
        gameId: 'tic-tac-toe',
        mode: 'COUPLE',
        status: 'ACTIVE',
        stateVersion: 1,
        publicState: {},
        participants: [],
      } as any);

      let capturedFindManyArgs: any = null;
      vi.spyOn(prisma.gameAction, 'findMany').mockImplementation(async (args: any) => {
        capturedFindManyArgs = args;
        return [];
      });

      await gameSessionService.restoreSession(sessionId);

      expect(capturedFindManyArgs).not.toBeNull();
      expect(capturedFindManyArgs.take).toBe(50);
      expect(capturedFindManyArgs.orderBy).toEqual({ sequenceNumber: 'desc' });
    });
  });

  describe('4. Fail-Closed Room Verification & Room Status Gates', () => {
    it('fails closed when room lookup database error occurs', async () => {
      const sessionId = 'sess-fail-closed-db';
      const actorId = 'user-fc-1';

      const session: GameEngineContext = {
        sessionId,
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [{ userId: actorId, name: 'User 1', seatIndex: 0, isHost: true }],
        state: { board: Array(9).fill(null), currentTurnUserId: actorId },
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
        roomId: 'room-db-error-1',
      };
      gameStateService.setSession(sessionId, session);

      // Simulate database error during room state check
      setTestRoomVerifier(async () => {
        throw new Error('Connection pool exhausted / Postgres offline');
      });

      const res = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-fc-1',
          expectedVersion: 1,
          action: { type: 'MAKE_MOVE', cellIndex: 0 },
        },
        actorId
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe('Service temporarily unavailable. Could not verify room state.');
    });

    it('rejects action if associated room is not found', async () => {
      const sessionId = 'sess-missing-room';
      const actorId = 'user-fc-2';

      const session: GameEngineContext = {
        sessionId,
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [{ userId: actorId, name: 'User 2', seatIndex: 0, isHost: true }],
        state: { board: Array(9).fill(null), currentTurnUserId: actorId },
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
        roomId: 'room-nonexistent',
      };
      gameStateService.setSession(sessionId, session);

      setTestRoomVerifier(async () => null);

      const res = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-fc-2',
          expectedVersion: 1,
          action: { type: 'MAKE_MOVE', cellIndex: 0 },
        },
        actorId
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe('Cannot apply action. Associated room not found.');
    });

    it('rejects action if associated room is COMPLETED', async () => {
      const sessionId = 'sess-completed-room';
      const actorId = 'user-fc-3';

      const session: GameEngineContext = {
        sessionId,
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [{ userId: actorId, name: 'User 3', seatIndex: 0, isHost: true }],
        state: { board: Array(9).fill(null), currentTurnUserId: actorId },
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
        roomId: 'room-completed-id',
      };
      gameStateService.setSession(sessionId, session);

      setTestRoomVerifier(async () => ({
        id: 'room-completed-id',
        hostId: actorId,
        status: 'COMPLETED',
      }));

      const res = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-fc-3',
          expectedVersion: 1,
          action: { type: 'MAKE_MOVE', cellIndex: 0 },
        },
        actorId
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('completed');
    });
  });

  describe('5. Room Message Ordering & Snapshot Format', () => {
    it('formats room messages in chronological ascending order from descending query', () => {
      const messagesFromDbDesc = [
        { id: 'm3', senderId: 'u1', message: 'Third message', createdAt: new Date(3000), sender: { displayName: 'User 1' } },
        { id: 'm2', senderId: 'u2', message: 'Second message', createdAt: new Date(2000), sender: { displayName: 'User 2' } },
        { id: 'm1', senderId: 'u1', message: 'First message', createdAt: new Date(1000), sender: { displayName: 'User 1' } },
      ];

      const roomData: any = {
        id: 'rm-msg-order',
        code: 'ORDER1',
        name: 'Order Room',
        mode: 'COUPLE',
        status: 'WAITING',
        maxPlayers: 2,
        hostId: 'u1',
        participants: [
          { userId: 'u1', role: 'HOST', isReady: true, user: { displayName: 'User 1' } },
        ],
        gameVotes: [],
        messages: messagesFromDbDesc,
        gameSessions: [],
      };

      const snapshot = roomsService.formatRoomSnapshot(roomData);

      expect(snapshot.chatMessages).toHaveLength(3);
      // Chronological order: First, Second, Third
      expect(snapshot.chatMessages[0].id).toBe('m1');
      expect(snapshot.chatMessages[1].id).toBe('m2');
      expect(snapshot.chatMessages[2].id).toBe('m3');
    });
  });

  describe('6. Graceful Draining & Readiness Health Check', () => {
    it('returns 503 shutting_down on /api/v1/ready when server enters shutdown', async () => {
      const app = createApp();

      // Before shutdown: database check succeeds -> 200 ready
      vi.spyOn(prisma, '$queryRaw').mockResolvedValue([{ '?column?': 1 }]);
      const resNormal = await request(app).get('/api/v1/ready');
      expect(resNormal.status).toBe(200);
      expect(resNormal.body.status).toBe('ready');

      // Mark shutdown in progress
      markServerShuttingDown();

      const resDraining = await request(app).get('/api/v1/ready');
      expect(resDraining.status).toBe(503);
      expect(resDraining.body.status).toBe('shutting_down');
      expect(resDraining.body.database).toBe('draining');
    });

    it('executes registered cleanup callbacks before closing server', async () => {
      let cleanupRan = false;
      let ioClosed = false;

      const dummyHttp = {
        close: (cb: any) => cb(),
      } as any;

      const dummyIo = {
        emit: vi.fn(),
        close: (cb: any) => {
          ioClosed = true;
          cb();
        },
      };

      const shutdownHandler = createShutdownHandler({
        httpServer: dummyHttp,
        io: dummyIo,
        cleanupCallbacks: [
          async () => {
            cleanupRan = true;
          },
        ],
        onExit: () => {},
      });

      await shutdownHandler('SIGTERM');

      expect(cleanupRan).toBe(true);
      expect(ioClosed).toBe(true);
      expect(shutdownHandler.isShuttingDown()).toBe(true);
    });
  });

  describe('7. Snatch The Fries Timer Lifecycle', () => {
    it('cancels and cleans up snatch timers without throwing', () => {
      expect(() => {
        cancelSnatchTimer('sess-nonexistent');
        cleanupSnatchTimers();
      }).not.toThrow();
    });
  });
});
