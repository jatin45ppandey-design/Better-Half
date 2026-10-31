import { TRUTH_OR_DARE_ITEMS } from '../../../../data/questions/truthOrDareQuestions.js';
import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type { TruthOrDareState, TruthOrDareAction } from './truthOrDare.types.js';

export class TruthOrDareEngine
  implements IGameEngine<TruthOrDareState, Record<string, never>, TruthOrDareAction>
{
  readonly gameId = 'truth-or-dare';

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
    customQuestions?: any[];
  }): {
    state: TruthOrDareState;
    privateStates: Record<string, Record<string, never>>;
    currentTurnUserId: string;
    scores: Record<string, number>;
  } {
    const p1 = params.participants[0];
    const skipsUsed: Record<string, number> = {};
    const completedCount: Record<string, number> = {};
    const scores: Record<string, number> = {};

    params.participants.forEach((p) => {
      skipsUsed[p.userId] = 0;
      completedCount[p.userId] = 0;
      scores[p.userId] = 0;
    });

    const customPool =
      params.customQuestions && params.customQuestions.length > 0
        ? params.customQuestions.map((q) => ({
            id: q.id,
            type: q.category?.toUpperCase() === 'DARE' ? ('DARE' as const) : ('TRUTH' as const),
            text: q.prompt,
            category: q.category || 'Romantic',
            intensity: q.intensity === 3 ? 'Wild' : q.intensity === 2 ? 'Spicy' : 'Soft',
          }))
        : TRUTH_OR_DARE_ITEMS;

    const state: TruthOrDareState & { questionsPool?: any[] } = {
      currentTurnUserId: p1.userId,
      selectedType: null,
      currentPrompt: null,
      category: 'Romantic',
      intensity: 'Spicy',
      skipsUsed,
      completedCount,
      history: [],
      totalTurns: 0,
      questionsPool: customPool,
    };

    return {
      state,
      privateStates: {},
      currentTurnUserId: p1.userId,
      scores,
    };
  }

  validateAction(
    action: TruthOrDareAction,
    context: GameEngineContext<TruthOrDareState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (context.state.currentTurnUserId !== actorUserId) {
      return { valid: false, error: 'Not your turn.' };
    }

    if (action.type === 'CHOOSE_TYPE') {
      if (action.promptType !== 'truth' && action.promptType !== 'dare') {
        return { valid: false, error: 'Prompt type must be truth or dare.' };
      }
      return { valid: true };
    }

    if (action.type === 'SKIP') {
      if (!context.state.currentPrompt) {
        return { valid: false, error: 'No active prompt to skip.' };
      }
      const skips = context.state.skipsUsed[actorUserId] || 0;
      if (skips >= 2) {
        return { valid: false, error: 'Maximum 2 skips allowed per session.' };
      }
      return { valid: true };
    }

    if (action.type === 'COMPLETE') {
      if (!context.state.currentPrompt) {
        return { valid: false, error: 'No active prompt to complete.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: TruthOrDareAction,
    context: GameEngineContext<TruthOrDareState>,
    actorUserId: string
  ): ActionResult<TruthOrDareState> {
    const state = { ...context.state };
    const participants = context.participants;
    const actor = participants.find((p) => p.userId === actorUserId);
    const partner = participants.find((p) => p.userId !== actorUserId);

    if (action.type === 'CHOOSE_TYPE') {
      const cat = action.category || state.category;
      const int = action.intensity || state.intensity;
      const baseItems = (state as any).questionsPool || TRUTH_OR_DARE_ITEMS;
      const pool = baseItems.filter(
        (item: any) => item.type === action.promptType && (item.category === cat || item.intensity === int)
      );
      const fallback = baseItems.filter((item: any) => item.type === action.promptType);
      const candidates = pool.length > 0 ? pool : fallback;
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];

      state.selectedType = action.promptType;
      state.category = cat;
      state.intensity = int;
      state.currentPrompt = chosen;

      return {
        success: true,
        newState: state,
        nextTurnUserId: state.currentTurnUserId,
      };
    }

    if (action.type === 'SKIP') {
      const newSkips = { ...state.skipsUsed };
      newSkips[actorUserId] = (newSkips[actorUserId] || 0) + 1;
      state.skipsUsed = newSkips;

      if (state.currentPrompt && actor) {
        state.history = [
          {
            userId: actorUserId,
            userName: actor.name,
            type: state.currentPrompt.type.toUpperCase() as 'TRUTH' | 'DARE',
            text: state.currentPrompt.text,
            skipped: true,
          },
          ...state.history,
        ];
      }

      state.currentPrompt = null;
      state.selectedType = null;
      const nextUserId = partner ? partner.userId : actorUserId;
      state.currentTurnUserId = nextUserId;
      state.totalTurns += 1;

      return {
        success: true,
        newState: state,
        nextTurnUserId: nextUserId,
        isCompleted: state.totalTurns >= 8,
        winnerUserId: null,
      };
    }

    if (action.type === 'COMPLETE') {
      const newCompleted = { ...state.completedCount };
      newCompleted[actorUserId] = (newCompleted[actorUserId] || 0) + 1;
      state.completedCount = newCompleted;

      const scores = { ...context.scores };
      scores[actorUserId] = (scores[actorUserId] || 0) + 1;

      if (state.currentPrompt && actor) {
        state.history = [
          {
            userId: actorUserId,
            userName: actor.name,
            type: state.currentPrompt.type.toUpperCase() as 'TRUTH' | 'DARE',
            text: state.currentPrompt.text,
          },
          ...state.history,
        ];
      }

      state.currentPrompt = null;
      state.selectedType = null;
      const nextUserId = partner ? partner.userId : actorUserId;
      state.currentTurnUserId = nextUserId;
      state.totalTurns += 1;

      return {
        success: true,
        newState: state,
        nextTurnUserId: nextUserId,
        scores,
        isCompleted: state.totalTurns >= 8,
        winnerUserId: null,
      };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(state: TruthOrDareState): Record<string, unknown> {
    return {
      currentTurnUserId: state.currentTurnUserId,
      selectedType: state.selectedType,
      currentPrompt: state.currentPrompt,
      category: state.category,
      intensity: state.intensity,
      skipsUsed: state.skipsUsed,
      completedCount: state.completedCount,
      history: state.history.slice(0, 10),
      totalTurns: state.totalTurns,
    };
  }

  getPrivateProjection(): null {
    return null;
  }
}
