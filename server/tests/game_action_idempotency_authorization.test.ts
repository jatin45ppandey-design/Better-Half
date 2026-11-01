import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { gameActionService } from '../src/modules/games/core/gameAction.service.js';
import { gameEngineFactory } from '../src/modules/games/core/gameEngineFactory.js';
import { gameStateService } from '../src/modules/games/core/gameState.service.js';

const participantA = { userId: 'action-auth-player-a', name: 'Player A', seatIndex: 0, isHost: true };
const participantB = { userId: 'action-auth-player-b', name: 'Player B', seatIndex: 1, isHost: false };
const outsiderId = 'action-auth-outsider';

function installSession(sessionId: string, status: 'ACTIVE' | 'COMPLETED' = 'ACTIVE') {
  const participants = [participantA, participantB];
  const initial = gameEngineFactory.getEngine('tic-tac-toe').createInitialState({
    sessionId,
    mode: 'couple',
    participants,
    rngSeed: 'idempotency-auth-regression-seed',
  });

  gameStateService.setSession(sessionId, {
    sessionId,
    gameId: 'tic-tac-toe',
    mode: 'couple',
    participants,
    state: initial.state,
    privateStates: initial.privateStates,
    version: 4,
    isPaused: false,
    status,
    scores: initial.scores,
    currentTurnUserId: participantA.userId,
  });
}

describe('Game action idempotency authorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    gameStateService.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    gameStateService.reset();
  });

  it('rejects a non-participant before acknowledging an in-memory processed action ID', async () => {
    const sessionId = 'idempotency-auth-memory';
    const actionId = 'already-processed-memory-action';
    installSession(sessionId);
    gameStateService.markActionProcessed(sessionId, actionId);

    const databaseLookup = vi.spyOn(prisma.gameAction, 'findFirst');

    const result = await gameActionService.applyAction(
      {
        sessionId,
        actionId,
        expectedVersion: 4,
        action: { type: 'MAKE_MOVE', cellIndex: 0 },
      },
      outsiderId
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('You are not a participant in this game session.');
    expect(result.publicState).toBeUndefined();
    expect(databaseLookup).not.toHaveBeenCalled();
  });

  it('rejects a non-participant before looking up a previously persisted action ID', async () => {
    const sessionId = 'idempotency-auth-persisted';
    const actionId = 'already-committed-database-action';
    installSession(sessionId);

    const databaseLookup = vi
      .spyOn(prisma.gameAction, 'findFirst')
      .mockResolvedValue({ id: 'persisted-action' } as any);

    const result = await gameActionService.applyAction(
      {
        sessionId,
        actionId,
        expectedVersion: 4,
        action: { type: 'MAKE_MOVE', cellIndex: 0 },
      },
      outsiderId
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe('You are not a participant in this game session.');
    expect(result.publicState).toBeUndefined();
    expect(databaseLookup).not.toHaveBeenCalled();
  });

  it('still acknowledges a legitimate participant retry after the original action completed the session', async () => {
    const sessionId = 'idempotency-auth-completed-retry';
    installSession(sessionId, 'COMPLETED');

    const databaseLookup = vi
      .spyOn(prisma.gameAction, 'findFirst')
      .mockResolvedValue({ id: 'persisted-completed-action' } as any);

    const result = await gameActionService.applyAction(
      {
        sessionId,
        actionId: 'persisted-completed-action-id',
        expectedVersion: 3,
        action: { type: 'MAKE_MOVE', cellIndex: 0 },
      },
      participantA.userId
    );

    expect(result.success).toBe(true);
    expect(result.version).toBe(4);
    expect(result.publicState).toBeDefined();
    expect(databaseLookup).toHaveBeenCalledOnce();
  });
});
