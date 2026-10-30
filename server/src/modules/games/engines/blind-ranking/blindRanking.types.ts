import type { BlindRankingCategory } from '../../../../data/questions/blindRankingItems.js';

export interface BlindRankingPublicState {
  categoryIndex: number;
  category: BlindRankingCategory;
  currentItemIndex: number;
  currentItem: string | null;
  phase: 'RANKING' | 'REVEAL';
  submittedCurrentItemUserIds: string[];
  revealedBoards: Record<string, string[]> | null;
  alignmentScore: number;
  isPerfectMatch: boolean;
  round: number;
}

export interface BlindRankingPrivateState {
  board: (string | null)[]; // 5 slots (0 to 4)
}

export type BlindRankingAction =
  | {
      type: 'PLACE_ITEM';
      slotIndex: number;
    }
  | {
      type: 'NEXT_CATEGORY';
    };

