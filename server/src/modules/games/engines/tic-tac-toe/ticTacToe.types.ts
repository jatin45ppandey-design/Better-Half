export type BoardCell = 'X' | 'O' | null;

export interface TicTacToeState {
  board: BoardCell[]; // 9 cells
  currentSymbol: 'X' | 'O';
  currentTurnUserId: string;
  duelistXUserId: string;
  duelistOUserId: string;
  waitingQueueUserIds: string[];
  seriesFormat: 1 | 3 | 5;
  currentRound: number;
  xWins: number;
  oWins: number;
  draws: number;
  roundStatus: 'PLAYING' | 'X_WON' | 'O_WON' | 'DRAW';
  winningCombo: number[] | null;
  matchWinnerUserId: string | null;
  history: Array<{
    round: number;
    winner: 'X' | 'O' | 'DRAW';
    board: BoardCell[];
  }>;
}

export type TicTacToeAction =
  | {
      type: 'MAKE_MOVE';
      cellIndex: number;
    }
  | {
      type: 'START_NEXT_ROUND';
    }
  | {
      type: 'SET_SERIES_FORMAT';
      format: 1 | 3 | 5;
    };

