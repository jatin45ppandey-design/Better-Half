import type {
  IGameEngine,
  GameEngineContext,
  ActionResult,
  GameParticipant,
} from '../../core/gameEngine.types.js';
import type {
  CardValue,
  GameCard,
  UnoPublicState,
  UnoPrivateState,
  UnoAction,
} from './originalCardGame.types.js';

export class OriginalCardGameEngine
  implements IGameEngine<UnoPublicState, UnoPrivateState, UnoAction>
{
  readonly gameId = 'uno-style';

  private generateDeck(): GameCard[] {
    const deck: GameCard[] = [];
    const colors: ('purple' | 'lavender' | 'amber' | 'emerald')[] = [
      'purple',
      'lavender',
      'amber',
      'emerald',
    ];

    colors.forEach((col) => {
      for (let n = 0; n <= 9; n++) {
        deck.push({
          id: `${col}-${n}-${Math.random().toString(36).substring(2, 7)}`,
          color: col,
          value: `${n}` as CardValue,
          label: `${n}`,
        });
      }
      deck.push({
        id: `${col}-skip-${Math.random().toString(36).substring(2, 7)}`,
        color: col,
        value: 'skip',
        label: 'SKIP',
      });
      deck.push({
        id: `${col}-rev-${Math.random().toString(36).substring(2, 7)}`,
        color: col,
        value: 'reverse',
        label: 'REV',
      });
      deck.push({
        id: `${col}-d2-${Math.random().toString(36).substring(2, 7)}`,
        color: col,
        value: 'draw2',
        label: '+2',
      });
    });

    for (let w = 0; w < 4; w++) {
      deck.push({
        id: `wild-${w}-${Math.random().toString(36).substring(2, 7)}`,
        color: 'wild',
        value: 'wild',
        label: 'WILD',
      });
      deck.push({
        id: `wild-d4-${w}-${Math.random().toString(36).substring(2, 7)}`,
        color: 'wild',
        value: 'draw4',
        label: '+4 WILD',
      });
    }

    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  // Volatile server-side draw & discard piles keyed by sessionId
  private serverPiles: Map<
    string,
    { drawPile: GameCard[]; discardPile: GameCard[] }
  > = new Map();

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
  }): {
    state: UnoPublicState;
    privateStates: Record<string, UnoPrivateState>;
    currentTurnUserId: string;
    scores: Record<string, number>;
  } {
    const deck = this.generateDeck();
    const privateStates: Record<string, UnoPrivateState> = {};
    const cardCounts: Record<string, number> = {};
    const scores: Record<string, number> = {};

    params.participants.forEach((p) => {
      const hand = deck.splice(0, 7);
      privateStates[p.userId] = { hand };
      cardCounts[p.userId] = hand.length;
      scores[p.userId] = 0;
    });

    // Flip top non-wild card as initial discard
    let topDiscard = deck.pop()!;
    let searchIdx = 0;
    while (topDiscard.color === 'wild' && searchIdx < 10) {
      deck.unshift(topDiscard);
      topDiscard = deck.pop()!;
      searchIdx++;
    }

    const serverPiles = {
      drawPile: deck,
      discardPile: [topDiscard],
    };

    this.serverPiles.set(params.sessionId, serverPiles);

    const currentTurnUserId = params.participants[0].userId;

    const state: UnoPublicState & { _serverPiles?: typeof serverPiles } = {
      currentTurnUserId,
      topDiscard,
      activeColor: topDiscard.color,
      direction: 1,
      cardCounts,
      hasDrawnThisTurn: false,
      lastPlayedCard: topDiscard,
      winnerUserId: null,
      drawPileCount: deck.length,
      _serverPiles: serverPiles,
    };

    return {
      state,
      privateStates,
      currentTurnUserId,
      scores,
    };
  }

  validateAction(
    action: UnoAction,
    context: GameEngineContext<UnoPublicState, UnoPrivateState>,
    actorUserId: string
  ): { valid: boolean; error?: string } {
    if (context.state.currentTurnUserId !== actorUserId) {
      return { valid: false, error: 'Not your turn.' };
    }

    if (context.state.winnerUserId) {
      return { valid: false, error: 'Round is already complete.' };
    }

    if (action.type === 'PLAY_CARD') {
      const hand = context.privateStates[actorUserId]?.hand || [];
      const card = hand.find((c) => c.id === action.cardId);
      if (!card) {
        return { valid: false, error: 'Card not in your hand.' };
      }

      const top = context.state.topDiscard;
      const activeColor = context.state.activeColor;
      const isWild = card.color === 'wild';
      const colorMatch = card.color === activeColor;
      const valueMatch = card.value === top.value;

      if (!isWild && !colorMatch && !valueMatch) {
        return { valid: false, error: `Cannot play ${card.label}. Match color (${activeColor}) or value (${top.value}).` };
      }

      if (
        isWild &&
        !['purple', 'lavender', 'amber', 'emerald'].includes(action.chosenColor || '')
      ) {
        return { valid: false, error: 'A Wild card requires a valid selected color.' };
      }
      return { valid: true };
    }

    if (action.type === 'DRAW_CARD') {
      if (context.state.hasDrawnThisTurn) {
        return { valid: false, error: 'You have already drawn a card this turn. Play it or pass.' };
      }
      return { valid: true };
    }

    if (action.type === 'PASS_TURN') {
      if (!context.state.hasDrawnThisTurn) {
        return { valid: false, error: 'Must draw a card before passing turn.' };
      }
      return { valid: true };
    }

    return { valid: false, error: 'Invalid action type.' };
  }

  applyAction(
    action: UnoAction,
    context: GameEngineContext<UnoPublicState, UnoPrivateState>,
    actorUserId: string
  ): ActionResult<UnoPublicState, UnoPrivateState> {
    const state = { ...context.state };
    const privateStates = { ...context.privateStates };
    const participants = context.participants;
    // Work on detached piles. Engine actions may still fail during DB commit;
    // mutating a shared in-memory pile before commit would corrupt the live match.
    const persistedPiles = (state as any)._serverPiles as
      | { drawPile: GameCard[]; discardPile: GameCard[] }
      | undefined;
    const cachedPiles = this.serverPiles.get(context.sessionId);
    const sourcePiles = persistedPiles || cachedPiles;
    const piles = sourcePiles
      ? {
          drawPile: [...sourcePiles.drawPile],
          discardPile: [...sourcePiles.discardPile],
        }
      : {
          drawPile: this.generateDeck(),
          discardPile: [state.topDiscard],
        };

    const getNextPlayerId = (currentId: string, steps = 1): string => {
      const idx = participants.findIndex((p) => p.userId === currentId);
      const total = participants.length;
      const nextIdx = (idx + state.direction * steps + total * 10) % total;
      return participants[nextIdx].userId;
    };

    if (action.type === 'DRAW_CARD') {
      if (piles.drawPile.length === 0) {
        // Reshuffle discard pile except top card
        const top = piles.discardPile.pop()!;
        piles.drawPile = piles.discardPile.sort(() => Math.random() - 0.5);
        piles.discardPile = [top];
      }

      const drawnCard = piles.drawPile.pop();
      if (drawnCard) {
        const userHand = [...(privateStates[actorUserId]?.hand || []), drawnCard];
        privateStates[actorUserId] = { hand: userHand };
        state.cardCounts = {
          ...state.cardCounts,
          [actorUserId]: userHand.length,
        };
      }

      state.hasDrawnThisTurn = true;
      state.drawPileCount = piles.drawPile.length;
      (state as any)._serverPiles = piles;

      return {
        success: true,
        newState: state,
        newPrivateStates: privateStates,
        nextTurnUserId: actorUserId,
      };
    }

    if (action.type === 'PASS_TURN') {
      state.hasDrawnThisTurn = false;
      const nextUserId = getNextPlayerId(actorUserId, 1);
      state.currentTurnUserId = nextUserId;
      (state as any)._serverPiles = piles;

      return {
        success: true,
        newState: state,
        nextTurnUserId: nextUserId,
      };
    }

    if (action.type === 'PLAY_CARD') {
      const userHand = [...(privateStates[actorUserId]?.hand || [])];
      const cardIdx = userHand.findIndex((c) => c.id === action.cardId);
      const playedCard = userHand.splice(cardIdx, 1)[0];
      privateStates[actorUserId] = { hand: userHand };

      piles.discardPile.push(playedCard);
      state.topDiscard = playedCard;
      state.lastPlayedCard = playedCard;
      state.cardCounts = {
        ...state.cardCounts,
        [actorUserId]: userHand.length,
      };
      state.hasDrawnThisTurn = false;

      // Handle Color
      if (playedCard.color === 'wild' && action.chosenColor) {
        state.activeColor = action.chosenColor;
      } else {
        state.activeColor = playedCard.color;
      }

      // Check Win Condition
      if (userHand.length === 0) {
        state.winnerUserId = actorUserId;
        const scores = { ...context.scores };
        scores[actorUserId] = (scores[actorUserId] || 0) + 100;

        return {
          success: true,
          newState: state,
          newPrivateStates: privateStates,
          isCompleted: true,
          winnerUserId: actorUserId,
          scores,
          events: [
            {
              type: 'uno:won',
              payload: { winnerUserId: actorUserId, score: 100 },
            },
          ],
        };
      }

      // Handle Action Cards
      let stepsToNext = 1;

      if (playedCard.value === 'reverse') {
        if (participants.length === 2) {
          // In 2-player mode, Reverse acts as Skip!
          stepsToNext = 2;
        } else {
          state.direction = (state.direction * -1) as 1 | -1;
          stepsToNext = 1;
        }
      } else if (playedCard.value === 'skip') {
        stepsToNext = 2;
      } else if (playedCard.value === 'draw2') {
        const victimId = getNextPlayerId(actorUserId, 1);
        const victimHand = [...(privateStates[victimId]?.hand || [])];

        for (let i = 0; i < 2; i++) {
          if (piles.drawPile.length === 0) {
            const top = piles.discardPile.pop()!;
            piles.drawPile = piles.discardPile.sort(() => Math.random() - 0.5);
            piles.discardPile = [top];
          }
          const c = piles.drawPile.pop();
          if (c) victimHand.push(c);
        }

        privateStates[victimId] = { hand: victimHand };
        state.cardCounts = {
          ...state.cardCounts,
          [victimId]: victimHand.length,
        };
        stepsToNext = 2; // victim loses turn
      } else if (playedCard.value === 'draw4') {
        const victimId = getNextPlayerId(actorUserId, 1);
        const victimHand = [...(privateStates[victimId]?.hand || [])];

        for (let i = 0; i < 4; i++) {
          if (piles.drawPile.length === 0) {
            const top = piles.discardPile.pop()!;
            piles.drawPile = piles.discardPile.sort(() => Math.random() - 0.5);
            piles.discardPile = [top];
          }
          const c = piles.drawPile.pop();
          if (c) victimHand.push(c);
        }

        privateStates[victimId] = { hand: victimHand };
        state.cardCounts = {
          ...state.cardCounts,
          [victimId]: victimHand.length,
        };
        stepsToNext = 2; // victim loses turn
      }

      const nextTurnUserId = getNextPlayerId(actorUserId, stepsToNext);
      state.currentTurnUserId = nextTurnUserId;
      state.drawPileCount = piles.drawPile.length;
      (state as any)._serverPiles = piles;

      return {
        success: true,
        newState: state,
        newPrivateStates: privateStates,
        nextTurnUserId,
      };
    }

    return { success: false, error: 'Unknown action.' };
  }

  getPublicProjection(state: UnoPublicState): Record<string, unknown> {
    return {
      currentTurnUserId: state.currentTurnUserId,
      topDiscard: state.topDiscard,
      activeColor: state.activeColor,
      direction: state.direction,
      cardCounts: state.cardCounts,
      hasDrawnThisTurn: state.hasDrawnThisTurn,
      lastPlayedCard: state.lastPlayedCard,
      winnerUserId: state.winnerUserId,
      drawPileCount: state.drawPileCount,
    };
  }

  getPrivateProjection(
    privateState: UnoPrivateState
  ): Record<string, unknown> {
    return {
      hand: privateState?.hand || [],
    };
  }
}
