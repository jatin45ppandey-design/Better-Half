import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type {
  TicTacToeState,
  TicTacToeAction,
} from './ticTacToe.types.js';

const WINNING_COMBOS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export class TicTacToeEngine
  implements IGameEngine<TicTacToeState, Record<string, never>, TicTacToeAction>
{
  readonly gameId = 'tic-tac-toe';

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
  }): {
    state: TicTacToeState;
    privateStates: Record<string, Record<string, never>>;
    currentTurnUserId: string;
    scores: Record<string, number>;
  } {
    const pX = params.participants[0].userId;
    const pO = params.participants[1]?.userId || params.participants[0].userId;
    const waitingQueue = params.participants.slice(2).map((p) => p.userId);

    const scores: Record<string, number> = {};
    params.participants.forEach((p) => {
      scores[p.userId] = 0;
    });

    const state: TicTacToeState = {
      board: Array(9).fill(null),
      currentSymbol: 'X',
      currentTurnUserId: pX,
      duelistXUserId: pX,
      duelistOUserId: pO,
      waitingQueueUserIds: waitingQueue,
      seriesFormat: 3,
      currentRound: 1,
      xWins: 0,
      oWins: 0,
      draws: 0,
      roundStatus: 'PLAYING',
      winningCombo: null,
      matchWinnerUserId: null,
      history: [],
    };

    return {
      state,
      privateStates: {},
      currentTurnUserId: pX,
      scores,
    };
  }

  validateAction(
    action: TicTacToeAction,
    context: GameEngineContext<TicTacToeState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (action.type === 'MAKE_MOVE') {
      if (context.state.roundStatus !== 'PLAYING') {
        return { valid: false, error: 'Current round is finished.' };
      }
      if (context.state.currentTurnUserId !== actorUserId) {
        return { valid: false, error: 'Not your turn.' };
      }
      const cell = action.cellIndex;
      if (cell < 0 || cell > 8 || !Number.isInteger(cell)) {
        return { valid: false, error: 'Invalid cell index.' };
      }
      if (context.state.board[cell] !== null) {
        return { valid: false, error: 'Cell is already occupied.' };
      }
      return { valid: true };
    }

    if (action.type === 'START_NEXT_ROUND') {
      if (context.state.roundStatus === 'PLAYING') {
        return { valid: false, error: 'Round is still in progress.' };
      }
      if (context.state.matchWinnerUserId) {
        return { valid: false, error: 'Match series has already concluded.' };
      }
      return { valid: true };
    }

    if (action.type === 'SET_SERIES_FORMAT') {
      if (context.state.currentRound > 1 || context.state.board.some((c) => c !== null)) {
        return { valid: false, error: 'Series format can only be set before moves are made.' };
      }
      if (![1, 3, 5].includes(action.format)) {
        return { valid: false, error: 'Format must be Best of 1, 3, or 5.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: TicTacToeAction,
    context: GameEngineContext<TicTacToeState>,
    _actorUserId: string
  ): ActionResult<TicTacToeState> {
    const state = { ...context.state };
    const scores = { ...context.scores };

    if (action.type === 'SET_SERIES_FORMAT') {
      state.seriesFormat = action.format;
      return {
        success: true,
        newState: state,
      };
    }

    if (action.type === 'START_NEXT_ROUND') {
      state.board = Array(9).fill(null);
      state.roundStatus = 'PLAYING';
      state.winningCombo = null;
      state.currentRound += 1;
      // Alternate starting symbol each round
      state.currentSymbol = state.currentRound % 2 === 1 ? 'X' : 'O';
      state.currentTurnUserId = state.currentSymbol === 'X' ? state.duelistXUserId : state.duelistOUserId;

      return {
        success: true,
        newState: state,
        nextTurnUserId: state.currentTurnUserId,
      };
    }

    if (action.type === 'MAKE_MOVE') {
      const newBoard = [...state.board];
      newBoard[action.cellIndex] = state.currentSymbol;
      state.board = newBoard;

      // Check winning combos
      let winnerCombo: number[] | null = null;
      for (const combo of WINNING_COMBOS) {
        const [a, b, c] = combo;
        if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
          winnerCombo = combo;
          break;
        }
      }

      if (winnerCombo) {
        const winnerSymbol = state.currentSymbol;
        const winnerId = winnerSymbol === 'X' ? state.duelistXUserId : state.duelistOUserId;
        state.winningCombo = winnerCombo;
        state.roundStatus = winnerSymbol === 'X' ? 'X_WON' : 'O_WON';

        if (winnerSymbol === 'X') {
          state.xWins += 1;
        } else {
          state.oWins += 1;
        }

        scores[winnerId] = (scores[winnerId] || 0) + 1;

        state.history = [
          { round: state.currentRound, winner: winnerSymbol, board: newBoard },
          ...state.history,
        ];

        // Check if series is won
        const targetWins = Math.ceil(state.seriesFormat / 2);
        const seriesWon = state.xWins >= targetWins || state.oWins >= targetWins;

        if (seriesWon) {
          state.matchWinnerUserId = winnerId;

          // In Friend Mode with queue, rotate waiting player in next match if applicable
          if (state.waitingQueueUserIds.length > 0) {
            const loserId = winnerSymbol === 'X' ? state.duelistOUserId : state.duelistXUserId;
            const nextChallenger = state.waitingQueueUserIds[0];
            const updatedQueue = [...state.waitingQueueUserIds.slice(1), loserId];
            state.waitingQueueUserIds = updatedQueue;
            state.duelistXUserId = winnerId;
            state.duelistOUserId = nextChallenger;
          }

          return {
            success: true,
            newState: state,
            isCompleted: true,
            winnerUserId: winnerId,
            scores,
            events: [
              {
                type: 'ttt:seriesWon',
                payload: { winnerUserId: winnerId, xWins: state.xWins, oWins: state.oWins },
              },
            ],
          };
        }

        return {
          success: true,
          newState: state,
          scores,
          events: [
            {
              type: 'ttt:roundWon',
              payload: { winnerUserId: winnerId, winnerSymbol, combo: winnerCombo },
            },
          ],
        };
      }

      // Check Draw
      const isDraw = newBoard.every((cell) => cell !== null);
      if (isDraw) {
        state.roundStatus = 'DRAW';
        state.draws += 1;
        state.history = [
          { round: state.currentRound, winner: 'DRAW', board: newBoard },
          ...state.history,
        ];

        return {
          success: true,
          newState: state,
          events: [{ type: 'ttt:draw', payload: { round: state.currentRound } }],
        };
      }

      // Switch turn
      state.currentSymbol = state.currentSymbol === 'X' ? 'O' : 'X';
      const nextUserId = state.currentSymbol === 'X' ? state.duelistXUserId : state.duelistOUserId;
      state.currentTurnUserId = nextUserId;

      return {
        success: true,
        newState: state,
        nextTurnUserId: nextUserId,
      };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(state: TicTacToeState): Record<string, unknown> {
    return {
      board: state.board,
      currentSymbol: state.currentSymbol,
      currentTurnUserId: state.currentTurnUserId,
      duelistXUserId: state.duelistXUserId,
      duelistOUserId: state.duelistOUserId,
      waitingQueueUserIds: state.waitingQueueUserIds,
      seriesFormat: state.seriesFormat,
      currentRound: state.currentRound,
      xWins: state.xWins,
      oWins: state.oWins,
      draws: state.draws,
      roundStatus: state.roundStatus,
      winningCombo: state.winningCombo,
      matchWinnerUserId: state.matchWinnerUserId,
      history: state.history.slice(0, 5),
    };
  }

  getPrivateProjection(): null {
    return null;
  }
}
