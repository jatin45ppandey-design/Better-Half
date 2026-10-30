import type { WouldYouRatherItem } from '../../../../data/questions/wouldYouRatherQuestions.js';

export interface WouldYouRatherPublicState {
  questionIndex: number;
  currentQuestion: WouldYouRatherItem;
  phase: 'ANSWERING' | 'REVEAL';
  submittedUserIds: string[];
  revealedChoices: Record<string, 'A' | 'B'> | null;
  matchCount: number;
  totalAnswered: number;
  history: Array<{
    dilemma: string;
    choices: Record<string, 'A' | 'B'>;
    agreed: boolean;
  }>;
}

export interface WouldYouRatherPrivateState {
  pendingChoice: 'A' | 'B' | null;
}

export type WouldYouRatherAction =
  | {
      type: 'SUBMIT_CHOICE';
      choice: 'A' | 'B';
    }
  | {
      type: 'NEXT_QUESTION';
    };

