export interface KabzaCell {
  row: number;
  col: number;
  ownerId: string | null;
  capturedThisTurn?: boolean;
}

export interface KabzaState {
  gridSize: number;
  board: KabzaCell[]; // 36 cells
  currentTurnUserId: string;
  turnIndex: number;
  territoryCounts: Record<string, number>;
  lastCaptureCount: number;
  roundOver: boolean;
  winnerUserId: string | null;
  isDraw: boolean;
}

export type KabzaAction = {
  type: 'CLAIM_CELL';
  row: number;
  col: number;
};

