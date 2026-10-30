export interface ServerPen {
  id: string;
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  length: number;
  width: number;
  isAlive: boolean;
}

export interface PenFightState {
  arenaWidth: number;
  arenaHeight: number;
  padding: number;
  round: number;
  currentTurnUserId: string;
  pens: ServerPen[];
  roundWins: Record<string, number>;
  roundStatus: 'PLAYING' | 'ROUND_OVER' | 'MATCH_OVER';
  roundWinnerUserId: string | null;
  matchWinnerUserId: string | null;
  targetRoundWins: number;
  lastFlickUserId: string | null;
  simulationFrames?: Array<Array<{ id: string; x: number; y: number; angle: number; isAlive: boolean }>>;
}

export type PenFightAction =
  | {
      type: 'FLICK_PEN';
      dx: number;
      dy: number;
      power: number; // 10 to 100
    }
  | {
      type: 'START_NEXT_ROUND';
    };

