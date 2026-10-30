import {
  WOULD_YOU_RATHER_ITEMS,
} from '../../../../data/questions/wouldYouRatherQuestions.js';
import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type {
  WouldYouRatherPublicState,
  WouldYouRatherPrivateState,
  WouldYouRatherAction,
} from './wouldYouRather.types.js';

export class WouldYouRatherEngine
  implements
    IGameEngine<
      WouldYouRatherPublicState,
      WouldYouRatherPrivateState,
      WouldYouRatherAction
    >
{
  readonly gameId = 'would-you-rather';

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
    customQuestions?: any[];
  }): {
    state: WouldYouRatherPublicState;
    privateStates: Record<string, WouldYouRatherPrivateState>;
    scores: Record<string, number>;
  } {
    const privateStates: Record<string, WouldYouRatherPrivateState> = {};
    const scores: Record<string, number> = {};

    params.participants.forEach((p) => {
      privateStates[p.userId] = { pendingChoice: null };
      scores[p.userId] = 0;
    });

    const pool =
      params.customQuestions && params.customQuestions.length > 0
        ? params.customQuestions.map((q) => ({
            id: q.id,
            category: q.category || 'Couples',
            intensity: q.intensity === 3 ? 'Deep' : q.intensity === 2 ? 'Playful' : 'Funny',
            optionA: q.optionA || 'Option A',
            optionB: q.optionB || 'Option B',
          }))
        : WOULD_YOU_RATHER_ITEMS;

    const state: WouldYouRatherPublicState & { questionsPool?: any[] } = {
      questionIndex: 0,
      currentQuestion: pool[0],
      phase: 'ANSWERING',
      submittedUserIds: [],
      revealedChoices: null,
      matchCount: 0,
      totalAnswered: 0,
      history: [],
      questionsPool: pool,
    };

    return {
      state,
      privateStates,
      scores,
    };
  }

  validateAction(
    action: WouldYouRatherAction,
    context: GameEngineContext<WouldYouRatherPublicState, WouldYouRatherPrivateState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (action.type === 'SUBMIT_CHOICE') {
      if (context.state.phase !== 'ANSWERING') {
        return { valid: false, error: 'Current dilemma is already revealed.' };
      }
      if (action.choice !== 'A' && action.choice !== 'B') {
        return { valid: false, error: 'Choice must be A or B.' };
      }
      if (context.state.submittedUserIds.includes(actorUserId)) {
        return { valid: false, error: 'You have already submitted your choice.' };
      }
      return { valid: true };
    }

    if (action.type === 'NEXT_QUESTION') {
      if (context.state.phase !== 'REVEAL') {
        return { valid: false, error: 'Cannot advance until answers are revealed.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: WouldYouRatherAction,
    context: GameEngineContext<WouldYouRatherPublicState, WouldYouRatherPrivateState>,
    actorUserId: string
  ): ActionResult<WouldYouRatherPublicState, WouldYouRatherPrivateState> {
    const state = { ...context.state };
    const privateStates = { ...context.privateStates };
    const participants = context.participants;

    if (action.type === 'SUBMIT_CHOICE') {
      privateStates[actorUserId] = { pendingChoice: action.choice };
      const submitted = Array.from(new Set([...state.submittedUserIds, actorUserId]));
      state.submittedUserIds = submitted;

      // Check if all participants submitted
      const allSubmitted = participants.every((p) => submitted.includes(p.userId));

      if (allSubmitted) {
        state.phase = 'REVEAL';
        const choices: Record<string, 'A' | 'B'> = {};
        participants.forEach((p) => {
          choices[p.userId] = privateStates[p.userId]?.pendingChoice || 'A';
        });
        state.revealedChoices = choices;

        // Check agreement (Couple Mode)
        const p1Choice = choices[participants[0].userId];
        const p2Choice = choices[participants[1].userId];
        const agreed = p1Choice === p2Choice;

        if (agreed) {
          state.matchCount += 1;
        }
        state.totalAnswered += 1;

        const scores = { ...context.scores };
        if (agreed) {
          participants.forEach((p) => {
            scores[p.userId] = (scores[p.userId] || 0) + 10;
          });
        }

        state.history = [
          {
            dilemma: `${state.currentQuestion.optionA} vs ${state.currentQuestion.optionB}`,
            choices,
            agreed,
          },
          ...state.history,
        ];

        return {
          success: true,
          newState: state,
          newPrivateStates: privateStates,
          scores,
          events: [
            {
              type: 'wyr:revealed',
              payload: { choices, agreed, matchCount: state.matchCount },
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
      const pool = (state as any).questionsPool || WOULD_YOU_RATHER_ITEMS;
      const nextIndex = (state.questionIndex + 1) % pool.length;
      state.questionIndex = nextIndex;
      state.currentQuestion = pool[nextIndex];
      state.phase = 'ANSWERING';
      state.submittedUserIds = [];
      state.revealedChoices = null;

      // Reset pending choices
      participants.forEach((p) => {
        privateStates[p.userId] = { pendingChoice: null };
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
    state: WouldYouRatherPublicState
  ): Record<string, unknown> {
    return {
      questionIndex: state.questionIndex,
      currentQuestion: state.currentQuestion,
      phase: state.phase,
      submittedUserIds: state.submittedUserIds,
      revealedChoices: state.revealedChoices,
      matchCount: state.matchCount,
      totalAnswered: state.totalAnswered,
      history: state.history.slice(0, 10),
    };
  }

  getPrivateProjection(
    privateState: WouldYouRatherPrivateState
  ): Record<string, unknown> {
    return {
      pendingChoice: privateState?.pendingChoice ?? null,
    };
  }
}
