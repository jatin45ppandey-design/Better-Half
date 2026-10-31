import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type {
  CourseHole,
  BallPos,
  AlooGolfState,
  AlooGolfAction,
} from './alooGolf.types.js';

export const COURSE_HOLES: CourseHole[] = [
  {
    number: 1,
    name: 'The Spud Meadow',
    par: 3,
    startX: 90,
    startY: 210,
    holeX: 540,
    holeY: 210,
    hazards: [{ x: 280, y: 150, width: 80, height: 120, type: 'SAND' }],
    obstacles: [],
  },
  {
    number: 2,
    name: 'Butter Slip Bunker',
    par: 3,
    startX: 80,
    startY: 320,
    holeX: 540,
    holeY: 100,
    hazards: [
      { x: 240, y: 80, width: 90, height: 100, type: 'BUTTER' },
      { x: 380, y: 220, width: 80, height: 110, type: 'SAND' },
    ],
    obstacles: [{ x: 300, y: 220, radius: 24 }],
  },
  {
    number: 3,
    name: 'Peri-Peri Volcano',
    par: 4,
    startX: 90,
    startY: 210,
    holeX: 550,
    holeY: 210,
    hazards: [
      { x: 220, y: 130, width: 70, height: 160, type: 'SAND' },
      { x: 390, y: 130, width: 70, height: 160, type: 'BUTTER' },
    ],
    obstacles: [
      { x: 310, y: 140, radius: 20 },
      { x: 310, y: 280, radius: 20 },
    ],
  },
];

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 420;
const PADDING = 20;

