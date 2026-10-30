import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type {
  ShotType,
  ShotResult,
  BasketballState,
  BasketballAction,
} from './basketballRivalry.types.js';

const TOTAL_SHOTS_PER_PLAYER = 5;
const COURT_WIDTH = 640;
const COURT_HEIGHT = 420;
const BALL_START_X = 110;
const BALL_START_Y = 320;
const HOOP_X = 490;
const HOOP_Y = 160;
const GRAVITY = 0.42;

export class BasketballRivalryEngine
  implements IGameEngine<BasketballState, Record<string, never>, BasketballAction>
{
  readonly gameId = 'basketball-rivalry';

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
  }): {
    state: BasketballState;
    privateStates: Record<string, Record<string, never>>;
    currentTurnUserId: string;
    scores: Record<string, number>;
  } {
    const shotsTaken: Record<string, number> = {};
    const scores: Record<string, number> = {};
    const streaks: Record<string, number> = {};

    params.participants.forEach((p) => {
      shotsTaken[p.userId] = 0;
      scores[p.userId] = 0;
      streaks[p.userId] = 0;
    });

    const currentTurnUserId = params.participants[0].userId;

    const state: BasketballState = {
      currentTurnUserId,
      turnIndex: 0,
      shotsTaken,
      scores,
      streaks,
      totalShotsPerPlayer: TOTAL_SHOTS_PER_PLAYER,
      lastShotResult: null,
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
    action: BasketballAction,
    context: GameEngineContext<BasketballState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (action.type === 'SHOOT') {
      if (context.state.matchOver) {
        return { valid: false, error: 'Match has already ended.' };
      }
      if (context.state.currentTurnUserId !== actorUserId) {
        return { valid: false, error: 'Not your turn to shoot.' };
      }
      const shots = context.state.shotsTaken[actorUserId] || 0;
      if (shots >= TOTAL_SHOTS_PER_PLAYER) {
        return { valid: false, error: 'You have already taken all your shots.' };
      }
      if (action.angle < 30 || action.angle > 85) {
        return { valid: false, error: 'Angle must be between 30 and 85 degrees.' };
      }
      if (action.power < 20 || action.power > 100) {
        return { valid: false, error: 'Power must be between 20 and 100.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: BasketballAction,
    context: GameEngineContext<BasketballState>,
    actorUserId: string
  ): ActionResult<BasketballState> {
    const state = { ...context.state };
    const participants = context.participants;
    const scores = { ...context.scores };
    const shotsTaken = { ...state.shotsTaken };
    const streaks = { ...state.streaks };

    if (action.type === 'SHOOT') {
      const angle = Math.min(85, Math.max(30, action.angle));
      const power = Math.min(100, Math.max(20, action.power));

      // Calculate initial velocity
      const rad = (angle * Math.PI) / 180;
      const speed = power * 0.22;
      let vx = Math.cos(rad) * speed;
      let vy = -Math.sin(rad) * speed;
      let x = BALL_START_X;
      let y = BALL_START_Y;

      const trajectory: Array<{ x: number; y: number }> = [{ x, y }];
      let shotType: ShotType = 'MISS';
      let pts = 0;
      let text = '💨 Missed! Clank!';

      // Deterministic trajectory simulation
      for (let t = 0; t < 120; t++) {
        x += vx;
        y += vy;
        vy += GRAVITY;

        trajectory.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });

        // Check hoop area
        if (x >= HOOP_X - 25 && x <= HOOP_X + 25 && vy > 0) {
          const diffY = Math.abs(y - HOOP_Y);
          if (diffY < 18) {
            shotType = 'SWISH';
            pts = 3;
            text = '🔥 SWISH! Pure Net (+3)';
            break;
          } else if (diffY < 34) {
            shotType = 'BANK';
            pts = 2;
            text = '🏀 Bank Shot! Off the rim (+2)';
            break;
          }
        }

        // Out of bounds / floor hit
        if (y >= COURT_HEIGHT - 30 || x > COURT_WIDTH + 50) {
          shotType = 'MISS';
          pts = 0;
          text = '💨 Missed! Clank!';
          break;
        }
      }

      // Check streak and fire bonus
      const currentStreak = streaks[actorUserId] || 0;
      const isScore = shotType !== 'MISS';
      const newStreak = isScore ? currentStreak + 1 : 0;
      const bonus = newStreak >= 2;
      const totalPts = isScore ? pts + (bonus ? 1 : 0) : 0;

      streaks[actorUserId] = newStreak;
      scores[actorUserId] = (scores[actorUserId] || 0) + totalPts;
      shotsTaken[actorUserId] = (shotsTaken[actorUserId] || 0) + 1;

      const shotResult: ShotResult = {
        type: shotType,
        points: totalPts,
        bonus,
        text: bonus ? `${text} (+1 Fire Bonus!)` : text,
        angle,
        power,
        trajectory,
      };

      state.lastShotResult = shotResult;
      state.scores = scores;
      state.shotsTaken = shotsTaken;
      state.streaks = streaks;

      // Check if all players took all shots
      const allDone = participants.every(
        (p) => (shotsTaken[p.userId] || 0) >= TOTAL_SHOTS_PER_PLAYER
      );

      if (allDone) {
        state.matchOver = true;

        let highest = -1;
        let winnerId: string | null = null;
        let isTie = false;

        participants.forEach((p) => {
          const s = scores[p.userId] || 0;
          if (s > highest) {
            highest = s;
            winnerId = p.userId;
            isTie = false;
          } else if (s === highest) {
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
              type: 'basketball:completed',
              payload: {
                winnerUserId: state.winnerUserId,
                isDraw: state.isDraw,
                scores,
                shotResult,
              },
            },
          ],
        };
      }

      // Advance turn to next player
      state.turnIndex += 1;
      const nextUserId = participants[state.turnIndex % participants.length].userId;
      state.currentTurnUserId = nextUserId;

      return {
        success: true,
        newState: state,
        nextTurnUserId: nextUserId,
        scores,
        events: [
          {
            type: 'basketball:shotTaken',
            payload: { actorUserId, shotResult },
          },
        ],
      };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(state: BasketballState): Record<string, unknown> {
    return {
      currentTurnUserId: state.currentTurnUserId,
      turnIndex: state.turnIndex,
      shotsTaken: state.shotsTaken,
      scores: state.scores,
      streaks: state.streaks,
      totalShotsPerPlayer: state.totalShotsPerPlayer,
      lastShotResult: state.lastShotResult,
      matchOver: state.matchOver,
      winnerUserId: state.winnerUserId,
      isDraw: state.isDraw,
    };
  }

  getPrivateProjection(): null {
    return null;
  }
}

