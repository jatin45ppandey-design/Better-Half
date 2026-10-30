export type ShotType = 'SWISH' | 'BANK' | 'MISS';

export interface ShotResult {
  type: ShotType;
  points: number;
  bonus: boolean;
  text: string;
  angle: number;
  power: number;
  trajectory: Array<{ x: number; y: number }>;
}

export interface BasketballState {
  currentTurnUserId: string;
  turnIndex: number;
  shotsTaken: Record<string, number>;
  scores: Record<string, number>;
  streaks: Record<string, number>;
  totalShotsPerPlayer: number;
  lastShotResult: ShotResult | null;
  matchOver: boolean;
  winnerUserId: string | null;
  isDraw: boolean;
}

export type BasketballAction = {
  type: 'SHOOT';
  angle: number;
  power: number;
};

