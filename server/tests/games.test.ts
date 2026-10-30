import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'node:http';
import { io as Client, type Socket as ClientSocket } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { createSocketServer } from '../src/socket/index.js';
import { gameSessionService } from '../src/modules/games/core/gameSession.service.js';
import { gameEngineFactory } from '../src/modules/games/core/gameEngineFactory.js';
import { gameStateService } from '../src/modules/games/core/gameState.service.js';
import { prisma } from '../src/config/prisma.js';
import { safeSocketError } from '../src/socket/safeError.js';
import { AppError } from '../src/utils/errors.js';

describe('PlaySpace Phase 3 — All 11 Server Game Engines & Real-time Integration', () => {
  let server: http.Server;
  let ioServer: any;
  let serverPort: number;
  let clientA: ClientSocket;
  let clientB: ClientSocket;

  const userA = {
    id: 'user-p3-a',
    username: 'alex',
    displayName: 'Alex',
    avatarInitials: 'AX',
    avatarColor: '#9670E8',
  };

  const userB = {
    id: 'user-p3-b',
    username: 'jordan',
    displayName: 'Jordan',
    avatarInitials: 'JD',
    avatarColor: '#D94C65',
  };

  const tokenA = 'test-mock-token-user-p3-a';
  const tokenB = 'test-mock-token-user-p3-b';

  beforeAll(async () => {
    // Mock userProfile for socket auth middleware
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue({
      id: 'any-user',
      accountStatus: 'ACTIVE',
    } as any);

    vi.spyOn(prisma.gameAction, 'findFirst').mockResolvedValue(null);
    vi.spyOn(prisma.gameSession, 'update').mockResolvedValue({} as any);
    vi.spyOn(prisma.gameConfiguration, 'findUnique').mockResolvedValue(null);
    vi.spyOn(prisma, '$transaction').mockImplementation(async (arg: any) => {
      if (typeof arg === 'function') {
        return arg({
          gameSession: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          gameAction: { create: vi.fn().mockResolvedValue({}) },
          gameSessionParticipant: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          match: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'm-1' }) },
          matchParticipant: { create: vi.fn().mockResolvedValue({}) },
          userGameStats: { upsert: vi.fn().mockResolvedValue({}) },
          rivalryStats: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn().mockResolvedValue({}) },
          userProfile: { findMany: vi.fn().mockResolvedValue([]) },
        });
      }
      return [{}, {}];
    });

    // Mock Prisma Room find for game session initialization
    vi.spyOn(prisma.room, 'findUnique').mockImplementation(async ({ where }: any) => {
      const code = where.code || 'COUPLE99';
      return {
        id: 'room-p3-couple',
        code,
        hostId: userA.id,
        name: 'Couple Room',
        mode: 'COUPLE',
        status: 'READY_TO_START',
        selectedGameId: 'truth-or-dare',
        maxPlayers: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 3600000),
        participants: [
          {
            id: 'part-p3-a',
            roomId: 'room-p3-couple',
            userId: userA.id,
            role: 'HOST',
            isReady: true,
            joinedAt: new Date(),
            updatedAt: new Date(),
            leftAt: null,
            user: userA,
          },
          {
            id: 'part-p3-b',
            roomId: 'room-p3-couple',
            userId: userB.id,
            role: 'PLAYER',
            isReady: true,
            joinedAt: new Date(),
            updatedAt: new Date(),
            leftAt: null,
            user: userB,
          },
        ],
      } as any;
    });

    vi.spyOn(prisma, '$transaction').mockResolvedValue([{}, {}] as any);

    const app = createApp();
    server = http.createServer(app);
    ioServer = createSocketServer(server);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });

    // Connect two test clients
    clientA = Client(`http://127.0.0.1:${serverPort}`, {
      auth: { token: tokenA },
      transports: ['websocket'],
    });

    clientB = Client(`http://127.0.0.1:${serverPort}`, {
      auth: { token: tokenB },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((resolve) => clientA.on('connect', resolve)),
      new Promise<void>((resolve) => clientB.on('connect', resolve)),
    ]);
  });

  afterAll(async () => {
    clientA?.disconnect();
    clientB?.disconnect();
    ioServer?.close();
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
  // 1. GAME 1: Truth or Dare Engine Tests
  // =========================================================================
  describe('Game 1: Truth or Dare Engine', () => {
    const engine = gameEngineFactory.getEngine('truth-or-dare');

    it('initializes couple mode with 2 players and 0 skips used', () => {
      const init = engine.createInitialState({
        sessionId: 'test-tod-1',
        mode: 'couple',
        participants: [
          { userId: userA.id, name: userA.displayName, seatIndex: 0 },
          { userId: userB.id, name: userB.displayName, seatIndex: 1 },
        ],
        rngSeed: 'seed123',
      });

      expect(init.state.currentTurnUserId).toBe(userA.id);
      expect(init.state.skipsUsed[userA.id]).toBe(0);
      expect(init.state.skipsUsed[userB.id]).toBe(0);
      expect(init.state.history.length).toBe(0);
    });

    it('rejects action when not the active player turn', () => {
      const context: any = {
        sessionId: 'test-tod-1',
        gameId: 'truth-or-dare',
        state: { currentTurnUserId: userA.id, skipsUsed: {} },
        participants: [],
      };

      const val = engine.validateAction({ type: 'CHOOSE_TYPE', promptType: 'truth' }, context, userB.id);
      expect(val.valid).toBe(false);
      expect(val.error).toBe('Not your turn.');
    });

    it('picks a prompt, allows completion, and alternates turn to partner', () => {
      const context: any = {
        sessionId: 'test-tod-1',
        gameId: 'truth-or-dare',
        state: {
          currentTurnUserId: userA.id,
          selectedType: null,
          currentPrompt: null,
          category: 'Romantic',
          intensity: 'Spicy',
          skipsUsed: { [userA.id]: 0, [userB.id]: 0 },
          completedCount: { [userA.id]: 0, [userB.id]: 0 },
          history: [],
          totalTurns: 0,
        },
        participants: [
          { userId: userA.id, name: userA.displayName, seatIndex: 0 },
          { userId: userB.id, name: userB.displayName, seatIndex: 1 },
        ],
        scores: { [userA.id]: 0, [userB.id]: 0 },
      };

      // 1. Choose type
      const res1 = engine.applyAction({ type: 'CHOOSE_TYPE', promptType: 'truth' }, context, userA.id);
      expect(res1.success).toBe(true);
      expect(res1.newState?.currentPrompt).toBeTruthy();
      expect(res1.newState?.selectedType).toBe('truth');

      // 2. Complete prompt
      context.state = res1.newState;
      const res2 = engine.applyAction({ type: 'COMPLETE' }, context, userA.id);
      expect(res2.success).toBe(true);
      expect(res2.nextTurnUserId).toBe(userB.id);
      expect(res2.newState?.completedCount[userA.id]).toBe(1);
      expect(res2.scores?.[userA.id]).toBe(1);
    });

    it('enforces skip limit of 2 per player', () => {
      const context: any = {
        sessionId: 'test-tod-1',
        gameId: 'truth-or-dare',
        state: {
          currentTurnUserId: userA.id,
          currentPrompt: { id: 't1', text: 'Prompt' },
          skipsUsed: { [userA.id]: 2 },
        },
        participants: [],
      };

      const val = engine.validateAction({ type: 'SKIP' }, context, userA.id);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('Maximum 2 skips allowed');
    });
  });

  // =========================================================================
  // 2. GAME 2: Would You Rather Engine Tests
  // =========================================================================
  describe('Game 2: Would You Rather Engine', () => {
    const engine = gameEngineFactory.getEngine('would-you-rather');

    it('keeps choices in private state and reveals only when both submitted', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'wyr-sess-1',
        mode: 'couple',
        participants,
        rngSeed: 'seed',
      });

      const context: any = {
        sessionId: 'wyr-sess-1',
        gameId: 'would-you-rather',
        state: init.state,
        privateStates: init.privateStates,
        participants,
        scores: init.scores,
      };

      // Player A submits 'A'
      const resA = engine.applyAction({ type: 'SUBMIT_CHOICE', choice: 'A' }, context, userA.id);
      expect(resA.success).toBe(true);
      expect(resA.newState?.phase).toBe('ANSWERING');
      expect(resA.newState?.submittedUserIds).toContain(userA.id);
      expect(resA.newState?.revealedChoices).toBeNull(); // Private!
      expect(resA.newPrivateStates?.[userA.id].pendingChoice).toBe('A');

      // Player B submits 'A' -> Both submitted -> Reveal!
      context.state = resA.newState;
      context.privateStates = resA.newPrivateStates;

      const resB = engine.applyAction({ type: 'SUBMIT_CHOICE', choice: 'A' }, context, userB.id);
      expect(resB.success).toBe(true);
      expect(resB.newState?.phase).toBe('REVEAL');
      expect(resB.newState?.revealedChoices?.[userA.id]).toBe('A');
      expect(resB.newState?.revealedChoices?.[userB.id]).toBe('A');
      expect(resB.newState?.matchCount).toBe(1); // Both picked 'A'
      expect(resB.scores?.[userA.id]).toBe(10);
      expect(resB.scores?.[userB.id]).toBe(10);
    });

    it('rejects double submission for same dilemma', () => {
      const context: any = {
        state: {
          phase: 'ANSWERING',
          submittedUserIds: [userA.id],
        },
        privateStates: {},
      };

      const val = engine.validateAction({ type: 'SUBMIT_CHOICE', choice: 'B' }, context, userA.id);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('already submitted');
    });
  });

  // =========================================================================
  // 3. GAME 3: Blind Ranking Engine Tests
  // =========================================================================
  describe('Game 3: Blind Ranking Engine', () => {
    const engine = gameEngineFactory.getEngine('blind-ranking');

    it('locks chosen slots and reveals completed boards with correct scoring', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'br-sess',
        mode: 'couple',
        participants,
        rngSeed: 'brseed',
      });

      const context: any = {
        sessionId: 'br-sess',
        gameId: 'blind-ranking',
        mode: 'couple',
        state: init.state,
        privateStates: init.privateStates,
        participants,
        scores: init.scores,
      };

      // Place 5 items sequentially
      for (let itemIdx = 0; itemIdx < 5; itemIdx++) {
        // Player A places at slot itemIdx
        const resA = engine.applyAction({ type: 'PLACE_ITEM', slotIndex: itemIdx }, context, userA.id);
        context.state = resA.newState;
        context.privateStates = resA.newPrivateStates;

        // Player B places at slot itemIdx
        const resB = engine.applyAction({ type: 'PLACE_ITEM', slotIndex: itemIdx }, context, userB.id);
        context.state = resB.newState;
        context.privateStates = resB.newPrivateStates;
      }

      // After 5 items, phase should be REVEAL and match score calculated
      expect(context.state.phase).toBe('REVEAL');
      expect(context.state.revealedBoards).toBeTruthy();
      expect(context.state.isPerfectMatch).toBe(true);
      // 5 * 10 + 50 perfect bonus = 100 pts
      expect(context.state.alignmentScore).toBe(100);
    });

    it('rejects placement into an already occupied slot', () => {
      const context: any = {
        state: { phase: 'RANKING', submittedCurrentItemUserIds: [] },
        privateStates: {
          [userA.id]: { board: ['Item 1', null, null, null, null] },
        },
      };

      const val = engine.validateAction({ type: 'PLACE_ITEM', slotIndex: 0 }, context, userA.id);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('already occupied');
    });
  });

  // =========================================================================
  // 4. GAME 4: Original UNO-style Card Game Engine Tests
  // =========================================================================
  describe('Game 4: Original UNO-style Card Game Engine', () => {
    const engine = gameEngineFactory.getEngine('uno-style');

    it('deals 7 cards per player and hides hands in private state', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'uno-sess-1',
        mode: 'couple',
        participants,
        rngSeed: 'unoseed',
      });

      expect(init.privateStates[userA.id].hand.length).toBe(7);
      expect(init.privateStates[userB.id].hand.length).toBe(7);
      expect(init.state.cardCounts[userA.id]).toBe(7);
      expect(init.state.cardCounts[userB.id]).toBe(7);
      expect(init.state.topDiscard).toBeTruthy();

      const pub = engine.getPublicProjection(init.state);
      expect((pub as any).hand).toBeUndefined(); // Zero leakage!
    });

    it('validates legal color and value matching and rejects illegal card', () => {
      const topDiscard: any = { id: 'c1', color: 'purple', value: '5', label: '5' };
      const context: any = {
        sessionId: 'uno-sess-1',
        state: {
          currentTurnUserId: userA.id,
          topDiscard,
          activeColor: 'purple',
          winnerUserId: null,
        },
        privateStates: {
          [userA.id]: {
            hand: [
              { id: 'c-match-color', color: 'purple', value: '2', label: '2' },
              { id: 'c-match-val', color: 'amber', value: '5', label: '5' },
              { id: 'c-illegal', color: 'emerald', value: '8', label: '8' },
            ],
          },
        },
      };

      expect(engine.validateAction({ type: 'PLAY_CARD', cardId: 'c-match-color' }, context, userA.id).valid).toBe(true);
      expect(engine.validateAction({ type: 'PLAY_CARD', cardId: 'c-match-val' }, context, userA.id).valid).toBe(true);
      expect(engine.validateAction({ type: 'PLAY_CARD', cardId: 'c-illegal' }, context, userA.id).valid).toBe(false);
    });

    it('treats Reverse as Skip in 2-player couple mode', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const reverseCard: any = { id: 'rev-card', color: 'purple', value: 'reverse', label: 'REV' };
      const context: any = {
        sessionId: 'uno-sess-rev',
        participants,
        state: {
          currentTurnUserId: userA.id,
          topDiscard: { id: 'c0', color: 'purple', value: '1', label: '1' },
          activeColor: 'purple',
          direction: 1,
          cardCounts: { [userA.id]: 2, [userB.id]: 2 },
          hasDrawnThisTurn: false,
          winnerUserId: null,
        },
        privateStates: {
          [userA.id]: { hand: [reverseCard, { id: 'c-extra', color: 'purple', value: '9', label: '9' }] },
          [userB.id]: { hand: [{ id: 'b1', color: 'purple', value: '2', label: '2' }] },
        },
        scores: {},
      };

      const res = engine.applyAction({ type: 'PLAY_CARD', cardId: 'rev-card' }, context, userA.id);
      expect(res.success).toBe(true);
      // In 2-player mode, reverse skips opponent, keeping turn with User A!
      expect(res.nextTurnUserId).toBe(userA.id);
    });
  });

  // =========================================================================
  // 5. GAME 5: Tic Tac Toe Engine Tests
  // =========================================================================
  describe('Game 5: Tic Tac Toe Engine', () => {
    const engine = gameEngineFactory.getEngine('tic-tac-toe');

    it('enforces turn alternation, rejects occupied cell, and detects win', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'ttt-sess-1',
        mode: 'couple',
        participants,
        rngSeed: 'tttseed',
      });

      const context: any = {
        sessionId: 'ttt-sess-1',
        state: init.state,
        participants,
        scores: init.scores,
      };

      // Turn 1: User A ('X') plays cell 0
      const res1 = engine.applyAction({ type: 'MAKE_MOVE', cellIndex: 0 }, context, userA.id);
      expect(res1.success).toBe(true);
      expect(res1.newState?.board[0]).toBe('X');
      expect(res1.nextTurnUserId).toBe(userB.id);

      // Attempt occupied cell 0 by User B -> rejected!
      context.state = res1.newState;
      const valOccupied = engine.validateAction({ type: 'MAKE_MOVE', cellIndex: 0 }, context, userB.id);
      expect(valOccupied.valid).toBe(false);
      expect(valOccupied.error).toContain('already occupied');

      // Turn 2: User B ('O') plays cell 3
      const res2 = engine.applyAction({ type: 'MAKE_MOVE', cellIndex: 3 }, context, userB.id);
      context.state = res2.newState;

      // Turn 3: User A ('X') plays cell 1
      const res3 = engine.applyAction({ type: 'MAKE_MOVE', cellIndex: 1 }, context, userA.id);
      context.state = res3.newState;

      // Turn 4: User B ('O') plays cell 4
      const res4 = engine.applyAction({ type: 'MAKE_MOVE', cellIndex: 4 }, context, userB.id);
      context.state = res4.newState;

      // Turn 5: User A ('X') plays cell 2 -> Top row [0, 1, 2] completed! Win!
      const res5 = engine.applyAction({ type: 'MAKE_MOVE', cellIndex: 2 }, context, userA.id);
      expect(res5.success).toBe(true);
      expect(res5.newState?.roundStatus).toBe('X_WON');
      expect(res5.newState?.winningCombo).toEqual([0, 1, 2]);
      expect(res5.scores?.[userA.id]).toBe(1);
    });

    it('detects a draw when all 9 cells are filled with no winning combo', () => {
      // Board with Draw scenario:
      // X O X
      // X X O
      // O X O
      const board: any[] = ['X', 'O', 'X', 'X', 'X', 'O', 'O', null, 'O'];
      const context: any = {
        state: {
          board,
          currentSymbol: 'X',
          currentTurnUserId: userA.id,
          duelistXUserId: userA.id,
          duelistOUserId: userB.id,
          roundStatus: 'PLAYING',
          currentRound: 1,
          draws: 0,
          history: [],
        },
        participants: [
          { userId: userA.id, name: userA.displayName, seatIndex: 0 },
          { userId: userB.id, name: userB.displayName, seatIndex: 1 },
        ],
        scores: {},
      };

      const res = engine.applyAction({ type: 'MAKE_MOVE', cellIndex: 7 }, context, userA.id);
      expect(res.success).toBe(true);
      expect(res.newState?.roundStatus).toBe('DRAW');
      expect(res.newState?.draws).toBe(1);
    });
  });

  // =========================================================================
  // 6. GAME 6: Pen Fight Engine Tests
  // =========================================================================
  describe('Game 6: Pen Fight Engine', () => {
    const engine = gameEngineFactory.getEngine('pen-fight');

    it('simulates 2D launch physics and eliminates out-of-boundary pen', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'pf-sess',
        mode: 'couple',
        participants,
        rngSeed: 'pfseed',
      });

      const context: any = {
        sessionId: 'pf-sess',
        state: init.state,
        participants,
        scores: init.scores,
      };

      // Flick towards center: dx: 1, dy: 1, power: 50
      const res = engine.applyAction({ type: 'FLICK_PEN', dx: 1, dy: 1, power: 50 }, context, userA.id);
      expect(res.success).toBe(true);
      expect(res.newState?.simulationFrames?.length).toBeGreaterThan(0);
      expect(res.newState?.pens[0].x).not.toBe(init.state.pens[0].x);
    });
  });

  // =========================================================================
  // 7. GAME 7: Kabza Engine Tests
  // =========================================================================
  describe('Game 7: Kabza Engine', () => {
    const engine = gameEngineFactory.getEngine('kabza');

    it('claims cells and captures opponent when flanked on 2 orthogonal sides', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'kabza-sess',
        mode: 'couple',
        participants,
        rngSeed: 'kseed',
      });

      const context: any = {
        sessionId: 'kabza-sess',
        state: init.state,
        participants,
        scores: init.scores,
      };

      // Set up a flank scenario at (1, 1):
      // Enemy cell at (1, 1) owned by User B.
      // Active player User A already owns (0, 1) [North].
      // User A clicks (1, 2) [East] -> surrounding friendly sides >= 2 -> captures (1, 1)!
      context.state.board[1 * 6 + 1].ownerId = userB.id; // (1, 1)
      context.state.board[1].ownerId = userA.id; // (0, 1)

      const res = engine.applyAction({ type: 'CLAIM_CELL', row: 1, col: 2 }, context, userA.id);
      expect(res.success).toBe(true);
      expect(res.newState?.board[1 * 6 + 2].ownerId).toBe(userA.id);
      expect(res.newState?.board[1 * 6 + 1].ownerId).toBe(userA.id); // Captured!
      expect(res.newState?.lastCaptureCount).toBe(1);
    });
  });

  // =========================================================================
  // 8. GAME 8: Basketball Rivalry Engine Tests
  // =========================================================================
  describe('Game 8: Basketball Rivalry Engine', () => {
    const engine = gameEngineFactory.getEngine('basketball-rivalry');

    it('calculates trajectory and scores swish (+3 pts) and on-fire bonus', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'bball-sess',
        mode: 'couple',
        participants,
        rngSeed: 'bbseed',
      });

      const context: any = {
        sessionId: 'bball-sess',
        state: init.state,
        participants,
        scores: init.scores,
      };

      // Test shooting with angle 52, power 70
      const res = engine.applyAction({ type: 'SHOOT', angle: 52, power: 70 }, context, userA.id);
      expect(res.success).toBe(true);
      expect(res.newState?.lastShotResult?.trajectory.length).toBeGreaterThan(0);
      expect(res.newState?.shotsTaken[userA.id]).toBe(1);
      expect(res.nextTurnUserId).toBe(userB.id);
    });
  });

  // =========================================================================
  // 9. GAME 9: Snatch the Fries Engine Tests
  // =========================================================================
  describe('Game 9: Snatch the Fries Engine', () => {
    const engine = gameEngineFactory.getEngine('snatch-the-fries');

    it('applies false start penalty if snatched while waiting', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'fries-sess',
        mode: 'couple',
        participants,
        rngSeed: 'fseed',
      });

      const context: any = {
        sessionId: 'fries-sess',
        state: init.state,
        participants,
        scores: init.scores,
      };

      const res = engine.applyAction({ type: 'SNATCH', dropId: 'fry-1' }, context, userA.id);
      expect(res.success).toBe(true);
      expect(res.newState?.dropState).toBe('FALSE_START');
      expect(res.scores?.[userA.id]).toBe(-50); // False start penalty
    });

    it('awards points to the first valid snatch and rejects second tap', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'fries-sess',
        mode: 'couple',
        participants,
        rngSeed: 'fseed',
      });

      const context: any = {
        sessionId: 'fries-sess',
        state: init.state,
        participants,
        scores: init.scores,
      };

      // Spawn a Golden fry
      const resSpawn = engine.applyAction({ type: 'SPAWN_DROP', forcedType: 'GOLDEN' }, context, userA.id);
      context.state = resSpawn.newState;
      const fryId = context.state.currentDrop.id;

      // Player A snatches
      const resA = engine.applyAction({ type: 'SNATCH', dropId: fryId }, context, userA.id);
      expect(resA.success).toBe(true);
      expect(resA.scores?.[userA.id]).toBe(250); // Golden fry = +250
      expect(resA.newState?.snatchedByUserId).toBe(userA.id);

      // Player B attempts to snatch already snatched fry -> rejected!
      context.state = resA.newState;
      const valB = engine.validateAction({ type: 'SNATCH', dropId: fryId }, context, userB.id);
      expect(valB.valid).toBe(false);
      expect(valB.error).toContain('already snatched');
    });
  });

  // =========================================================================
  // 10. GAME 10: Aloo Golf Engine Tests
  // =========================================================================
  describe('Game 10: Aloo Golf Engine', () => {
    const engine = gameEngineFactory.getEngine('aloo-golf');

    it('records stroke count and advances potato position with surface friction', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'golf-sess',
        mode: 'couple',
        participants,
        rngSeed: 'gseed',
      });

      const context: any = {
        sessionId: 'golf-sess',
        state: init.state,
        participants,
        scores: init.scores,
      };

      const res = engine.applyAction({ type: 'STROKE', angle: 0, power: 60 }, context, userA.id);
      expect(res.success).toBe(true);
      expect(res.newState?.totalStrokes[userA.id]).toBe(1);
      expect(res.newState?.lastTrajectory?.length).toBeGreaterThan(0);
      expect(res.nextTurnUserId).toBe(userB.id);
    });
  });

  // =========================================================================
  // 11. GAME 11: BETWEEN US Engine Tests
  // =========================================================================
  describe('Game 11: BETWEEN US Engine', () => {
    const engine = gameEngineFactory.getEngine('between-us');

    it('requires mutual consent from BOTH partners for Level 5 (After Dark 18+)', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'bu-sess',
        mode: 'couple',
        participants,
        rngSeed: 'buseed',
      });

      const context: any = {
        sessionId: 'bu-sess',
        state: init.state,
        privateStates: init.privateStates,
        participants,
        scores: init.scores,
      };

      // Only User A grants consent
      context.state.adultConsentUserIds = [userA.id];
      const val1 = engine.validateAction({ type: 'SET_SETTINGS', intensity: 5 }, context, userA.id);
      expect(val1.valid).toBe(false);
      expect(val1.error).toContain('mutual consent');

      // User B also grants consent
      context.state.adultConsentUserIds = [userA.id, userB.id];
      const val2 = engine.validateAction({ type: 'SET_SETTINGS', intensity: 5 }, context, userA.id);
      expect(val2.valid).toBe(true);
    });

    it('never reveals answers early and clears answer buffers immediately upon reveal', () => {
      const participants = [
        { userId: userA.id, name: userA.displayName, seatIndex: 0 },
        { userId: userB.id, name: userB.displayName, seatIndex: 1 },
      ];

      const init = engine.createInitialState({
        sessionId: 'bu-sess-priv',
        mode: 'couple',
        participants,
        rngSeed: 'buseed',
      });

      const context: any = {
        sessionId: 'bu-sess-priv',
        state: init.state,
        privateStates: init.privateStates,
        participants,
        scores: init.scores,
      };

      // User A submits private secret answer
      const resA = engine.applyAction({ type: 'SUBMIT_ANSWER', answer: 'My secret answer A' }, context, userA.id);
      expect(resA.success).toBe(true);
      expect(resA.newState?.phase).toBe('ANSWERING');
      expect(resA.newState?.revealedAnswers).toBeNull(); // Private!
      expect(resA.newPrivateStates?.[userA.id].pendingAnswer).toBe('My secret answer A');

      // User B submits answer -> Reveal!
      context.state = resA.newState;
      context.privateStates = resA.newPrivateStates;

      const resB = engine.applyAction({ type: 'SUBMIT_ANSWER', answer: 'My secret answer B' }, context, userB.id);
      expect(resB.success).toBe(true);
      expect(resB.newState?.phase).toBe('REVEAL');
      expect(resB.newState?.revealedAnswers?.[userA.id]).toBe('My secret answer A');
      expect(resB.newState?.revealedAnswers?.[userB.id]).toBe('My secret answer B');

      // Strict privacy check: pendingAnswer buffers must be wiped!
      expect(resB.newPrivateStates?.[userA.id].pendingAnswer).toBeNull();
      expect(resB.newPrivateStates?.[userB.id].pendingAnswer).toBeNull();
    });
  });

  // =========================================================================
  // 12. Socket.IO Real-Time Integration Tests
  // =========================================================================
  describe('Socket.IO Real-Time Multi-Client Game Integration', () => {
    it('synchronizes game session start, action broadcasting, and pause state', async () => {
      // 1. Create a live game session
      const { session } = await gameSessionService.createSession(
        'room-p3-couple',
        'tic-tac-toe',
        userA.id
      );

      expect(session.sessionId).toBeTruthy();

      // 2. Both clients join game session
      const joinA = await new Promise<any>((resolve) => {
        clientA.emit('game:session:join', { sessionId: session.sessionId }, resolve);
      });
      const joinB = await new Promise<any>((resolve) => {
        clientB.emit('game:session:join', { sessionId: session.sessionId }, resolve);
      });

      expect(joinA.success).toBe(true);
      expect(joinB.success).toBe(true);
      expect(joinA.publicState.gameId).toBe('tic-tac-toe');

      // 3. Client A submits action -> Client B receives broadcasted game:state
      const statePromiseB = new Promise<any>((resolve) => {
        clientB.once('game:state', resolve);
      });

      const actionRes = await new Promise<any>((resolve) => {
        clientA.emit(
          'game:action',
          {
            sessionId: session.sessionId,
            actionId: 'act-test-1',
            expectedVersion: 1,
            action: { type: 'MAKE_MOVE', cellIndex: 0 },
          },
          resolve
        );
      });

      expect(actionRes.success).toBe(true);

      const receivedStateB = await statePromiseB;
      expect(receivedStateB.publicState.state.board[0]).toBe('X');

      // 4. Client A pauses match -> Client B receives game:paused
      const pausePromiseB = new Promise<any>((resolve) => {
        clientB.once('game:paused', resolve);
      });

      clientA.emit('game:pause', { sessionId: session.sessionId });
      const pauseDataB = await pausePromiseB;
      expect(pauseDataB.sessionId).toBe(session.sessionId);
      expect(pauseDataB.pausedBy).toBe(userA.id);

      // 5. Client A resumes match
      const resumePromiseB = new Promise<any>((resolve) => {
        clientB.once('game:resumed', resolve);
      });

      clientA.emit('game:resume', { sessionId: session.sessionId });
      const resumeDataB = await resumePromiseB;
      expect(resumeDataB.sessionId).toBe(session.sessionId);
    });
  });
  describe('Socket error safety', () => {
    it('preserves typed application errors and hides unexpected internal messages', () => {
      expect(safeSocketError(new AppError('Only the host can start this game.', 403), 'Action failed.'))
        .toBe('Only the host can start this game.');
      expect(safeSocketError(new Error('password=secret; SQL SELECT * FROM UserProfile'), 'Action failed.'))
        .toBe('Action failed.');
    });
  });

  describe('Session private projection authorization', () => {
    it('returns each participant only their own private state and denies outsiders', () => {
      const sessionId = 'wave1-private-projection-test';
      const project = vi.fn((privateState: unknown) => ({ privateState }));
      const engineSpy = vi.spyOn(gameEngineFactory, 'getEngine').mockReturnValue({
        getPrivateProjection: project,
      } as any);

      gameStateService.setSession(sessionId, {
        sessionId,
        gameId: 'truth-or-dare',
        mode: 'couple',
        participants: [
          { userId: 'private-user-a', name: 'Player A', seatIndex: 0 },
          { userId: 'private-user-b', name: 'Player B', seatIndex: 1 },
        ],
        state: { round: 1 },
        privateStates: {
          'private-user-a': { secret: 'A-only-answer' },
          'private-user-b': { secret: 'B-only-answer' },
        },
        version: 1,
        isPaused: false,
        status: 'ACTIVE',
        scores: {},
      } as any);

      try {
        expect(gameStateService.getPrivateProjection(sessionId, 'private-user-a')).toEqual({
          privateState: { secret: 'A-only-answer' },
        });
        expect(gameStateService.getPrivateProjection(sessionId, 'private-user-b')).toEqual({
          privateState: { secret: 'B-only-answer' },
        });
        expect(gameStateService.getPrivateProjection(sessionId, 'unrelated-user')).toBeNull();
        expect(project).toHaveBeenCalledTimes(2);
      } finally {
        gameStateService.removeSession(sessionId);
        engineSpy.mockRestore();
      }
    });
  });

});
