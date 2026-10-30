import {
  BLIND_RANKING_CATEGORIES,
} from '../../../../data/questions/blindRankingItems.js';
import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type {
  BlindRankingPublicState,
  BlindRankingPrivateState,
  BlindRankingAction,
} from './blindRanking.types.js';

export class BlindRankingEngine
  implements
    IGameEngine<
      BlindRankingPublicState,
      BlindRankingPrivateState,
      BlindRankingAction
    >
{
  readonly gameId = 'blind-ranking';

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
  }): {
    state: BlindRankingPublicState;
    privateStates: Record<string, BlindRankingPrivateState>;
    scores: Record<string, number>;
  } {
    const category = BLIND_RANKING_CATEGORIES[0];
    const privateStates: Record<string, BlindRankingPrivateState> = {};
    const scores: Record<string, number> = {};

    params.participants.forEach((p) => {
      privateStates[p.userId] = { board: [null, null, null, null, null] };
      scores[p.userId] = 0;
    });

    const state: BlindRankingPublicState = {
      categoryIndex: 0,
      category,
      currentItemIndex: 0,
      currentItem: category.items[0],
      phase: 'RANKING',
      submittedCurrentItemUserIds: [],
      revealedBoards: null,
      alignmentScore: 0,
      isPerfectMatch: false,
      round: 1,
    };

    return {
      state,
      privateStates,
      scores,
    };
  }

  validateAction(
    action: BlindRankingAction,
    context: GameEngineContext<BlindRankingPublicState, BlindRankingPrivateState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (action.type === 'PLACE_ITEM') {
      if (context.state.phase !== 'RANKING') {
        return { valid: false, error: 'Round is in reveal phase.' };
      }
      if (context.state.submittedCurrentItemUserIds.includes(actorUserId)) {
        return { valid: false, error: 'You have already placed this item.' };
      }
      const slot = action.slotIndex;
      if (slot < 0 || slot > 4 || !Number.isInteger(slot)) {
        return { valid: false, error: 'Slot index must be between 0 and 4.' };
      }
      const userBoard = context.privateStates[actorUserId]?.board;
      if (userBoard && userBoard[slot] !== null) {
        return { valid: false, error: `Slot #${slot + 1} is already occupied.` };
      }
      return { valid: true };
    }

    if (action.type === 'NEXT_CATEGORY') {
      if (context.state.phase !== 'REVEAL') {
        return { valid: false, error: 'Cannot advance until current round is completed and revealed.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: BlindRankingAction,
    context: GameEngineContext<BlindRankingPublicState, BlindRankingPrivateState>,
    actorUserId: string
  ): ActionResult<BlindRankingPublicState, BlindRankingPrivateState> {
    const state = { ...context.state };
    const privateStates = { ...context.privateStates };
    const participants = context.participants;

    if (action.type === 'PLACE_ITEM') {
      const userBoard = [...(privateStates[actorUserId]?.board || [null, null, null, null, null])];
      userBoard[action.slotIndex] = state.currentItem;
      privateStates[actorUserId] = { board: userBoard };

      const submitted = Array.from(new Set([...state.submittedCurrentItemUserIds, actorUserId]));
      state.submittedCurrentItemUserIds = submitted;

      const allPlacedThisItem = participants.every((p) => submitted.includes(p.userId));

      if (allPlacedThisItem) {
        // Move to next item or conclude round
        const nextItemIndex = state.currentItemIndex + 1;

        if (nextItemIndex < 5) {
          state.currentItemIndex = nextItemIndex;
          state.currentItem = state.category.items[nextItemIndex];
          state.submittedCurrentItemUserIds = [];

          return {
            success: true,
            newState: state,
            newPrivateStates: privateStates,
          };
        } else {
          // All 5 items placed by all players -> REVEAL & SCORE
          state.phase = 'REVEAL';
          state.currentItem = null;
          state.submittedCurrentItemUserIds = [];

          const revealed: Record<string, string[]> = {};
          participants.forEach((p) => {
            revealed[p.userId] = (privateStates[p.userId]?.board as string[]) || [];
          });
          state.revealedBoards = revealed;

          // Calculate scores based on mode
          const scores = { ...context.scores };
          let roundAlignment = 0;
          let isPerfect = false;

          if (context.mode === 'couple' && participants.length === 2) {
            const p1Board = revealed[participants[0].userId];
            const p2Board = revealed[participants[1].userId];
            let exactMatches = 0;

            state.category.items.forEach((item) => {
              const p1Pos = p1Board.indexOf(item);
              const p2Pos = p2Board.indexOf(item);
              const diff = Math.abs(p1Pos - p2Pos);

              if (diff === 0) {
                roundAlignment += 10;
                exactMatches += 1;
              } else if (diff === 1) {
                roundAlignment += 5;
              }
            });

            if (exactMatches === 5) {
              roundAlignment += 50;
              isPerfect = true;
            }

            participants.forEach((p) => {
              scores[p.userId] = (scores[p.userId] || 0) + roundAlignment;
            });
          } else {
            // Friend Mode: consensus scoring vs median
            state.category.items.forEach((item) => {
              const positions = participants.map((p) => revealed[p.userId].indexOf(item));
              positions.sort((a, b) => a - b);
              const mid = Math.floor(positions.length / 2);
              const median = positions.length % 2 !== 0 ? positions[mid] : positions[mid - 1];

              participants.forEach((p) => {
                const userPos = revealed[p.userId].indexOf(item);
                const diff = Math.abs(userPos - median);
                let pts = 0;
                if (diff === 0) pts = 10;
                else if (diff === 1) pts = 5;
                scores[p.userId] = (scores[p.userId] || 0) + pts;
                roundAlignment += pts;
              });
            });

            // Check perfect consensus across all players
            const firstBoard = revealed[participants[0].userId];
            const allIdentical = participants.every((p) => {
              const b = revealed[p.userId];
              return b.every((val, idx) => val === firstBoard[idx]);
            });

            if (allIdentical) {
              isPerfect = true;
              participants.forEach((p) => {
                scores[p.userId] = (scores[p.userId] || 0) + 50;
              });
            }
          }

          state.alignmentScore = roundAlignment;
          state.isPerfectMatch = isPerfect;

          return {
            success: true,
            newState: state,
            newPrivateStates: privateStates,
            scores,
            events: [
              {
                type: 'blind-ranking:revealed',
                payload: { revealedBoards: revealed, roundAlignment, isPerfect },
              },
            ],
          };
        }
      }

      return {
        success: true,
        newState: state,
        newPrivateStates: privateStates,
      };
    }

    if (action.type === 'NEXT_CATEGORY') {
      const nextCatIdx = (state.categoryIndex + 1) % BLIND_RANKING_CATEGORIES.length;
      const nextCategory = BLIND_RANKING_CATEGORIES[nextCatIdx];

      state.categoryIndex = nextCatIdx;
      state.category = nextCategory;
      state.currentItemIndex = 0;
      state.currentItem = nextCategory.items[0];
      state.phase = 'RANKING';
      state.submittedCurrentItemUserIds = [];
      state.revealedBoards = null;
      state.alignmentScore = 0;
      state.isPerfectMatch = false;
      state.round += 1;

      participants.forEach((p) => {
        privateStates[p.userId] = { board: [null, null, null, null, null] };
      });

      return {
        success: true,
        newState: state,
        newPrivateStates: privateStates,
      };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(
    state: BlindRankingPublicState
  ): Record<string, unknown> {
    return {
      categoryIndex: state.categoryIndex,
      category: state.category,
      currentItemIndex: state.currentItemIndex,
      currentItem: state.currentItem,
      phase: state.phase,
      submittedCurrentItemUserIds: state.submittedCurrentItemUserIds,
      revealedBoards: state.revealedBoards,
      alignmentScore: state.alignmentScore,
      isPerfectMatch: state.isPerfectMatch,
      round: state.round,
    };
  }

  getPrivateProjection(
    privateState: BlindRankingPrivateState
  ): Record<string, unknown> {
    return {
      board: privateState?.board || [null, null, null, null, null],
    };
  }
}
