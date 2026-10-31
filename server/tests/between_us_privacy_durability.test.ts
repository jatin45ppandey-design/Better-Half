import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { GameStateService, gameStateService } from '../src/modules/games/core/gameState.service.js';
import { gameSessionService } from '../src/modules/games/core/gameSession.service.js';
import { gameActionService, setTestRoomVerifier } from '../src/modules/games/core/gameAction.service.js';
import { BetweenUsEngine } from '../src/modules/games/engines/between-us/betweenUs.engine.js';
import type { GameEngineContext } from '../src/modules/games/core/gameEngine.types.js';

describe('PlaySpace — Between Us Privacy, Durability & Cache Invariant Regression Suite', () => {
  const engine = new BetweenUsEngine();

  beforeEach(() => {
    vi.restoreAllMocks();
    gameStateService.reset();
    setTestRoomVerifier(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setTestRoomVerifier(null);
  });

  describe('1. Privacy Model & Projection Isolation', () => {
    it('initializes with null pending answers and empty submitted list', () => {
      const initial = engine.createInitialState({
        sessionId: 'test-sess-bu',
        mode: 'couple',
        participants: [
          { userId: 'alice', name: 'Alice', seatIndex: 0, isHost: true },
          { userId: 'bob', name: 'Bob', seatIndex: 1, isHost: false },
        ],
        rngSeed: 'test-seed-123',
      });

      expect(initial.state.phase).toBe('ANSWERING');
      expect(initial.state.revealedAnswers).toBeNull();
      expect(initial.state.submittedUserIds).toEqual([]);
      expect(initial.privateStates['alice']).toEqual({ pendingAnswer: null });
      expect(initial.privateStates['bob']).toEqual({ pendingAnswer: null });

      const publicProj = engine.getPublicProjection(initial.state);
      expect(publicProj.revealedAnswers).toBeNull();
      expect(publicProj.submittedUserIds).toEqual([]);
    });

    it('isolates pending answer to private projection and keeps public projection masked', () => {
      const participants = [
        { userId: 'alice', name: 'Alice', seatIndex: 0, isHost: true },
        { userId: 'bob', name: 'Bob', seatIndex: 1, isHost: false },
      ];

      const initial = engine.createInitialState({
        sessionId: 'test-sess-bu',
        mode: 'couple',
        participants,
        rngSeed: 'test-seed-123',
      });

      const context: GameEngineContext = {
        sessionId: 'test-sess-bu',
        gameId: 'between-us',
        mode: 'couple',
        participants,
        state: initial.state,
        privateStates: initial.privateStates,
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: initial.scores,
      };

      // Alice submits an answer
      const result = engine.applyAction(
        { type: 'SUBMIT_ANSWER', answer: 'Alice secret love note' },
        context,
        'alice'
      );

      expect(result.success).toBe(true);
      expect(result.newState?.phase).toBe('ANSWERING');
      expect(result.newState?.submittedUserIds).toContain('alice');
      expect(result.newState?.submittedUserIds).not.toContain('bob');
      // Public state MUST NOT reveal answers
      expect(result.newState?.revealedAnswers).toBeNull();

      // Check public projection
      const publicProj = engine.getPublicProjection(result.newState as any);
      expect(publicProj.revealedAnswers).toBeNull();
      expect(publicProj.submittedUserIds).toEqual(['alice']);
      expect((publicProj as any).pendingAnswer).toBeUndefined();

      // Check Alice's private projection (sees her own answer)
      const alicePrivate = engine.getPrivateProjection(result.newPrivateStates!['alice'] as any);
      expect(alicePrivate.pendingAnswer).toBe('Alice secret love note');

      // Check Bob's private projection (does NOT see Alice's answer)
      const bobPrivate = engine.getPrivateProjection(result.newPrivateStates!['bob'] as any);
      expect(bobPrivate.pendingAnswer).toBeNull();
    });

    it('clears private buffers immediately upon mutual reveal', () => {
      const participants = [
        { userId: 'alice', name: 'Alice', seatIndex: 0, isHost: true },
        { userId: 'bob', name: 'Bob', seatIndex: 1, isHost: false },
      ];

      const initial = engine.createInitialState({
        sessionId: 'test-sess-bu',
        mode: 'couple',
        participants,
        rngSeed: 'test-seed-123',
      });

      let context: GameEngineContext = {
        sessionId: 'test-sess-bu',
        gameId: 'between-us',
        mode: 'couple',
        participants,
        state: initial.state,
        privateStates: initial.privateStates,
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: initial.scores,
      };

      // 1. Alice submits
      const res1 = engine.applyAction(
        { type: 'SUBMIT_ANSWER', answer: 'Alice truth' },
        context,
        'alice'
      );
      context = {
        ...context,
        state: res1.newState!,
        privateStates: res1.newPrivateStates!,
      };

      // 2. Bob submits -> triggers mutual reveal
      const res2 = engine.applyAction(
        { type: 'SUBMIT_ANSWER', answer: 'Bob truth' },
        context,
        'bob'
      );

      expect(res2.success).toBe(true);
      expect(res2.newState?.phase).toBe('REVEAL');
      expect(res2.newState?.revealedAnswers).toEqual({
        alice: 'Alice truth',
        bob: 'Bob truth',
      });

      // Crucial privacy check: private buffers MUST be cleared to null upon reveal
      expect(res2.newPrivateStates!['alice']).toEqual({ pendingAnswer: null });
      expect(res2.newPrivateStates!['bob']).toEqual({ pendingAnswer: null });

      const alicePrivateAfterReveal = engine.getPrivateProjection(res2.newPrivateStates!['alice'] as any);
      expect(alicePrivateAfterReveal.pendingAnswer).toBeNull();
    });
  });

  describe('2. Crash Durability & Restart Recovery', () => {
    it('restores pending answers and session state from database after simulated restart', async () => {
      const mockSessionRecord = {
        id: 'sess-restore-test',
        roomId: 'room-restore-test',
        gameId: 'between-us',
        mode: 'couple',
        status: 'ACTIVE',
        isPaused: false,
        stateVersion: 3,
        currentTurnUserId: null,
        winnerUserId: null,
        publicState: {
          category: 'All',
          intensity: 2,
          questionIndex: 0,
          currentQuestion: { id: 'q1', prompt: 'What is your favorite memory?', category: 'Couple', intensity: 2 },
          phase: 'ANSWERING',
          submittedUserIds: ['user-1'],
          adultConsentUserIds: [],
          revealedAnswers: null,
          questionsAnsweredCount: 0,
        },
        participants: [
          {
            userId: 'user-1',
            score: 0,
            seatIndex: 0,
            isHost: true,
            privateState: { pendingAnswer: 'A quiet evening in Paris' },
            user: { displayName: 'User One' },
          },
          {
            userId: 'user-2',
            score: 0,
            seatIndex: 1,
            isHost: false,
            privateState: null,
            user: { displayName: 'User Two' },
          },
        ],
      };

      vi.spyOn(prisma.gameSession, 'findUnique').mockResolvedValue(mockSessionRecord as any);

      // Verify that cache is initially empty
      expect(gameStateService.getSession('sess-restore-test')).toBeNull();

      // Restore session as would occur on cold-boot or post-eviction action
      const restored = await gameSessionService.getOrRestoreSession('sess-restore-test');

      expect(restored).not.toBeNull();
      expect(restored?.sessionId).toBe('sess-restore-test');
      expect(restored?.gameId).toBe('between-us');
      expect(restored?.version).toBe(3);
      expect(restored?.state.phase).toBe('ANSWERING');
      expect(restored?.state.submittedUserIds).toEqual(['user-1']);
      // Restored private state preserves user-1 pending answer
      expect(restored?.privateStates['user-1']).toEqual({ pendingAnswer: 'A quiet evening in Paris' });
      expect(restored?.privateStates['user-2']).toBeUndefined();

      // Verified registered in GameStateService
      const cached = gameStateService.getSession('sess-restore-test');
      expect(cached).not.toBeNull();
      expect(cached?.privateStates['user-1']?.pendingAnswer).toBe('A quiet evening in Paris');
    });
  });

  describe('3. Cache Eviction Safety & FIFO Fallback', () => {
    it('ensures active Between Us session with pending answer is never evicted while other sessions are evicted', () => {
      const customCache = new GameStateService({
        maxSessions: 2,
        sweepIntervalMs: 0,
      });

      const buContext: GameEngineContext = {
        sessionId: 'bu-active-pending',
        gameId: 'between-us',
        mode: 'couple',
        participants: [
          { userId: 'u1', name: 'User 1', seatIndex: 0, isHost: true },
          { userId: 'u2', name: 'User 2', seatIndex: 1, isHost: false },
        ],
        state: { phase: 'ANSWERING', submittedUserIds: ['u1'] },
        privateStates: {
          u1: { pendingAnswer: 'Sensitive unrevealed answer' },
          u2: { pendingAnswer: null },
        },
        version: 2,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };

      const regular1: GameEngineContext = {
        sessionId: 'regular-1',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };

      const regular2: GameEngineContext = {
        sessionId: 'regular-2',
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [],
        state: {},
        privateStates: {},
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      };

      customCache.setSession('bu-active-pending', buContext);
      customCache.setSession('regular-1', regular1);

      // Access regular-1 so bu-active-pending is older in time
      customCache.getSession('regular-1');

      // Now set regular-2: cache max is 2. The older session is bu-active-pending,
      // but because it has pending unrevealed answers, it must NOT be evicted!
      customCache.setSession('regular-2', regular2);

      expect(customCache.getSession('bu-active-pending')).not.toBeNull();
      expect(customCache.getSession('regular-2')).not.toBeNull();
      expect(customCache.getSession('regular-1')).toBeNull();

      customCache.shutdown();
    });

    it('falls back to PostgreSQL when actionId is purged from in-memory 100-action FIFO', async () => {
      const sessionId = 'fifo-test-sess';
      const mockSession: GameEngineContext = {
        sessionId,
        gameId: 'tic-tac-toe',
        mode: 'couple',
        participants: [
          { userId: 'player-x', name: 'PX', seatIndex: 0, isHost: true },
          { userId: 'player-o', name: 'PO', seatIndex: 1, isHost: false },
        ],
        state: { board: Array(9).fill(null), turn: 'X' },
        privateStates: {},
        version: 10,
        isPaused: false,
        status: 'ACTIVE',
        scores: { 'player-x': 0, 'player-o': 0 },
      };

      gameStateService.setSession(sessionId, mockSession);

      // Verify action-old is NOT in memory
      expect(gameStateService.isActionProcessed(sessionId, 'action-old')).toBe(false);

      // Simulate that action-old was committed to PostgreSQL previously
      vi.spyOn(prisma.gameAction, 'findFirst').mockResolvedValue({
        id: 'db-action-uuid',
        sessionId,
        actorUserId: 'player-x',
        actionId: 'action-old',
        sequenceNumber: 5,
        actionType: 'MAKE_MOVE',
        sanitizedMetadata: { position: 4 },
        createdAt: new Date(),
      } as any);

      // Execute gameActionService.applyAction with the purged actionId
      const result = await gameActionService.applyAction(
        {
          sessionId,
          actionId: 'action-old',
          expectedVersion: 5,
          action: { type: 'MAKE_MOVE', position: 4 },
        },
        'player-x'
      );

      // Must acknowledge idempotently without re-executing move
      expect(result.success).toBe(true);
      expect(result.version).toBe(10);
      expect(prisma.gameAction.findFirst).toHaveBeenCalledWith({
        where: { sessionId, actionId: 'action-old' },
      });
      // And must now be restored into the in-memory processed buffer
      expect(gameStateService.isActionProcessed(sessionId, 'action-old')).toBe(true);
    });
  });
});

