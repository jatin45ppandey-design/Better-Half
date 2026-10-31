import React, { useCallback, useEffect, useState } from 'react';
import { History, Play, RefreshCw, Trophy } from 'lucide-react';
import { api } from '../../services/api';
import { GAMES_DATA } from '../../data/games';
import { Button } from '../ui/Button';
import { GameIcon } from '../ui/GameIcon';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import { soundService } from '../../services/soundService';
import type { GameItem } from '../../types/game';

interface RecentMatchItem {
  matchId: string;
  gameId: string;
  mode: 'COUPLE' | 'FRIEND' | string;
  outcome: string;
  scoreLabel: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
}

export const RecentlyPlayedSection: React.FC = () => {
  const [matches, setMatches] = useState<RecentMatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGameForRoom, setSelectedGameForRoom] = useState<GameItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const loadRecentMatches = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.stats.getMyRecent();
      setMatches(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your recent matches could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecentMatches();
  }, [loadRecentMatches]);

  const handleReplayMatch = (match: RecentMatchItem) => {
    soundService.playClick();
    const game = GAMES_DATA.find((item) => item.id === match.gameId) || null;
    if (!game) return;
    setSelectedGameForRoom(game);
    setCreateModalOpen(true);
  };

  const outcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'WIN': return { text: 'Won', bg: 'bg-[#14532D] text-[#86EFAC] border-[#22C55E]/40' };
      case 'LOSS': return { text: 'Lost', bg: 'bg-[#450A0A] text-[#FCA5A5] border-[#EF4444]/40' };
      case 'DRAW': return { text: 'Draw', bg: 'bg-[#312E81] text-[#C7D2FE] border-[#6366F1]/40' };
      case 'COMPLETED': return { text: 'Completed', bg: 'bg-[#2E1065] text-[#D8B4FE] border-[#A855F7]/40' };
      case 'ABANDONED': return { text: 'Abandoned', bg: 'bg-[#27272A] text-[#A1A1AA] border-[#52525B]/40' };
      default: return { text: 'Recorded', bg: 'bg-[#2E1065] text-[#D8B4FE] border-[#A855F7]/40' };
    }
  };

  return (
    <section className="mb-8" aria-labelledby="recently-played-heading">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#C084FC]" />
          <h2 id="recently-played-heading" className="text-lg font-bold font-heading text-white">
            Recently Played
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            soundService.playClick();
            void loadRecentMatches();
          }}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-[#A79BBF] hover:text-white bg-[#1F1336] hover:bg-[#2B1B47] border border-[#3A245C] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[#2D1B48] bg-[#160E25] p-6 text-xs text-[#A79BBF]">
          Loading your recent matches...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[#7F1D1D] bg-[#1C0F17] p-5">
          <p className="text-xs text-[#FCA5A5]">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadRecentMatches()}
            className="mt-3 text-xs"
          >
            Try again
          </Button>
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#362157] bg-[#140C22] p-6 text-center">
          <Trophy className="w-6 h-6 text-[#785E9E] mx-auto mb-2" />
          <h3 className="font-bold text-sm text-white">No matches recorded yet</h3>
          <p className="text-xs text-[#A79BBF] mt-1 max-w-sm mx-auto">
            Host a room or join with friends to start recording match outcomes and rivalries.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {matches.slice(0, 6).map((match) => {
            const game = GAMES_DATA.find((g) => g.id === match.gameId);
            const badge = outcomeLabel(match.outcome);
            const formattedDate = match.completedAt
              ? new Date(match.completedAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })
              : 'Recent';

            return (
              <div
                key={match.matchId}
                className="rounded-2xl border border-[#2D1B48] bg-[#160E25] p-3.5 flex items-center justify-between gap-3 shadow-md hover:border-[#4B2F73] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-[#281745] flex items-center justify-center text-[#C084FC] shrink-0 border border-[#3E2563]">
                    {game ? <GameIcon name={game.iconName} className="w-4 h-4" /> : <History className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {game?.name || match.gameId}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-[#A79BBF] mt-0.5">
                      <span>{match.mode === 'COUPLE' ? 'Couple' : 'Friend'}</span>
                      <span>•</span>
                      <span>{formattedDate}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg}`}
                  >
                    {badge.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleReplayMatch(match)}
                    className="p-1.5 rounded-xl bg-[#261542] hover:bg-[#3B2264] text-[#C084FC] hover:text-white transition-colors cursor-pointer"
                    title="Play this game again"
                    aria-label={`Replay ${game?.name || 'game'}`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialGame={selectedGameForRoom}
      />
    </section>
  );
};
