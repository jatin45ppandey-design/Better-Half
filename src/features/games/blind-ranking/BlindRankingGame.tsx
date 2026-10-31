import React, { useState, useEffect } from 'react';
import {
  Lock,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { BLIND_RANKING_CATEGORIES } from '../../../data/questions/blindRankingItems';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Avatar } from '../../../components/ui/Avatar';
import { PassDeviceScreen } from '../../../components/game-ui/PassDeviceScreen';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface BlindRankingGameProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  onUpdateTurn?: (playerName: string, roundInfo: string) => void;
  sessionState?: any;
  sessionPrivateState?: any;
  onSendAction?: (action: any) => Promise<{ success: boolean; error?: string }>;
  currentUserId?: string;
}

export const BlindRankingGame: React.FC<BlindRankingGameProps> = ({
  players,
  onFinishMatch,
  onUpdateTurn,
  sessionState,
  sessionPrivateState,
  onSendAction,
  currentUserId,
}) => {
  const activePlayers = players.length >= 2 ? players : [
    { id: 'p1', name: 'Alex', avatarInitials: 'AR', avatarColor: 'bg-[#9670E8]' },
    { id: 'p2', name: 'Sam', avatarInitials: 'SP', avatarColor: 'bg-[#D94C65]' },
  ];

  const [categoryIndex, setCategoryIndex] = useState(0);
  const [localCurrentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [localCurrentItemIndex, setCurrentItemIndex] = useState(0);
  const [playerRankings, setPlayerRankings] = useState<Record<string, (string | null)[]>>({});
  const [showPassScreen, setShowPassScreen] = useState(false);
  const [localRevealedResults, setRevealedResults] = useState(false);
  const [localRound, setLocalRound] = useState(1);

  const isMultiplayer = Boolean(sessionState && onSendAction);
  const currentCategory = isMultiplayer
    ? sessionState.category
    : BLIND_RANKING_CATEGORIES[categoryIndex % BLIND_RANKING_CATEGORIES.length];
  const currentItemIndex = isMultiplayer ? sessionState.currentItemIndex : localCurrentItemIndex;
  const currentPlayerIndex = isMultiplayer
    ? Math.max(0, activePlayers.findIndex((player) => player.id === currentUserId))
    : localCurrentPlayerIndex;
  const activePlayer = activePlayers[currentPlayerIndex] || activePlayers[0];
  const activeBoard = isMultiplayer
    ? sessionPrivateState?.board || [null, null, null, null, null]
    : playerRankings[activePlayer.id] || [null, null, null, null, null];
  const currentItem = isMultiplayer ? sessionState.currentItem : currentCategory.items[currentItemIndex];
  const revealedResults = isMultiplayer ? sessionState.phase === 'REVEAL' : localRevealedResults;
  const rankings = isMultiplayer ? sessionState.revealedBoards || {} : playerRankings;
  const isMyTurn = !isMultiplayer || !sessionState.submittedCurrentItemUserIds?.includes(currentUserId);
  const currentRound = isMultiplayer ? sessionState.round : localRound;

  useEffect(() => {
    if (onUpdateTurn) {
      onUpdateTurn(
        revealedResults ? 'All Players' : isMultiplayer ? (isMyTurn ? 'Your ranking' : 'Waiting for your submission') : activePlayer.name,
        `Blind Ranking • ${currentCategory.title}`
      );
    }
  }, [activePlayer.name, currentCategory.title, revealedResults, onUpdateTurn, isMultiplayer, isMyTurn]);

  const handlePlaceRank = (slotIndex: number) => {
    if (activeBoard[slotIndex] !== null || !isMyTurn) return;
    if (isMultiplayer) {
      void onSendAction?.({ type: 'PLACE_ITEM', slotIndex });
      return;
    }

    const newBoard = [...activeBoard];
    newBoard[slotIndex] = currentItem;

    const updatedMap = {
      ...playerRankings,
      [activePlayer.id]: newBoard,
    };
    setPlayerRankings(updatedMap);

    // If more items left for this player
    if (currentItemIndex < 4) {
      setCurrentItemIndex((prev) => prev + 1);
    } else {
      // Completed board for active player!
      if (currentPlayerIndex < activePlayers.length - 1) {
        // Pass to next player
        setCurrentPlayerIndex((prev) => prev + 1);
        setCurrentItemIndex(0);
        setShowPassScreen(true);
      } else {
        // All players completed!
        setRevealedResults(true);
      }
    }
  };

  const calculateCompatibility = () => {
    const b1 = rankings[activePlayers[0].id] || [];
    const b2 = rankings[activePlayers[1]?.id] || [];
    let exactMatches = 0;
    b1.forEach((item, idx) => {
      if (item && item === b2[idx]) exactMatches++;
    });
    return Math.round((exactMatches / 5) * 100);
  };

  const handleCompleteMatch = () => {
    if (isMultiplayer) {
      void onSendAction?.({ type: 'NEXT_CATEGORY' });
      return;
    }
    const scores: PlayerScoreSummary[] = activePlayers.map((p) => ({
      ...p,
      score: 'Board Completed',
      isWinner: true,
      subtext: `${calculateCompatibility()}% Group Agreement`,
    }));

    onFinishMatch({
      winnerName: 'Ranking Comparison Completed',
      playerScores: scores,
    });
  };

  if (showPassScreen && !isMultiplayer) {
    const nextP = activePlayers[currentPlayerIndex];
    return (
      <PassDeviceScreen
        targetPlayerName={nextP.name}
        targetPlayerInitials={nextP.avatarInitials}
        targetPlayerColor={nextP.avatarColor}
        onReady={() => setShowPassScreen(false)}
        message="Next player ranks the same mystery items from scratch!"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 py-4">
      {/* Category Header */}
      <div className="p-4 rounded-2xl bg-white border border-[#EAE3F3] shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="purple" size="sm" className="mb-1">
            Blind Ranking Category
          </Badge>
          <h2 className="text-base font-extrabold text-[#211A2D]">
            {currentCategory.title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {BLIND_RANKING_CATEGORIES.map((cat, idx) => (
            <button
              key={cat.id}
              type="button"
              disabled={isMultiplayer || currentItemIndex > 0 || currentPlayerIndex > 0}
              onClick={() => {
                setCategoryIndex(idx);
                setPlayerRankings({});
                setCurrentItemIndex(0);
              }}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                categoryIndex === idx
                  ? 'bg-[#593B91] text-white'
                  : 'bg-[#F8F4FF] text-[#756D82] hover:text-[#211A2D]'
              }`}
            >
              {cat.title.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {!revealedResults ? (
        /* Active Ranking View */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* Left: Mystery Item Card (5 cols) */}
          <div className="md:col-span-5 p-6 rounded-3xl bg-white border border-[#EAE3F3] shadow-md flex flex-col items-center text-center gap-4">
            <span className="text-xs font-bold uppercase tracking-wider text-[#9670E8]">
              Item {currentItemIndex + 1} of 5
            </span>

            <div className="w-14 h-14 rounded-2xl bg-[#F1EAFF] text-[#593B91] flex items-center justify-center font-bold text-xl shadow-xs">
              {currentItemIndex + 1}
            </div>

            <h3 className="text-xl font-extrabold text-[#211A2D] leading-snug">
              "{currentItem}"
            </h3>

            <p className="text-xs text-[#756D82] leading-relaxed">
              Where does this belong in your top 5? Tap an empty rank slot on the right to lock it in!
            </p>

            <div className="pt-2 w-full border-t border-[#F4EFFB] flex items-center justify-center gap-2 text-xs text-[#593B91] font-semibold">
              <Avatar name={activePlayer.name} initials={activePlayer.avatarInitials} bgColor={activePlayer.avatarColor} size="sm" />
              <span>Ranking for {activePlayer.name}</span>
            </div>
          </div>

          {/* Right: The 5 Slots (7 cols) */}
          <div className="md:col-span-7 flex flex-col gap-2.5">
            {[0, 1, 2, 3, 4].map((slotIdx) => {
              const assigned = activeBoard[slotIdx];
              const slotLabel = ['#1 - Ultimate Favorite', '#2 - Great', '#3 - Solid Mid', '#4 - Questionable', '#5 - Absolute Bottom'][slotIdx];
              const isFilled = assigned !== null;

              return (
                <button
                  key={slotIdx}
                  type="button"
                  disabled={isFilled || (isMultiplayer && (!isMyTurn || revealedResults))}
                  onClick={() => handlePlaceRank(slotIdx)}
                  className={`p-3.5 rounded-2xl border-2 text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isFilled
                      ? 'border-[#9670E8] bg-[#F1EAFF]/50 shadow-xs cursor-not-allowed'
                      : 'border-dashed border-[#D5C7EE] bg-white hover:border-[#9670E8] hover:bg-[#F8F4FF]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`w-8 h-8 rounded-xl font-mono font-extrabold text-sm flex items-center justify-center shrink-0 ${
                      isFilled ? 'bg-[#593B91] text-white' : 'bg-[#F8F4FF] text-[#593B91]'
                    }`}>
                      #{slotIdx + 1}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#756D82]">
                        {slotLabel}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-[#211A2D] truncate">
                        {isFilled ? assigned : 'Tap to lock this item here'}
                      </span>
                    </div>
                  </div>

                  {isFilled && (
                    <Lock className="w-4 h-4 text-[#9670E8] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Results Comparison Screen */
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#EAE3F3] shadow-md flex flex-col gap-6">
          <div className="text-center">
            <Badge variant="purple" size="md" className="mb-2">
              All Rankings Revealed
            </Badge>
            <h3 className="text-2xl font-extrabold text-[#211A2D]">
              How Did Your Tastes Compare?
            </h3>
            <p className="text-xs sm:text-sm text-[#756D82] mt-1">
              Category: <strong>{currentCategory.title}</strong>
            </p>
          </div>

          {/* Side by side player columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {activePlayers.map((player) => {
              const board = rankings[player.id] || [];
              return (
                <div key={player.id} className="p-4 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex flex-col gap-2">
                  <div className="flex items-center gap-2 pb-2 border-b border-[#EAE3F3]">
                    <Avatar name={player.name} initials={player.avatarInitials} bgColor={player.avatarColor} size="sm" />
                    <span className="text-xs font-bold text-[#211A2D] truncate">{player.name}</span>
                  </div>
                  {board.map((item, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-white border border-[#EAE3F3] text-[11px] leading-tight">
                      <span className="font-bold text-[#9670E8] mr-1.5">#{idx + 1}</span>
                      <span className="text-[#211A2D]">{item}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={isMultiplayer}
              onClick={() => {
                setPlayerRankings({});
                setCurrentPlayerIndex(0);
                setCurrentItemIndex(0);
                setRevealedResults(false);
              }}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Rerank Category
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCompleteMatch}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isMultiplayer
                ? currentRound >= BLIND_RANKING_CATEGORIES.length ? 'Finish Match' : 'Next Category'
                : 'Complete Match'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
