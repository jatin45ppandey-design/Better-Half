export type FryType = 'REGULAR' | 'GOLDEN' | 'SPICY' | 'SOGGY_TRAP';

export interface FryItem {
  id: string;
  type: FryType;
  name: string;
  points: number;
  emoji: string;
}

export interface SnatchTheFriesState {
  dropRound: number;
  totalDrops: number;
  currentDrop: FryItem | null;
  dropState: 'WAITING' | 'DROPPED' | 'SNATCHED' | 'FALSE_START';
  dropTimestamp: number;
  snatchedByUserId: string | null;
  snatchReactionMs: number | null;
  scores: Record<string, number>;
  reactionTimes: Record<string, number[]>;
  matchOver: boolean;
  winnerUserId: string | null;
  isDraw: boolean;
}

export type SnatchTheFriesAction =
  | {
      type: 'SPAWN_DROP';
      forcedType?: FryType;
    }
  | {
      type: 'SNATCH';
      dropId: string;
    };

