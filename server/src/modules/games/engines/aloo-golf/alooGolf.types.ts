export interface HoleHazard {
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'BUTTER' | 'SAND';
}

export interface HoleObstacle {
  x: number;
  y: number;
  radius: number;
}

export interface CourseHole {
  number: number;
  name: string;
  par: number;
  startX: number;
  startY: number;
  holeX: number;
  holeY: number;
  hazards: HoleHazard[];
  obstacles: HoleObstacle[];
}

export interface BallPos {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sunk: boolean;
}

export interface AlooGolfState {
  currentHoleIdx: number;
  currentTurnUserId: string;
  balls: Record<string, BallPos>;
  holeStrokes: Record<number, Record<string, number>>;
  totalStrokes: Record<string, number>;
  lastTrajectory?: Array<{ x: number; y: number; sunk: boolean }>;
  matchOver: boolean;
  winnerUserId: string | null;
  isDraw: boolean;
}

export type AlooGolfAction = {
  type: 'STROKE';
  angle: number; // in degrees
  power: number; // 5 to 100
};

