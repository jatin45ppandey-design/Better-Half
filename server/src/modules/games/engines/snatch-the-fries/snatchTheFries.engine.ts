import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type {
  FryType,
  FryItem,
  SnatchTheFriesState,
  SnatchTheFriesAction,
} from './snatchTheFries.types.js';

const TOTAL_DROPS = 8;

const FRY_PROTOTYPES: Record<FryType, Omit<FryItem, 'id'>> = {
  GOLDEN: {
    type: 'GOLDEN',
    name: 'Legendary 24K Fry',
    points: 250,
    emoji: '✨🍟✨',
  },
  SPICY: {
    type: 'SPICY',
    name: 'Spicy Peri-Peri Fry',
    points: 150,
    emoji: '🌶️🍟',
  },
  SOGGY_TRAP: {
    type: 'SOGGY_TRAP',
    name: 'Soggy Mystery Fry (Trap!)',
    points: -120,
    emoji: '🤢🍟',
  },
  REGULAR: {
    type: 'REGULAR',
    name: 'Crispy Golden Fry',
    points: 100,
    emoji: '🍟',
  },
};

export class SnatchTheFriesEngine
  implements IGameEngine<SnatchTheFriesState, Record<string, never>, SnatchTheFriesAction>
{
  readonly gameId = 'snatch-the-fries';

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
  }): {
    state: SnatchTheFriesState;
    privateStates: Record<string, Record<string, never>>;
    scores: Record<string, number>;
  } {
    const scores: Record<string, number> = {};
    const reactionTimes: Record<string, number[]> = {};

    params.participants.forEach((p) => {
      scores[p.userId] = 0;
      reactionTimes[p.userId] = [];
    });

    const state: SnatchTheFriesState = {
      dropRound: 1,
      totalDrops: TOTAL_DROPS,
      currentDrop: null,
      dropState: 'WAITING',
      dropTimestamp: 0,
      snatchedByUserId: null,
      snatchReactionMs: null,
      scores,
      reactionTimes,
      matchOver: false,
      winnerUserId: null,
      isDraw: false,
    };

    return {
      state,
      privateStates: {},
      scores,
    };
  }

  validateAction(
    action: SnatchTheFriesAction,
    context: GameEngineContext<SnatchTheFriesState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (action.type === 'SPAWN_DROP') {
      if (context.state.matchOver) {
        return { valid: false, error: 'Match has concluded.' };
      }
      const actor = context.participants.find((participant) => participant.userId === actorUserId);
      if (!actor?.isHost) {
        return { valid: false, error: 'Only the room host may schedule a fry drop.' };
      }
      if (context.state.dropState === 'DROPPED') {
        return { valid: false, error: 'A fry is already waiting to be snatched.' };
      }
      return { valid: true };
    }

    if (action.type === 'SNATCH') {
      if (context.state.matchOver) {
        return { valid: false, error: 'Match has concluded.' };
      }
      // If waiting, false start is allowed as a game action (will incur penalty)
      if (context.state.dropState === 'SNATCHED') {
        return { valid: false, error: 'Fry was already snatched.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: SnatchTheFriesAction,
    context: GameEngineContext<SnatchTheFriesState>,
    actorUserId: string
  ): ActionResult<SnatchTheFriesState> {
    const state = { ...context.state };
    const participants = context.participants;
    const scores = { ...context.scores };
    const reactionTimes = { ...state.reactionTimes };

    if (action.type === 'SPAWN_DROP') {
      let fryType: FryType = 'REGULAR';
      if (action.forcedType) {
        fryType = action.forcedType;
      } else {
        const rand = Math.random();
        if (rand < 0.18) fryType = 'GOLDEN';
        else if (rand < 0.38) fryType = 'SPICY';
        else if (rand < 0.52) fryType = 'SOGGY_TRAP';
        else fryType = 'REGULAR';
      }

      if (state.dropState === 'SNATCHED') {
        state.dropRound += 1;
      }

      const proto = FRY_PROTOTYPES[fryType];
      const dropId = `fry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      state.currentDrop = {
        id: dropId,
        ...proto,
      };
      state.dropState = 'DROPPED';
      state.dropTimestamp = Date.now();
      state.snatchedByUserId = null;
      state.snatchReactionMs = null;

      return {
        success: true,
        newState: state,
        events: [
          {
            type: 'fries:dropped',
            payload: { drop: state.currentDrop, dropRound: state.dropRound },
          },
        ],
      };
    }

    if (action.type === 'SNATCH') {
      // False start: player tapped while waiting!
      if (state.dropState === 'WAITING' || !state.currentDrop) {
        state.dropState = 'FALSE_START';
        scores[actorUserId] = (scores[actorUserId] || 0) - 50;
        state.scores = scores;

        return {
          success: true,
          newState: state,
          scores,
          events: [
            {
              type: 'fries:falseStart',
              payload: { actorUserId, penalty: 50 },
            },
          ],
        };
      }

      if (state.dropState === 'DROPPED') {
        if (state.currentDrop.id !== action.dropId) {
          return { success: false, error: 'Stale drop ID.' };
        }

        const reactionMs = Math.max(1, Date.now() - state.dropTimestamp);
        state.dropState = 'SNATCHED';
        state.snatchedByUserId = actorUserId;
        state.snatchReactionMs = reactionMs;

        const userReactions = [...(reactionTimes[actorUserId] || []), reactionMs];
        reactionTimes[actorUserId] = userReactions;
        state.reactionTimes = reactionTimes;

        scores[actorUserId] = (scores[actorUserId] || 0) + state.currentDrop.points;
        state.scores = scores;

        // Check if all drops finished
        if (state.dropRound >= TOTAL_DROPS) {
          state.matchOver = true;

          let highest = -9999;
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
                type: 'fries:completed',
                payload: {
                  winnerUserId: state.winnerUserId,
                  isDraw: state.isDraw,
                  scores,
                },
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
              type: 'fries:snatched',
              payload: {
                actorUserId,
                reactionMs,
                points: state.currentDrop.points,
                scores,
              },
            },
          ],
        };
      }

      return { success: false, error: 'Cannot snatch in current drop state.' };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(state: SnatchTheFriesState): Record<string, unknown> {
    return {
      dropRound: state.dropRound,
      totalDrops: state.totalDrops,
      currentDrop: state.currentDrop,
      dropState: state.dropState,
      dropTimestamp: state.dropTimestamp,
      snatchedByUserId: state.snatchedByUserId,
      snatchReactionMs: state.snatchReactionMs,
      scores: state.scores,
      reactionTimes: state.reactionTimes,
      matchOver: state.matchOver,
      winnerUserId: state.winnerUserId,
      isDraw: state.isDraw,
    };
  }

  getPrivateProjection(): null {
    return null;
  }
}
