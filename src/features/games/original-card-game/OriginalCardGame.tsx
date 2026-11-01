import React, { useState, useEffect } from 'react';
import {
  Layers,
  Flame,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { Modal } from '../../../components/ui/Modal';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

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

interface OriginalCardGameProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  onUpdateTurn?: (playerName: string, roundInfo: string) => void;
  sessionState?: any;
  sessionPrivateState?: any;
  onSendAction?: (action: any) => Promise<{ success: boolean; error?: string }>;
  currentUserId?: string;
}

// Color theme styles
const COLOR_CLASSES: Record<CardColor, { bg: string; border: string; text: string }> = {
  purple: { bg: 'bg-[#593B91]', border: 'border-[#3B2368]', text: 'text-white' },
  lavender: { bg: 'bg-[#9670E8]', border: 'border-[#784ED9]', text: 'text-white' },
  amber: { bg: 'bg-[#D97706]', border: 'border-[#B45309]', text: 'text-white' },
  emerald: { bg: 'bg-[#059669]', border: 'border-[#047857]', text: 'text-white' },
  wild: { bg: 'bg-gradient-to-tr from-[#593B91] via-[#D97706] to-[#059669]', border: 'border-[#3B2368]', text: 'text-white' },
};

export const OriginalCardGame: React.FC<OriginalCardGameProps> = ({
  players,
  onFinishMatch,
  onUpdateTurn,
  sessionState,
  sessionPrivateState,
  onSendAction,
  currentUserId,
}) => {
  const activePlayers = players.length >= 2 ? players : [
    { id: 'p1', name: 'Player 1', avatarInitials: 'P1', avatarColor: 'bg-[#9670E8]' },
    { id: 'p2', name: 'Player 2', avatarInitials: 'P2', avatarColor: 'bg-[#D94C65]' },
  ];

  // Helper to generate a full deck
  const generateDeck = (): GameCard[] => {
    const deck: GameCard[] = [];
    const colors: ('purple' | 'lavender' | 'amber' | 'emerald')[] = ['purple', 'lavender', 'amber', 'emerald'];

    colors.forEach((col) => {
      // 0 to 9
      for (let n = 0; n <= 9; n++) {
        deck.push({ id: `${col}-${n}-${Math.random()}`, color: col, value: `${n}` as CardValue, label: `${n}` });
      }
      // Action cards
      deck.push({ id: `${col}-skip-${Math.random()}`, color: col, value: 'skip', label: 'SKIP' });
      deck.push({ id: `${col}-rev-${Math.random()}`, color: col, value: 'reverse', label: 'REV' });
      deck.push({ id: `${col}-d2-${Math.random()}`, color: col, value: 'draw2', label: '+2' });
    });

    // Wilds
    for (let w = 0; w < 4; w++) {
      deck.push({ id: `wild-${w}-${Math.random()}`, color: 'wild', value: 'wild', label: 'WILD' });
      deck.push({ id: `wild-d4-${w}-${Math.random()}`, color: 'wild', value: 'draw4', label: '+4 WILD' });
    }

    // Shuffle
    return deck.sort(() => Math.random() - 0.5);
  };

  const [deck, setDeck] = useState<GameCard[]>(() => generateDeck());
  const [hands, setHands] = useState<Record<string, GameCard[]>>(() => {
    const initialDeck = generateDeck();
    const map: Record<string, GameCard[]> = {};
    activePlayers.forEach((p, idx) => {
      map[p.id] = initialDeck.slice(idx * 7, idx * 7 + 7);
    });
    return map;
  });

  const [discardPile, setDiscardPile] = useState<GameCard[]>([
    { id: 'start-card', color: 'purple', value: '5', label: '5' }
  ]);
  const [localActiveColor, setActiveColor] = useState<CardColor>('purple');
  const [localCurrentTurnIndex, setCurrentTurnIndex] = useState(0);
  const isMultiplayer = Boolean(sessionState && onSendAction);
  const currentTurnIndex = isMultiplayer
    ? Math.max(0, activePlayers.findIndex((player) => player.id === sessionState.currentTurnUserId))
    : localCurrentTurnIndex;
  const activePlayer = activePlayers[currentTurnIndex] || activePlayers[0];
  const playerHand: GameCard[] = isMultiplayer ? sessionPrivateState?.hand || [] : hands[activePlayer.id] || [];
  const topDiscard: GameCard = isMultiplayer ? sessionState.topDiscard : discardPile[discardPile.length - 1];
  const activeColor: CardColor = isMultiplayer ? sessionState.activeColor : localActiveColor;
  const cardCounts: Record<string, number> = isMultiplayer
    ? sessionState.cardCounts || {}
    : Object.fromEntries(activePlayers.map((player) => [player.id, (hands[player.id] || []).length]));
  const hasDrawnThisTurn = Boolean(isMultiplayer && sessionState.hasDrawnThisTurn);
  const isMyTurn = !isMultiplayer || sessionState.currentTurnUserId === currentUserId;
  const [turnDirection, setTurnDirection] = useState<1 | -1>(1);
  const [showWildModal, setShowWildModal] = useState(false);
  const [pendingCard, setPendingCard] = useState<GameCard | null>(null);
  const [callLastCardAlert, setCallLastCardAlert] = useState<string | null>(null);

  // Online opponents expose only their hand sizes; the current player's actual
  // hand comes from the authenticated private session projection.

  useEffect(() => {
    if (onUpdateTurn) {
      onUpdateTurn(activePlayer.name, `Active Color: ${activeColor.toUpperCase()} • Hand: ${playerHand.length} Cards`);
    }
  }, [activePlayer.name, activeColor, playerHand.length, onUpdateTurn]);

  // Check if a card is legal to play
  const isCardLegal = (card: GameCard) => {
    if (card.color === 'wild') return true;
    if (card.color === activeColor) return true;
    if (card.value === topDiscard.value) return true;
    return false;
  };

  const advanceTurn = (skipCount = 1) => {
    setCurrentTurnIndex((prev) => {
      const next = (prev + turnDirection * skipCount + activePlayers.length * 10) % activePlayers.length;
      return next;
    });
  };

  const handleCardClick = (card: GameCard) => {
    if (!isCardLegal(card) || !isMyTurn) return;

    if (card.color === 'wild') {
      setPendingCard(card);
      setShowWildModal(true);
      return;
    }

    executePlayCard(card, card.color);
  };

  const executePlayCard = (card: GameCard, chosenColor: CardColor) => {
    if (isMultiplayer) {
      void onSendAction?.({
        type: 'PLAY_CARD',
        cardId: card.id,
        ...(card.color === 'wild' ? { chosenColor } : {}),
      });
      setPendingCard(null);
      setShowWildModal(false);
      return;
    }
    // Remove card from hand
    const updatedHand = playerHand.filter((c) => c.id !== card.id);
    setHands((prev) => ({ ...prev, [activePlayer.id]: updatedHand }));

    // Add to discard pile
    setDiscardPile((prev) => [...prev, card]);
    setActiveColor(chosenColor);

    // Check for Last Card alert
    if (updatedHand.length === 1) {
      setCallLastCardAlert(`${activePlayer.name} has ONE CARD LEFT!`);
      setTimeout(() => setCallLastCardAlert(null), 3000);
    }

    // Check victory
    if (updatedHand.length === 0) {
      const scores: PlayerScoreSummary[] = activePlayers.map((p) => ({
        ...p,
        score: p.id === activePlayer.id ? 'Winner (0 Cards)' : `${(hands[p.id] || []).length} Cards Remaining`,
        isWinner: p.id === activePlayer.id,
      }));

      onFinishMatch({
        winnerName: activePlayer.name,
        playerScores: scores,
      });
      return;
    }

    // Handle special action cards
    if (card.value === 'reverse') {
      setTurnDirection((d) => (d === 1 ? -1 : 1));
      advanceTurn(1);
    } else if (card.value === 'skip') {
      advanceTurn(2);
    } else if (card.value === 'draw2') {
      // Next player draws 2 cards
      const nextPlayerIdx = (currentTurnIndex + turnDirection + activePlayers.length) % activePlayers.length;
      const nextP = activePlayers[nextPlayerIdx];
      const drawnCards = deck.slice(0, 2);
      setDeck((d) => d.slice(2));
      setHands((prev) => ({
        ...prev,
        [nextP.id]: [...(prev[nextP.id] || []), ...drawnCards],
      }));
      advanceTurn(2);
    } else if (card.value === 'draw4') {
      const nextPlayerIdx = (currentTurnIndex + turnDirection + activePlayers.length) % activePlayers.length;
      const nextP = activePlayers[nextPlayerIdx];
      const drawnCards = deck.slice(0, 4);
      setDeck((d) => d.slice(4));
      setHands((prev) => ({
        ...prev,
        [nextP.id]: [...(prev[nextP.id] || []), ...drawnCards],
      }));
      advanceTurn(2);
    } else {
      advanceTurn(1);
    }
  };

  const handleDrawCard = () => {
    if (isMultiplayer) {
      if (isMyTurn && !hasDrawnThisTurn) void onSendAction?.({ type: 'DRAW_CARD' });
      return;
    }
    if (deck.length === 0) {
      // Reshuffle discard pile
      const newD = generateDeck();
      setDeck(newD);
    }
    const drawn = deck[0] || generateDeck()[0];
    setDeck((prev) => prev.slice(1));
    setHands((prev) => ({
      ...prev,
      [activePlayer.id]: [...(prev[activePlayer.id] || []), drawn],
    }));

    advanceTurn(1);
  };

  const handlePassTurn = () => {
    if (isMultiplayer) {
      if (isMyTurn && hasDrawnThisTurn) void onSendAction?.({ type: 'PASS_TURN' });
      return;
    }
    handleDrawCard();
  };

  const handleSelectWildColor = (col: CardColor) => {
    if (!pendingCard) return;
    setShowWildModal(false);
    executePlayCard(pendingCard, col);
    setPendingCard(null);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 py-4">
      {/* Last Card Banner */}
      {callLastCardAlert && (
        <div className="p-3 rounded-2xl bg-[#FEF3C7] border border-[#FDE68A] text-center text-xs sm:text-sm font-extrabold text-[#92400E] flex items-center justify-center gap-2 animate-bounce">
          <Flame className="w-4 h-4 text-[#D97706]" />
          <span>{callLastCardAlert}</span>
        </div>
      )}

      {/* Opponents Hands Bar */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {activePlayers.map((player) => {
          const isTurn = player.id === activePlayer.id;
          const handSize = cardCounts[player.id] || 0;

          return (
            <div
              key={player.id}
              className={`p-3 rounded-2xl border flex items-center gap-2.5 transition-all ${
                isTurn
                  ? 'border-[#9670E8] bg-white shadow-md ring-2 ring-[#9670E8]/20'
                  : 'border-[#EAE3F3] bg-white/60 opacity-80'
              }`}
            >
              <Avatar name={player.name} initials={player.avatarInitials} bgColor={player.avatarColor} size="sm" />
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-[#211A2D]">{player.name}</span>
                <span className="text-[10px] text-[#756D82]">{handSize} Cards</span>
              </div>
              {isTurn && (
                <span className="w-2 h-2 rounded-full bg-[#248A62] animate-ping ml-1" />
              )}
            </div>
          );
        })}
      </div>

      {/* Center Table: Discard Pile & Draw Deck */}
      <div className="p-6 sm:p-10 rounded-3xl bg-gradient-to-br from-[#FCFAFF] via-[#F8F4FF] to-[#F1EAFF] border border-[#EAE3F3] shadow-md flex flex-wrap items-center justify-center gap-8 text-center">
        {/* Draw Pile */}
        <button
          type="button"
          onClick={handleDrawCard}
          disabled={!isMyTurn || hasDrawnThisTurn}
          className="w-24 h-36 rounded-2xl border-2 border-[#593B91] bg-gradient-to-br from-[#3B2368] to-[#593B91] text-white flex flex-col items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        >
          <Layers className="w-6 h-6 text-purple-200 group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-extrabold uppercase tracking-wider text-purple-100">
            Draw
          </span>
          <span className="text-[10px] text-purple-300 font-mono">Deck</span>
        </button>

        {/* Top Discard Card */}
        <div className="flex flex-col items-center gap-2">
          <div
            className={`w-24 h-36 rounded-2xl border-2 shadow-xl flex flex-col justify-between p-3 transition-transform ${COLOR_CLASSES[topDiscard.color].bg} ${COLOR_CLASSES[topDiscard.color].border} ${COLOR_CLASSES[topDiscard.color].text}`}
          >
            <span className="text-xs font-black self-start">{topDiscard.label}</span>
            <span className="text-2xl font-black">{topDiscard.label}</span>
            <span className="text-xs font-black self-end">{topDiscard.label}</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-bold text-[#593B91]">
            <span>Active Color:</span>
            <span className="uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-[#EAE3F3]">
              {activeColor}
            </span>
          </div>
        </div>
      </div>

      {/* Active Player Hand */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white border border-[#EAE3F3] shadow-md flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-[#211A2D]">
              {isMultiplayer ? 'Your Hand' : `${activePlayer.name}'s Hand`} ({playerHand.length} Cards)
            </span>
            <Badge variant="subtle" size="sm">
              Click legal card to play
            </Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={hasDrawnThisTurn ? handlePassTurn : handleDrawCard}
            disabled={!isMyTurn}
            className="text-xs"
          >
            {hasDrawnThisTurn ? 'Pass Turn' : 'Draw 1 Card'}
          </Button>
        </div>

        {/* Card Scroll Bar */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 pt-1 px-1">
          {playerHand.map((card) => {
            const legal = isCardLegal(card);
            return (
              <button
                key={card.id}
                type="button"
                disabled={!legal || !isMyTurn}
                onClick={() => handleCardClick(card)}
                className={`w-20 h-32 rounded-xl border-2 flex flex-col justify-between p-2.5 shrink-0 transition-all cursor-pointer ${
                  COLOR_CLASSES[card.color].bg
                } ${COLOR_CLASSES[card.color].border} ${COLOR_CLASSES[card.color].text} ${
                  legal
                    ? 'hover:-translate-y-2 hover:shadow-lg shadow-md cursor-pointer'
                    : 'opacity-40 grayscale cursor-not-allowed'
                }`}
              >
                <span className="text-[10px] font-black self-start">{card.label}</span>
                <span className="text-lg font-black">{card.label}</span>
                <span className="text-[10px] font-black self-end">{card.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Wild Color Selection Modal */}
      <Modal
        isOpen={showWildModal}
        onClose={() => setShowWildModal(false)}
        title="Select Active Color"
        description="Choose the next color for the match:"
        maxWidth="sm"
      >
        <div className="grid grid-cols-2 gap-3 pt-2">
          {(['purple', 'lavender', 'amber', 'emerald'] as const).map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => handleSelectWildColor(col)}
              className={`p-4 rounded-2xl text-white font-extrabold text-sm uppercase tracking-wider transition-transform active:scale-95 shadow-md ${COLOR_CLASSES[col].bg}`}
            >
              {col}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
};
