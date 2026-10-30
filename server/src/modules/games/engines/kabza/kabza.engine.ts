import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type { KabzaCell, KabzaState, KabzaAction } from './kabza.types.js';

const GRID_SIZE = 6;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

export class KabzaEngine
  implements IGameEngine<KabzaState, Record<string, never>, KabzaAction>
{
  readonly gameId = 'kabza';

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
  }): {
    state: KabzaState;
    privateStates: Record<string, Record<string, never>>;
    currentTurnUserId: string;
    scores: Record<string, number>;
  } {
    const board: KabzaCell[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        board.push({ row: r, col: c, ownerId: null });
      }
    }

    const territoryCounts: Record<string, number> = {};
    const scores: Record<string, number> = {};
    params.participants.forEach((p) => {
      territoryCounts[p.userId] = 0;
      scores[p.userId] = 0;
    });

    const currentTurnUserId = params.participants[0].userId;

    const state: KabzaState = {
      gridSize: GRID_SIZE,
      board,
      currentTurnUserId,
      turnIndex: 0,
      territoryCounts,
      lastCaptureCount: 0,
      roundOver: false,
      winnerUserId: null,
      isDraw: false,
    };

    return {
      state,
      privateStates: {},
      currentTurnUserId,
      scores,
    };
  }

  validateAction(
    action: KabzaAction,
    context: GameEngineContext<KabzaState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (action.type === 'CLAIM_CELL') {
      if (context.state.roundOver) {
        return { valid: false, error: 'Match is already over.' };
      }
      if (context.state.currentTurnUserId !== actorUserId) {
        return { valid: false, error: 'Not your turn to claim a territory.' };
      }
      const { row, col } = action;
      if (
        row < 0 ||
        row >= GRID_SIZE ||
        col < 0 ||
        col >= GRID_SIZE ||
        !Number.isInteger(row) ||
        !Number.isInteger(col)
      ) {
        return { valid: false, error: 'Invalid board coordinates.' };
      }
      const idx = row * GRID_SIZE + col;
      if (context.state.board[idx].ownerId !== null) {
        return { valid: false, error: 'Cell is already claimed.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: KabzaAction,
    context: GameEngineContext<KabzaState>,
    actorUserId: string
  ): ActionResult<KabzaState> {
    const state = { ...context.state };
    const participants = context.participants;
    const scores = { ...context.scores };

    if (action.type === 'CLAIM_CELL') {
      const getCellIndex = (r: number, c: number) => r * GRID_SIZE + c;
      const clickedIdx = getCellIndex(action.row, action.col);

      // Reset capturedThisTurn flag
      const newBoard = state.board.map((cell) => ({
        ...cell,
        capturedThisTurn: false,
      }));

      // Claim clicked cell
      newBoard[clickedIdx].ownerId = actorUserId;

      // Check orthogonal neighbors of clicked cell
      const neighbors = [
        { r: action.row - 1, c: action.col },
        { r: action.row + 1, c: action.col },
        { r: action.row, c: action.col - 1 },
        { r: action.row, c: action.col + 1 },
      ];

      let capturedTotal = 0;

      neighbors.forEach((n) => {
        if (n.r >= 0 && n.r < GRID_SIZE && n.c >= 0 && n.c < GRID_SIZE) {
          const nIdx = getCellIndex(n.r, n.c);
          const neighborCell = newBoard[nIdx];

          // If owned by opponent, evaluate surrounding
          if (neighborCell.ownerId && neighborCell.ownerId !== actorUserId) {
            const surrounding = [
              { r: n.r - 1, c: n.c },
              { r: n.r + 1, c: n.c },
              { r: n.r, c: n.c - 1 },
              { r: n.r, c: n.c + 1 },
            ];

            const friendlySides = surrounding.filter(
              (s) =>
                s.r >= 0 &&
                s.r < GRID_SIZE &&
                s.c >= 0 &&
                s.c < GRID_SIZE &&
                newBoard[getCellIndex(s.r, s.c)].ownerId === actorUserId
            ).length;

            if (friendlySides >= 2) {
              neighborCell.ownerId = actorUserId;
              neighborCell.capturedThisTurn = true;
              capturedTotal++;
            }
          }
        }
      });

      state.board = newBoard;
      state.lastCaptureCount = capturedTotal;

      // Update territory counts
      const updatedCounts: Record<string, number> = {};
      participants.forEach((p) => {
        const count = newBoard.filter((c) => c.ownerId === p.userId).length;
        updatedCounts[p.userId] = count;
        scores[p.userId] = count;
      });
      state.territoryCounts = updatedCounts;

      // Check completion: all 36 cells claimed
      const claimedCount = newBoard.filter((c) => c.ownerId !== null).length;

      if (claimedCount === TOTAL_CELLS) {
        state.roundOver = true;

        // Determine winner
        let highest = -1;
        let winnerId: string | null = null;
        let isTie = false;

        participants.forEach((p) => {
          const count = updatedCounts[p.userId] || 0;
          if (count > highest) {
            highest = count;
            winnerId = p.userId;
            isTie = false;
          } else if (count === highest) {
            isTie = true;
          }
        });

        state.winnerUserId = isTie ? null : winnerId;
        state.isDraw = isTie;

        return {
          success: true,
          newState: state,
          isCompleted: true,
          winnerUserId: state.winnerUserId,
          scores,
          events: [
            {
              type: 'kabza:completed',
              payload: {
                winnerUserId: state.winnerUserId,
                isDraw: state.isDraw,
                territoryCounts: updatedCounts,
              },
            },
          ],
        };
      }

      // Rotate turn
      state.turnIndex += 1;
      const nextUserId = participants[state.turnIndex % participants.length].userId;
      state.currentTurnUserId = nextUserId;

      return {
        success: true,
        newState: state,
        nextTurnUserId: nextUserId,
        scores,
        events:
          capturedTotal > 0
            ? [
                {
                  type: 'kabza:captured',
                  payload: { actorUserId, capturedTotal },
                },
              ]
            : undefined,
      };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(state: KabzaState): Record<string, unknown> {
    return {
      gridSize: state.gridSize,
      board: state.board,
      currentTurnUserId: state.currentTurnUserId,
      turnIndex: state.turnIndex,
      territoryCounts: state.territoryCounts,
      lastCaptureCount: state.lastCaptureCount,
      roundOver: state.roundOver,
      winnerUserId: state.winnerUserId,
      isDraw: state.isDraw,
    };
  }

  getPrivateProjection(): null {
    return null;
  }
}

