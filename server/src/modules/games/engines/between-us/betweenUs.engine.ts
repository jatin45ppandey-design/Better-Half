import {
  BETWEEN_US_QUESTIONS,
  type BetweenUsQuestion,
} from '../../../../data/questions/betweenUsQuestions.js';
import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type {
  BetweenUsPublicState,
  BetweenUsPrivateState,
  BetweenUsAction,
} from './betweenUs.types.js';

export class BetweenUsEngine
  implements IGameEngine<BetweenUsPublicState, BetweenUsPrivateState, BetweenUsAction>
{
  readonly gameId = 'between-us';

  private getEligibleQuestions(category: string, intensity: 1 | 2 | 3 | 4 | 5, customPool?: BetweenUsQuestion[]): BetweenUsQuestion[] {
    const base = customPool && customPool.length > 0 ? customPool : BETWEEN_US_QUESTIONS;
    const list = base.filter((q) => {
      const matchCat = category === 'All' || q.category === category;
      const matchInt = q.intensity <= intensity;
      return matchCat && matchInt;
    });
    return list.length > 0 ? list : base;
  }

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
    customQuestions?: any[];
  }): {
    state: BetweenUsPublicState;
    privateStates: Record<string, BetweenUsPrivateState>;
    scores: Record<string, number>;
  } {
    const category = 'All';
    const intensity = 2;
    const customPool =
      params.customQuestions && params.customQuestions.length > 0
        ? params.customQuestions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            category: q.category || 'Couple',
            intensity: (q.intensity || 2) as any,
          }))
        : undefined;

    const pool = this.getEligibleQuestions(category, intensity, customPool);
    const privateStates: Record<string, BetweenUsPrivateState> = {};
    const scores: Record<string, number> = {};

    params.participants.forEach((p) => {
      privateStates[p.userId] = { pendingAnswer: null };
      scores[p.userId] = 0;
    });

    const state: BetweenUsPublicState & { questionsPool?: any[] } = {
      category,
      intensity,
      questionIndex: 0,
      currentQuestion: pool[0],
      phase: 'ANSWERING',
      submittedUserIds: [],
      adultConsentUserIds: [],
      revealedAnswers: null,
      questionsAnsweredCount: 0,
      questionsPool: customPool,
    };

    return {
      state,
      privateStates,
      scores,
    };
  }

  validateAction(
    action: BetweenUsAction,
    context: GameEngineContext<BetweenUsPublicState, BetweenUsPrivateState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (action.type === 'SUBMIT_ANSWER') {
      if (context.state.phase !== 'ANSWERING') {
        return { valid: false, error: 'Current prompt is already revealed.' };
      }
      if (context.state.submittedUserIds.includes(actorUserId)) {
        return { valid: false, error: 'You have already submitted an answer.' };
      }
      if (typeof action.answer !== 'string' || action.answer.trim().length === 0) {
        return { valid: false, error: 'Answer cannot be empty.' };
      }
      if (action.answer.trim().length > 1000) {
        return { valid: false, error: 'Answer cannot exceed 1000 characters.' };
      }
      return { valid: true };
    }

    if (action.type === 'GRANT_ADULT_CONSENT') {
      return { valid: true };
    }

    if (action.type === 'SET_SETTINGS') {
      if (action.category !== undefined && (typeof action.category !== 'string' || action.category.trim().length === 0 || action.category.length > 50)) {
        return { valid: false, error: 'Category must be a non-empty value of at most 50 characters.' };
      }
      if (action.intensity !== undefined && ![1, 2, 3, 4, 5].includes(action.intensity)) {
        return { valid: false, error: 'Intensity must be between 1 and 5.' };
      }
      if (action.intensity === 5) {
        // Both participants must have consented!
        const consented = context.state.adultConsentUserIds;
        const bothConsented = context.participants.every((p) => consented.includes(p.userId));
        if (!bothConsented) {
          return {
            valid: false,
            error: 'Level 5 (After Dark 18+) requires explicit mutual consent from both partners.',
          };
        }
      }
      return { valid: true };
    }

    if (action.type === 'NEXT_QUESTION') {
      if (context.state.phase !== 'REVEAL') {
        return { valid: false, error: 'Cannot advance until answers are revealed.' };
      }
      return { valid: true };
    }

    if (action.type === 'FINISH_SESSION') {
      if (context.state.phase !== 'REVEAL' || context.state.questionsAnsweredCount < 1) {
        return { valid: false, error: 'Complete at least one shared prompt before wrapping up.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: BetweenUsAction,
    context: GameEngineContext<BetweenUsPublicState, BetweenUsPrivateState>,
    actorUserId: string
  ): ActionResult<BetweenUsPublicState, BetweenUsPrivateState> {
    const state = { ...context.state };
    const privateStates = { ...context.privateStates };
    const participants = context.participants;
    const scores = { ...context.scores };

    if (action.type === 'GRANT_ADULT_CONSENT') {
      state.adultConsentUserIds = Array.from(
        new Set([...state.adultConsentUserIds, actorUserId])
      );

      // Level 5 is enabled only after every active participant explicitly opts in.
      const everyoneConsented = participants.every((participant) =>
        state.adultConsentUserIds.includes(participant.userId)
      );
      if (everyoneConsented) {
        state.intensity = 5;
        const pool = this.getEligibleQuestions(
          state.category,
          state.intensity,
          (state as any).questionsPool
        );
        state.currentQuestion = pool[state.questionIndex % pool.length];
      }

      return {
        success: true,
        newState: state,
        newPrivateStates: privateStates,
      };
    }

    if (action.type === 'SET_SETTINGS') {
      if (action.category) state.category = action.category;
      if (action.intensity) state.intensity = action.intensity;

      const pool = this.getEligibleQuestions(state.category, state.intensity, (state as any).questionsPool);
      state.currentQuestion = pool[state.questionIndex % pool.length];

      return {
        success: true,
        newState: state,
        newPrivateStates: privateStates,
      };
    }

    if (action.type === 'SUBMIT_ANSWER') {
      // Persist the pending answer in the participant-private session state.
      privateStates[actorUserId] = { pendingAnswer: action.answer.trim() };
      const submitted = Array.from(new Set([...state.submittedUserIds, actorUserId]));
      state.submittedUserIds = submitted;

      const allSubmitted = participants.every((p) => submitted.includes(p.userId));

      if (allSubmitted) {
        state.phase = 'REVEAL';
        const revealed: Record<string, string> = {};
        participants.forEach((p) => {
          revealed[p.userId] = privateStates[p.userId]?.pendingAnswer || '';
          // Clear the private buffer after copying answers into the shared reveal.
          privateStates[p.userId] = { pendingAnswer: null };
        });

        state.revealedAnswers = revealed;
        state.questionsAnsweredCount += 1;

        participants.forEach((p) => {
          scores[p.userId] = (scores[p.userId] || 0) + 1;
        });

        return {
          success: true,
          newState: state,
          newPrivateStates: privateStates,
          scores,
          events: [
            {
              type: 'betweenUs:revealed',
              payload: {
                revealedAnswers: revealed,
                questionsAnsweredCount: state.questionsAnsweredCount,
              },
            },
          ],
        };
      }

      return {
        success: true,
        newState: state,
        newPrivateStates: privateStates,
      };
    }

    if (action.type === 'NEXT_QUESTION') {
      const pool = this.getEligibleQuestions(state.category, state.intensity, (state as any).questionsPool);
      state.questionIndex = (state.questionIndex + 1) % pool.length;
      state.currentQuestion = pool[state.questionIndex];
      state.phase = 'ANSWERING';
      state.submittedUserIds = [];
      state.revealedAnswers = null;

      participants.forEach((p) => {
        privateStates[p.userId] = { pendingAnswer: null };
      });

      return {
        success: true,
        newState: state,
        newPrivateStates: privateStates,
      };
    }

    if (action.type === 'FINISH_SESSION') {
      return {
        success: true,
        newState: state,
        newPrivateStates: privateStates,
        scores,
        isCompleted: true,
        winnerUserId: null,
        events: [
          {
            type: 'betweenUs:sessionCompleted',
            payload: { questionsAnsweredCount: state.questionsAnsweredCount },
          },
        ],
      };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(state: BetweenUsPublicState): Record<string, unknown> {
    return {
      category: state.category,
      intensity: state.intensity,
      questionIndex: state.questionIndex,
      currentQuestion: state.currentQuestion,
      phase: state.phase,
      submittedUserIds: state.submittedUserIds,
      adultConsentUserIds: state.adultConsentUserIds,
      revealedAnswers: state.revealedAnswers,
      questionsAnsweredCount: state.questionsAnsweredCount,
    };
  }

  getPrivateProjection(
    privateState: BetweenUsPrivateState
  ): Record<string, unknown> {
    return {
      pendingAnswer: privateState?.pendingAnswer ?? null,
    };
  }
}

