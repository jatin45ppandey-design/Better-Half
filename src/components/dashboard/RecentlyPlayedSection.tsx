import React, { useCallback, useEffect, useState } from 'react';
import { History, Play, Heart, Users, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { GAMES_DATA } from '../../data/games';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { GameIcon } from '../ui/GameIcon';
import { CreateRoomModal } from '../modals/CreateRoomModal';
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
    const game = GAMES_DATA.find((item) => item.id === match.gameId) || null;
    if (!game) return;
    setSelectedGameForRoom(game);
    setCreateModalOpen(true);
  };

  const outcomeLabel = (outcome: string) => {
    switch (outcome) {
      case 'WIN': return 'Won';
      case 'LOSS': return 'Lost';
      case 'DRAW': return 'Draw';
      case 'COMPLETED': return 'Completed';
      case 'ABANDONED': return 'Abandoned';
      default: return 'Recorded';
    }
  };

  return (
    <section className="mb-10" aria-labelledby="recently-played-heading">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#593B91]" />
          <h2 id="recently-played-heading" className="text-lg font-bold text-[#211A2D]">
            Recently Played
          </h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void loadRecentMatches()}
          disabled={isLoading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-[#EAE3F3] bg-white p-6 text-sm text-[#756D82]">
          Loading your recent matches…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-[#F8D2D9] bg-white p-6">
          <p className="text-sm text-[#A52E45]">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadRecentMatches()} className="mt-3">
            Try again
          </Button>
        </div>
      ) : matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D5C7EE] bg-white p-7 text-center">
          <History className="w-7 h-7 text-[#B7A5D8] mx-auto mb-2" />
          <h3 className="font-bold text-[#211A2D]">No matches yet</h3>
          <p className="text-sm text-[#756D82] mt-1">
            Completed matches will appear here when you start playing.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {matches.slice(0, 3).map((match) => {
            const game = GAMES_DATA.find((item) => item.id === match.gameId);
            const isCouple = match.mode.toUpperCase() === 'COUPLE';
            return (
              <article key={match.matchId} className="p-4 rounded-2xl bg-white border border-[#EAE3F3] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <Badge variant={isCouple ? 'pink' : 'lavender'} size="sm">
                      <span className="flex items-center gap-1">
                        {isCouple ? <Heart className="w-3 h-3 fill-current" /> : <Users className="w-3 h-3" />}
                        {isCouple ? 'Couple Mode' : 'Friend Mode'}
                      </span>
                    </Badge>
                    <span className="text-[11px] text-[#756D82]">
                      {match.completedAt ? new Date(match.completedAt).toLocaleDateString() : 'Date unavailable'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 mb-2">
                    {game && (
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${game.accentColor.bg} ${game.accentColor.border} ${game.accentColor.text}`}>
                        <GameIcon name={game.iconName} className="w-4 h-4" />
                      </div>
                    )}
                    <h3 className="text-sm font-bold text-[#211A2D] truncate">
                      {game?.name || match.gameId}
                    </h3>
                  </div>
                  <p className="text-xs font-semibold text-[#593B91]">{outcomeLabel(match.outcome)}</p>
                  {match.scoreLabel && <p className="text-[11px] text-[#9D96A8] mt-0.5">{match.scoreLabel}</p>}
                  {typeof match.durationSeconds === 'number' && (
                    <p className="text-[11px] text-[#9D96A8] mt-1">
                      {Math.floor(match.durationSeconds / 60)} min
                    </p>
                  )}
                </div>
                <div className="pt-2.5 mt-3 border-t border-[#F4EFFB] flex justify-end">
                  {game && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReplayMatch(match)}
                      className="text-xs text-[#593B91] font-bold p-1 hover:bg-[#F1EAFF]"
                      rightIcon={<Play className="w-3 h-3 fill-current" />}
                    >
                      Play Again
                    </Button>
                  )}
                </div>
              </article>
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
