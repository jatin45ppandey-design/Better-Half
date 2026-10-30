import type { TruthOrDareItem } from '../../../../data/questions/truthOrDareQuestions.js';

export interface TruthOrDareState {
  currentTurnUserId: string;
  selectedType: 'truth' | 'dare' | null;
  currentPrompt: TruthOrDareItem | null;
  category: 'Romantic' | 'Funny' | 'Personal' | 'Challenging';
  intensity: 'Soft' | 'Spicy' | 'Wild';
  skipsUsed: Record<string, number>;
  completedCount: Record<string, number>;
  history: Array<{
    userId: string;
    userName: string;
    type: 'TRUTH' | 'DARE';
    text: string;
    skipped?: boolean;
  }>;
  totalTurns: number;
}

export type TruthOrDareAction =
  | {
      type: 'CHOOSE_TYPE';
      promptType: 'truth' | 'dare';
      category?: 'Romantic' | 'Funny' | 'Personal' | 'Challenging';
      intensity?: 'Soft' | 'Spicy' | 'Wild';
    }
  | {
      type: 'SKIP';
    }
  | {
      type: 'COMPLETE';
    };