export class AlooGolfEngine
  implements IGameEngine<AlooGolfState, Record<string, never>, AlooGolfAction>
{
  readonly gameId = 'aloo-golf';

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
  }): {
    state: AlooGolfState;
    privateStates: Record<string, Record<string, never>>;
    currentTurnUserId: string;
    scores: Record<string, number>;
  } {
    const hole0 = COURSE_HOLES[0];
    const balls: Record<string, BallPos> = {};
    const holeStrokes: Record<number, Record<string, number>> = { 0: {}, 1: {}, 2: {} };
    const totalStrokes: Record<string, number> = {};
    const scores: Record<string, number> = {};

    params.participants.forEach((p) => {
      balls[p.userId] = {
        x: hole0.startX,
        y: hole0.startY,
        vx: 0,
        vy: 0,
        sunk: false,
      };
      holeStrokes[0][p.userId] = 0;
      holeStrokes[1][p.userId] = 0;
      holeStrokes[2][p.userId] = 0;
      totalStrokes[p.userId] = 0;
      scores[p.userId] = 0;
    });

    const currentTurnUserId = params.participants[0].userId;

    const state: AlooGolfState = {
      currentHoleIdx: 0,
      currentTurnUserId,
      balls,
      holeStrokes,
      totalStrokes,
      matchOver: false,
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
    action: AlooGolfAction,
    context: GameEngineContext<AlooGolfState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (action.type === 'STROKE') {
      if (context.state.matchOver) {
        return { valid: false, error: 'Match has ended.' };
      }
      if (context.state.currentTurnUserId !== actorUserId) {
        return { valid: false, error: 'Not your turn to stroke.' };
      }
      const ball = context.state.balls[actorUserId];
      if (ball && ball.sunk) {
        return { valid: false, error: 'Ball already sunk on this hole.' };
      }
      if (!Number.isFinite(action.angle) || action.angle < 0 || action.angle > 360) {
        return { valid: false, error: 'Stroke angle must be a finite value between 0 and 360 degrees.' };
      }
      if (!Number.isFinite(action.power) || action.power < 2 || action.power > 100) {
        return { valid: false, error: 'Stroke power must be a finite value between 2 and 100.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: AlooGolfAction,
    context: GameEngineContext<AlooGolfState>,
    actorUserId: string
  ): ActionResult<AlooGolfState> {
    const state = { ...context.state };
    const participants = context.participants;
    const scores = { ...context.scores };
    const holeIdx = state.currentHoleIdx;
    const hole = COURSE_HOLES[holeIdx];

    if (action.type === 'STROKE') {
      const ball = { ...(state.balls[actorUserId] || { x: hole.startX, y: hole.startY, vx: 0, vy: 0, sunk: false }) };
      const rad = (action.angle * Math.PI) / 180;
      const speed = action.power * 0.17;
      ball.vx = Math.cos(rad) * speed;
      ball.vy = Math.sin(rad) * speed;

      const trajectory: Array<{ x: number; y: number; sunk: boolean }> = [
        { x: ball.x, y: ball.y, sunk: false },
      ];

      // Simulate physics trajectory step by step
      const MAX_STEPS = 240;
      for (let step = 0; step < MAX_STEPS; step++) {
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Determine friction from surface
        let friction = 0.965;
        for (const h of hole.hazards) {
          if (
            ball.x >= h.x &&
            ball.x <= h.x + h.width &&
            ball.y >= h.y &&
            ball.y <= h.y + h.height
          ) {
            friction = h.type === 'SAND' ? 0.88 : 0.99;
            break;
          }
        }

        ball.vx *= friction;
        ball.vy *= friction;

        // Boundary collision
        if (ball.x < PADDING + 12) {
          ball.x = PADDING + 12;
          ball.vx = -ball.vx * 0.7;
        } else if (ball.x > CANVAS_WIDTH - PADDING - 12) {
          ball.x = CANVAS_WIDTH - PADDING - 12;
          ball.vx = -ball.vx * 0.7;
        }

        if (ball.y < PADDING + 12) {
          ball.y = PADDING + 12;
          ball.vy = -ball.vy * 0.7;
        } else if (ball.y > CANVAS_HEIGHT - PADDING - 12) {
          ball.y = CANVAS_HEIGHT - PADDING - 12;
          ball.vy = -ball.vy * 0.7;
        }

        // Obstacle bounce
        for (const obs of hole.obstacles) {
          const dx = ball.x - obs.x;
          const dy = ball.y - obs.y;
          const dist = Math.hypot(dx, dy);
          const minDist = obs.radius + 12;

          if (dist < minDist && dist > 0) {
            const nx = dx / dist;
            const ny = dy / dist;
            ball.x = obs.x + nx * minDist;
            ball.y = obs.y + ny * minDist;

            const dot = ball.vx * nx + ball.vy * ny;
            ball.vx = (ball.vx - 2 * dot * nx) * 0.75;
            ball.vy = (ball.vy - 2 * dot * ny) * 0.75;
          }
        }

        // Check Sunk in hole
        const distToHole = Math.hypot(ball.x - hole.holeX, ball.y - hole.holeY);
        if (distToHole < 16) {
          ball.x = hole.holeX;
          ball.y = hole.holeY;
          ball.vx = 0;
          ball.vy = 0;
          ball.sunk = true;
          trajectory.push({ x: ball.x, y: ball.y, sunk: true });
          break;
        }

        if (step % 2 === 0) {
          trajectory.push({
            x: Math.round(ball.x * 10) / 10,
            y: Math.round(ball.y * 10) / 10,
            sunk: false,
          });
        }

        const currentSpeed = Math.hypot(ball.vx, ball.vy);
        if (currentSpeed < 0.12) {
          ball.vx = 0;
          ball.vy = 0;
          break;
        }
      }

      state.lastTrajectory = trajectory;
      state.balls[actorUserId] = ball;

      // Increment strokes
      const curHoleStrokes = { ...(state.holeStrokes[holeIdx] || {}) };
      curHoleStrokes[actorUserId] = (curHoleStrokes[actorUserId] || 0) + 1;
      state.holeStrokes[holeIdx] = curHoleStrokes;

      state.totalStrokes[actorUserId] = (state.totalStrokes[actorUserId] || 0) + 1;
      scores[actorUserId] = state.totalStrokes[actorUserId];

      // Check if all players sunk ball on this hole
      const allSunkThisHole = participants.every((p) => state.balls[p.userId]?.sunk);

      if (allSunkThisHole) {
        if (holeIdx < COURSE_HOLES.length - 1) {
          // Advance to next hole!
          const nextHoleIdx = holeIdx + 1;
          const nextHole = COURSE_HOLES[nextHoleIdx];
          state.currentHoleIdx = nextHoleIdx;

          // Reset balls to next hole's start coordinates
          participants.forEach((p) => {
            state.balls[p.userId] = {
              x: nextHole.startX,
              y: nextHole.startY,
              vx: 0,
              vy: 0,
              sunk: false,
            };
          });

          state.currentTurnUserId = participants[0].userId;

          return {
            success: true,
            newState: state,
            nextTurnUserId: state.currentTurnUserId,
            scores,
            events: [
              {
                type: 'aloo:holeCompleted',
                payload: {
                  holeIndex: holeIdx,
                  holeName: hole.name,
                  holeStrokes: curHoleStrokes,
                },
              },
            ],
          };
        } else {
          // Match Completed! Lowest total strokes wins
          state.matchOver = true;
          let lowest = 9999;
          let winnerId: string | null = null;
          let isTie = false;

          participants.forEach((p) => {
            const tot = state.totalStrokes[p.userId] || 0;
            if (tot < lowest) {
              lowest = tot;
              winnerId = p.userId;
              isTie = false;
            } else if (tot === lowest) {
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
                type: 'aloo:matchCompleted',
                payload: {
                  winnerUserId: state.winnerUserId,
                  isDraw: state.isDraw,
                  totalStrokes: state.totalStrokes,
                },
              },
            ],
          };
        }
      }

      // Rotate turn among unsunk players on current hole
      const unsunkParticipants = participants.filter((p) => !state.balls[p.userId]?.sunk);
      const curIdx = unsunkParticipants.findIndex((p) => p.userId === actorUserId);
      const nextUserId =
        unsunkParticipants[(curIdx + 1) % unsunkParticipants.length]?.userId ||
        participants[0].userId;
      state.currentTurnUserId = nextUserId;

      return {
        success: true,
        newState: state,
        nextTurnUserId: nextUserId,
        scores,
        events: [
          {
            type: 'aloo:strokeTaken',
            payload: { actorUserId, ball, trajectory },
          },
        ],
      };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(state: AlooGolfState): Record<string, unknown> {
    return {
      currentHoleIdx: state.currentHoleIdx,
      currentTurnUserId: state.currentTurnUserId,
      balls: state.balls,
      holeStrokes: state.holeStrokes,
      totalStrokes: state.totalStrokes,
      lastTrajectory: state.lastTrajectory,
      matchOver: state.matchOver,
      winnerUserId: state.winnerUserId,
      isDraw: state.isDraw,
      hole: COURSE_HOLES[state.currentHoleIdx],
    };
  }

  getPrivateProjection(): null {
    return null;
  }
}

