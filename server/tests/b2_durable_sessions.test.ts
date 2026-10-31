import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { gameSessionService } from '../src/modules/games/core/gameSession.service.js';
import { gameStateService } from '../src/modules/games/core/gameState.service.js';
import { gameActionService } from '../src/modules/games/core/gameAction.service.js';
import { gameEngineFactory } from '../src/modules/games/core/gameEngineFactory.js';
import type { GameEngineContext } from '../src/modules/games/core/gameEngine.types.js';

describe('PlaySpace Wave 2 — B2 Durable Game Sessions & Concurrency Safety', () => {
  const userA = { id: 'usr-b2-a', username: 'player_a', displayName: 'Player A' };
  const userB = { id: 'usr-b2-b', username: 'player_b', displayName: 'Player B' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Session Restart Recovery (PostgreSQL Source of Truth)', () => {
    it('restores active game session from DB into memory cache when evicted or restarted', async () => {
      const sessionId = 'session-restore-uuid-1';
      gameStateService.removeSession(sessionId);
      expect(gameStateService.getSession(sessionId)).toBeNull();

      vi.spyOn(prisma.gameSession, 'findUnique').mockResolvedValueOnce({
        id: sessionId,
        roomId: 'room-restore-1',
        gameId: 'tic-tac-toe',
        mode: 'COUPLE',
        status: 'ACTIVE',
        stateVersion: 3,
        currentTurnUserId: userA.id,
        publicState: {
          board: ['X', null, null, null, 'O', null, null, null, null],
          currentTurnUserId: userA.id,
          winnerUserId: null,
          isDraw: false,
        },
        rngSeed: 'feedbeef1234',
        startedAt: new Date(),
        participants: [
          { userId: userA.id, seatIndex: 0, score: 10, privateState: null, user: userA },
          { userId: userB.id, seatIndex: 1, score: 5, privateState: null, user: userB },
        ],
        room: { id: 'room-restore-1', hostId: userA.id },
      } as any);

      vi.spyOn(prisma.gameAction, 'findMany').mockResolvedValueOnce([
        { actionId: 'act-prior-1' },
        { actionId: 'act-prior-2' },
      ] as any);

      const restored = await gameSessionService.restoreSession(sessionId);

      expect(restored).not.toBeNull();
      expect(restored?.sessionId).toBe(sessionId);
      expect(restored?.gameId).toBe('tic-tac-toe');
      expect(restored?.version).toBe(3);
      expect(restored?.scores[userA.id]).toBe(10);
      expect(restored?.scores[userB.id]).toBe(5);

      // Verifies past actions are populated into idempotency set
      expect(gameStateService.isActionProcessed(sessionId, 'act-prior-1')).toBe(true);
      expect(gameStateService.isActionProcessed(sessionId, 'act-prior-2')).toBe(true);
      expect(gameStateService.isActionProcessed(sessionId, 'act-new-99')).toBe(false);

      // Verified present in gameStateService cache
      expect(gameStateService.getSession(sessionId)).not.toBeNull();
    });

    it('transparently recovers session in applyAction if memory cache was cold', async () => {
      const sessionId = 'session-cold-action-1';
      gameStateService.removeSession(sessionId);

      vi.spyOn(prisma.gameSession, 'findUnique').mockResolvedValueOnce({
        id: sessionId,
        roomId: 'room-cold-1',
        gameId: 'tic-tac-toe',
        mode: 'COUPLE',
        status: 'ACTIVE',
        stateVersion: 1,
        currentTurnUserId: userA.id,
        publicState: {
          board: Array(9).fill(null),
          currentSymbol: 'X',
          currentTurnUserId: userA.id,
          duelistXUserId: userA.id,
          duelistOUserId: userB.id,
          roundStatus: 'PLAYING',
          history: [],
          winnerUserId: null,
          isDraw: false,
        },
        rngSeed: 'rng123',
        startedAt: new Date(),
        participants: [
          { userId: userA.id, seatIndex: 0, score: 0, privateState: null, user: userA },
          { userId: userB.id, seatIndex: 1, score: 0, privateState: null, user: userB },
        ],
        room: { id: 'room-cold-1', hostId: userA.id },
      } as any);

      vi.spyOn(prisma.gameAction, 'findMany').mockResolvedValueOnce([]);
      vi.spyOn(prisma.gameAction, 'findFirst').mockResolvedValueOnce(null);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          gameSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          gameAction: { create: vi.fn().mockResolvedValue({}) },
          gameSessionParticipant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        });
      });

      const res = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'act-cold-1',
          expectedVersion: 1,
          action: { type: 'MAKE_MOVE', cellIndex: 4 },
        },
        userA.id
      );

      expect(res.success).toBe(true);
      expect(res.version).toBe(2);
      expect((res.publicState?.state as any)?.board[4]).toBe('X');
    });
  });

  describe('One Active Session Per Room Constraint', () => {
    it('rejects createSession if an ACTIVE session already exists for the room', async () => {
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue({
        id: 'room-busy-1',
        code: 'BUSY01',
        hostId: userA.id,
        mode: 'COUPLE',
        status: 'READY_TO_START',
        participants: [
          { userId: userA.id, leftAt: null, isReady: true, user: userA },
          { userId: userB.id, leftAt: null, isReady: true, user: userB },
        ],
      } as any);

      vi.spyOn(prisma.gameConfiguration, 'findUnique').mockResolvedValue(null);

      // Existing active session is already represented in the local cache.
      const activeContext: GameEngineContext = {
        sessionId: 'sess-already-active',
        roomId: 'room-busy-1',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [
          { userId: userA.id, name: userA.displayName, seatIndex: 0, isHost: true },
          { userId: userB.id, name: userB.displayName, seatIndex: 1, isHost: false },
        ],
        state: {},
        privateStates: {},
        version: 3,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };
      gameStateService.setSession(activeContext.sessionId, activeContext);
      vi.spyOn(prisma.gameSession, 'findFirst').mockResolvedValue({
        id: activeContext.sessionId,
        roomId: 'room-busy-1',
        gameId: 'tic-tac-toe',
        status: 'ACTIVE',
      } as any);

      const result = await gameSessionService.createSession('room-busy-1', 'tic-tac-toe', userA.id);
      expect(result.created).toBe(false);
      expect(result.session.sessionId).toBe(activeContext.sessionId);
    });
  });

  describe('Rematch Validation & Mode Configuration Checks', () => {
    it('rejects rematch if active player count violates game requirements', async () => {
      const prevSession: GameEngineContext = {
        sessionId: 'sess-rematch-viol-1',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [
          { userId: userA.id, name: userA.displayName, seatIndex: 0, isHost: true },
        ],
        state: {},
        privateStates: {},
        version: 5,
        isPaused: false,
        status: 'COMPLETED',
        scores: {},
        roomId: 'room-single-player',
      };
      gameStateService.setSession('sess-rematch-viol-1', prevSession);

      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue({
        id: 'room-single-player',
        code: 'SOLO01',
        hostId: userA.id,
        mode: 'COUPLE',
        status: 'COMPLETED',
        expiresAt: new Date(Date.now() + 60_000),
        participants: [
          // The active-only Prisma relation filter excludes the guest who left.
          { userId: userA.id, leftAt: null, isReady: true, user: userA },
        ],
      } as any);

      await expect(
        gameSessionService.rematchSession('sess-rematch-viol-1', userA.id)
      ).rejects.toThrow('Invalid player count');
    });

    it('rejects rematch if room is CLOSED', async () => {
      const prevSession: GameEngineContext = {
        sessionId: 'sess-closed-room-1',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [
          { userId: userA.id, name: userA.displayName, seatIndex: 0, isHost: true },
          { userId: userB.id, name: userB.displayName, seatIndex: 1, isHost: false },
        ],
        state: {},
        privateStates: {},
        version: 5,
        isPaused: false,
        status: 'COMPLETED',
        scores: {},
        roomId: 'room-closed-1',
      };
      gameStateService.setSession('sess-closed-room-1', prevSession);

      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue({
        id: 'room-closed-1',
        code: 'CLSD01',
        hostId: userA.id,
        mode: 'COUPLE',
        status: 'CLOSED',
        participants: [
          { userId: userA.id, leftAt: null, isReady: true, user: userA },
          { userId: userB.id, leftAt: null, isReady: true, user: userB },
        ],
      } as any);

      await expect(
        gameSessionService.rematchSession('sess-closed-room-1', userA.id)
      ).rejects.toThrow('Cannot initiate rematch in a closed or expired room.');
    });
  });

  describe('UNO Deck State Durability Across Evictions', () => {
    it('restores draw and discard piles from context.state._serverPiles when cache is lost', () => {
      const unoEngine = gameEngineFactory.getEngine('uno-style');
      const initial = unoEngine.createInitialState({
        sessionId: 'uno-durability-test-1',
        mode: 'couple',
        participants: [
          { userId: userA.id, name: userA.displayName, seatIndex: 0 },
          { userId: userB.id, name: userB.displayName, seatIndex: 1 },
        ],
        rngSeed: 'unorng123',
      });

      // Verify piles are captured in state for serialization
      expect((initial.state as any)._serverPiles).toBeDefined();
      expect((initial.state as any)._serverPiles.drawPile.length).toBeGreaterThan(0);
      expect((initial.state as any)._serverPiles.discardPile.length).toBeGreaterThan(0);

      // Verify getPublicProjection hides _serverPiles from public client view
      const publicProj = unoEngine.getPublicProjection(initial.state, {} as any);
      expect((publicProj as any)._serverPiles).toBeUndefined();
    });
  });

  describe('Question Source of Truth & Concurrency Conflict', () => {
    it('rethrows error when QuestionEntry query fails with a database error and does not swallow it', async () => {
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue({
        id: 'room-truth-1',
        code: 'TRUTH1',
        hostId: userA.id,
        mode: 'COUPLE',
        status: 'READY_TO_START',
        participants: [
          { userId: userA.id, leftAt: null, isReady: true, user: userA },
          { userId: userB.id, leftAt: null, isReady: true, user: userB },
        ],
      } as any);

      vi.spyOn(prisma.gameConfiguration, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.gameSession, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.questionEntry, 'findMany').mockRejectedValue(new Error('Question database unreachable'));

      await expect(
        gameSessionService.createSession('room-truth-1', 'truth-or-dare', userA.id)
      ).rejects.toThrow('Question database unreachable');
    });

    it('rejects createSession inside the transaction if concurrent active session exists', async () => {
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue({
        id: 'room-atomic-1',
        code: 'ATOM01',
        hostId: userA.id,
        mode: 'COUPLE',
        status: 'READY_TO_START',
        participants: [
          { userId: userA.id, leftAt: null, isReady: true, user: userA },
          { userId: userB.id, leftAt: null, isReady: true, user: userB },
        ],
      } as any);

      vi.spyOn(prisma.gameConfiguration, 'findUnique').mockResolvedValue(null);
      // Pre-check finds nothing:
      vi.spyOn(prisma.gameSession, 'findFirst').mockResolvedValue(null);

      // But transaction check catches concurrent session:
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        return cb({
          gameSession: {
            findFirst: vi.fn().mockResolvedValue({ id: 'sess-race-won', status: 'ACTIVE' }),
          },
          room: { update: vi.fn() },
        });
      });

      await expect(
        gameSessionService.createSession('room-atomic-1', 'tic-tac-toe', userA.id)
      ).rejects.toThrow('An active game session already exists for this room.');
    });
  });
});
