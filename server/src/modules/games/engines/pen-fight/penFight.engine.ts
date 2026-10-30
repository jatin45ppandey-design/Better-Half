import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type {
  ServerPen,
  PenFightState,
  PenFightAction,
} from './penFight.types.js';

const ARENA_WIDTH = 640;
const ARENA_HEIGHT = 440;
const PADDING = 40;
const FRICTION = 0.96;
const REST_THRESHOLD = 0.15;
const TARGET_ROUND_WINS = 3;

const PEN_COLORS = ['#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];

export class PenFightEngine
  implements IGameEngine<PenFightState, Record<string, never>, PenFightAction>
{
  readonly gameId = 'pen-fight';

  private spawnPens(participants: GameParticipant[]): ServerPen[] {
    const spawnPositions = [
      { x: PADDING + 80, y: PADDING + 80, angle: Math.PI / 4 },
      { x: ARENA_WIDTH - PADDING - 80, y: ARENA_HEIGHT - PADDING - 80, angle: -Math.PI * 0.75 },
      { x: ARENA_WIDTH - PADDING - 80, y: PADDING + 80, angle: Math.PI * 0.75 },
      { x: PADDING + 80, y: ARENA_HEIGHT - PADDING - 80, angle: -Math.PI / 4 },
    ];

    return participants.map((p, idx) => {
      const pos = spawnPositions[idx % spawnPositions.length];
      return {
        id: `pen-${p.userId}`,
        userId: p.userId,
        name: p.name,
        color: PEN_COLORS[idx % PEN_COLORS.length],
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        length: 44,
        width: 14,
        isAlive: true,
      };
    });
  }

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
  }): {
    state: PenFightState;
    privateStates: Record<string, Record<string, never>>;
    currentTurnUserId: string;
    scores: Record<string, number>;
  } {
    const pens = this.spawnPens(params.participants);
    const roundWins: Record<string, number> = {};
    const scores: Record<string, number> = {};

    params.participants.forEach((p) => {
      roundWins[p.userId] = 0;
      scores[p.userId] = 0;
    });

    const state: PenFightState = {
      arenaWidth: ARENA_WIDTH,
      arenaHeight: ARENA_HEIGHT,
      padding: PADDING,
      round: 1,
      currentTurnUserId: params.participants[0].userId,
      pens,
      roundWins,
      roundStatus: 'PLAYING',
      roundWinnerUserId: null,
      matchWinnerUserId: null,
      targetRoundWins: TARGET_ROUND_WINS,
      lastFlickUserId: null,
    };

    return {
      state,
      privateStates: {},
      currentTurnUserId: params.participants[0].userId,
      scores,
    };
  }

  validateAction(
    action: PenFightAction,
    context: GameEngineContext<PenFightState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (action.type === 'FLICK_PEN') {
      if (context.state.roundStatus !== 'PLAYING') {
        return { valid: false, error: 'Round is not in playing state.' };
      }
      if (context.state.currentTurnUserId !== actorUserId) {
        return { valid: false, error: 'Not your turn to flick.' };
      }
      const activePen = context.state.pens.find((p) => p.userId === actorUserId);
      if (!activePen || !activePen.isAlive) {
        return { valid: false, error: 'Your pen has been eliminated this round.' };
      }
      if (action.power < 5 || action.power > 100) {
        return { valid: false, error: 'Flick power must be between 5 and 100.' };
      }
      return { valid: true };
    }

    if (action.type === 'START_NEXT_ROUND') {
      if (context.state.roundStatus === 'PLAYING') {
        return { valid: false, error: 'Round is still active.' };
      }
      if (context.state.matchWinnerUserId) {
        return { valid: false, error: 'Match has already concluded.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: PenFightAction,
    context: GameEngineContext<PenFightState>,
    actorUserId: string
  ): ActionResult<PenFightState> {
    const state = { ...context.state };
    const participants = context.participants;
    const scores = { ...context.scores };

    if (action.type === 'START_NEXT_ROUND') {
      state.round += 1;
      state.pens = this.spawnPens(participants);
      state.roundStatus = 'PLAYING';
      state.roundWinnerUserId = null;
      state.simulationFrames = undefined;

      // Start turn with next player in rotation
      const currentIdx = participants.findIndex((p) => p.userId === state.currentTurnUserId);
      const nextUserId = participants[(currentIdx + 1) % participants.length].userId;
      state.currentTurnUserId = nextUserId;

      return {
        success: true,
        newState: state,
        nextTurnUserId: nextUserId,
      };
    }

    if (action.type === 'FLICK_PEN') {
      const updatedPens = state.pens.map((p) => ({ ...p }));
      const activePen = updatedPens.find((p) => p.userId === actorUserId);
      if (!activePen) return { success: false, error: 'Active pen missing.' };

      // Apply initial launch impulse
      const len = Math.hypot(action.dx, action.dy) || 1;
      const nx = action.dx / len;
      const ny = action.dy / len;
      const speed = (action.power / 100) * 18;
      activePen.vx = nx * speed;
      activePen.vy = ny * speed;
      activePen.angle = Math.atan2(ny, nx);

      // Run fixed timestep physics simulation on the server
      const simulationFrames: Array<
        Array<{ id: string; x: number; y: number; angle: number; isAlive: boolean }>
      > = [];
      const MAX_STEPS = 180;

      for (let step = 0; step < MAX_STEPS; step++) {
        let anyMoving = false;

        // 1. Move and apply friction
        for (let i = 0; i < updatedPens.length; i++) {
          const pen = updatedPens[i];
          if (!pen.isAlive) continue;

          pen.x += pen.vx;
          pen.y += pen.vy;
          pen.vx *= FRICTION;
          pen.vy *= FRICTION;

          if (Math.abs(pen.vx) > REST_THRESHOLD || Math.abs(pen.vy) > REST_THRESHOLD) {
            anyMoving = true;
            pen.angle = Math.atan2(pen.vy, pen.vx);
          } else {
            pen.vx = 0;
            pen.vy = 0;
          }

          // Arena boundary / desk fall
          if (
            pen.x < PADDING ||
            pen.x > ARENA_WIDTH - PADDING ||
            pen.y < PADDING ||
            pen.y > ARENA_HEIGHT - PADDING
          ) {
            pen.isAlive = false;
            pen.vx = 0;
            pen.vy = 0;
          }
        }

        // 2. Pairwise pen collisions
        for (let i = 0; i < updatedPens.length; i++) {
          for (let j = i + 1; j < updatedPens.length; j++) {
            const p1 = updatedPens[i];
            const p2 = updatedPens[j];
            if (!p1.isAlive || !p2.isAlive) continue;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = (p1.length + p2.length) * 0.42;

            if (dist < minDist && dist > 0) {
              const overlap = minDist - dist;
              const colNx = dx / dist;
              const colNy = dy / dist;

              p1.x -= (colNx * overlap) / 2;
              p1.y -= (colNy * overlap) / 2;
              p2.x += (colNx * overlap) / 2;
              p2.y += (colNy * overlap) / 2;

              const kx = p1.vx - p2.vx;
              const ky = p1.vy - p2.vy;
              const p = colNx * kx + colNy * ky;

              p1.vx -= p * colNx * 0.9;
              p1.vy -= p * colNy * 0.9;
              p2.vx += p * colNx * 0.9;
              p2.vy += p * colNy * 0.9;
            }
          }
        }

        // Save keyframe every 2 steps
        if (step % 2 === 0) {
          simulationFrames.push(
            updatedPens.map((p) => ({
              id: p.id,
              x: Math.round(p.x * 10) / 10,
              y: Math.round(p.y * 10) / 10,
              angle: Math.round(p.angle * 100) / 100,
              isAlive: p.isAlive,
            }))
          );
        }

        if (!anyMoving && step > 5) break;
      }

      state.pens = updatedPens;
      state.simulationFrames = simulationFrames;
      state.lastFlickUserId = actorUserId;

      // Check alive pens
      const alivePens = updatedPens.filter((p) => p.isAlive);

      if (alivePens.length === 1) {
        const roundWinner = alivePens[0];
        state.roundStatus = 'ROUND_OVER';
        state.roundWinnerUserId = roundWinner.userId;

        const wins = { ...state.roundWins };
        wins[roundWinner.userId] = (wins[roundWinner.userId] || 0) + 1;
        state.roundWins = wins;
        scores[roundWinner.userId] = (scores[roundWinner.userId] || 0) + 10;

        if (wins[roundWinner.userId] >= TARGET_ROUND_WINS) {
          state.roundStatus = 'MATCH_OVER';
          state.matchWinnerUserId = roundWinner.userId;

          return {
            success: true,
            newState: state,
            isCompleted: true,
            winnerUserId: roundWinner.userId,
            scores,
            events: [
              {
                type: 'penFight:matchWon',
                payload: { winnerUserId: roundWinner.userId, roundWins: state.roundWins },
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
              type: 'penFight:roundWon',
              payload: { winnerUserId: roundWinner.userId, roundWins: state.roundWins },
            },
          ],
        };
      } else if (alivePens.length === 0) {
        state.roundStatus = 'ROUND_OVER';
        state.roundWinnerUserId = null; // Draw

        return {
          success: true,
          newState: state,
          events: [{ type: 'penFight:draw', payload: { round: state.round } }],
        };
      }

      // Rotate turn to next surviving player
      const aliveUserIds = alivePens.map((p) => p.userId);
      const currentIdx = aliveUserIds.indexOf(actorUserId);
      const nextTurnUserId = aliveUserIds[(currentIdx + 1) % aliveUserIds.length];
      state.currentTurnUserId = nextTurnUserId;

      return {
        success: true,
        newState: state,
        nextTurnUserId,
      };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(state: PenFightState): Record<string, unknown> {
    return {
      arenaWidth: state.arenaWidth,
      arenaHeight: state.arenaHeight,
      padding: state.padding,
      round: state.round,
      currentTurnUserId: state.currentTurnUserId,
      pens: state.pens,
      roundWins: state.roundWins,
      roundStatus: state.roundStatus,
      roundWinnerUserId: state.roundWinnerUserId,
      matchWinnerUserId: state.matchWinnerUserId,
      targetRoundWins: state.targetRoundWins,
      lastFlickUserId: state.lastFlickUserId,
      simulationFrames: state.simulationFrames,
    };
  }

  getPrivateProjection(): null {
    return null;
  }
}

