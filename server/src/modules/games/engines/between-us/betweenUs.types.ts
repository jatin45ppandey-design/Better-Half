import type { BetweenUsQuestion } from '../../../../data/questions/betweenUsQuestions.js';

export interface BetweenUsPublicState {
  category: string;
  intensity: 1 | 2 | 3 | 4 | 5;
  questionIndex: number;
  currentQuestion: BetweenUsQuestion;
  phase: 'ANSWERING' | 'REVEAL';
  submittedUserIds: string[];
  adultConsentUserIds: string[];
  revealedAnswers: Record<string, string> | null;
  questionsAnsweredCount: number;
}

export interface BetweenUsPrivateState {
  pendingAnswer: string | null;
}

export type BetweenUsAction =
  | {
      type: 'SUBMIT_ANSWER';
      answer: string;
    }
  | {
      type: 'GRANT_ADULT_CONSENT';
    }
  | {
      type: 'SET_SETTINGS';
      category?: string;
      intensity?: 1 | 2 | 3 | 4 | 5;
    }
  | {
      type: 'NEXT_QUESTION';
    }
  | {
      type: 'FINISH_SESSION';
    };

