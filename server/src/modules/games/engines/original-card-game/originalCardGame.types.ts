export type CardColor = 'purple' | 'lavender' | 'amber' | 'emerald' | 'wild';
export type CardValue =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'skip' | 'reverse' | 'draw2' | 'wild' | 'draw4';

export interface GameCard {
  id: string;
  color: CardColor;
  value: CardValue;
  label: string;
}

export interface UnoPublicState {
  currentTurnUserId: string;
  topDiscard: GameCard;
  activeColor: CardColor;
  direction: 1 | -1;
  cardCounts: Record<string, number>;
  hasDrawnThisTurn: boolean;
  lastPlayedCard: GameCard | null;
  winnerUserId: string | null;
  drawPileCount: number;
}

export interface UnoPrivateState {
  hand: GameCard[];
}

export type UnoAction =
  | {
      type: 'PLAY_CARD';
      cardId: string;
      chosenColor?: CardColor; // required if card is wild or draw4
    }
  | {
      type: 'DRAW_CARD';
    }
  | {
      type: 'PASS_TURN';
    };

