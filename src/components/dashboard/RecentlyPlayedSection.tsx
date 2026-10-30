import React, { useState } from 'react';
import { History, Play, Heart, Users } from 'lucide-react';
import { RECENT_MOCK_MATCHES, GAMES_DATA } from '../../data/games';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { GameIcon } from '../ui/GameIcon';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import type { RecentMatch, GameItem } from '../../types/game';

export const RecentlyPlayedSection: React.FC = () => {
  const [selectedGameForRoom, setSelectedGameForRoom] = useState<GameItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const handleReplayMatch = (match: RecentMatch) => {
    const game = GAMES_DATA.find((g) => g.id === match.gameId) || null;
    setSelectedGameForRoom(game);
    setCreateModalOpen(true);
  };

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#593B91]" />
          <h2 className="text-lg font-bold text-[#211A2D]">
            Recently Played
          </h2>
          <Badge variant="subtle" size="sm">
            Local Sample History
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {RECENT_MOCK_MATCHES.map((match) => {
          const game = GAMES_DATA.find((g) => g.id === match.gameId);
          const isCouple = match.mode === 'couple';

          return (
            <div
              key={match.id}
              className="p-4 rounded-2xl bg-white border border-[#EAE3F3] hover:border-[#D5C7EE] transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <Badge variant={isCouple ? 'pink' : 'lavender'} size="sm">
                    {isCouple ? (
                      <span className="flex items-center gap-1">
                        <Heart className="w-3 h-3 fill-current" />
                        Couple Mode
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Friend Mode
                      </span>
                    )}
                  </Badge>
                  <span className="text-[11px] text-[#756D82] font-medium">
                    {match.playedAgo}
                  </span>
                </div>

                <div className="flex items-center gap-2.5 mb-2">
                  {game && (
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border ${game.accentColor.bg} ${game.accentColor.border} ${game.accentColor.text}`}
                    >
                      <GameIcon name={game.iconName} className="w-4 h-4" />
                    </div>
                  )}
                  <h3 className="text-sm font-bold text-[#211A2D] truncate">
                    {match.gameName}
                  </h3>
                </div>

                <div className="text-xs text-[#756D82] mb-3">
                  <p className="font-semibold text-[#593B91]">{match.outcome}</p>
                  <p className="text-[11px] text-[#9D96A8] mt-0.5">{match.scoreOrRounds}</p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#F4EFFB] flex items-center justify-between">
                <span className="text-[11px] text-[#756D82] truncate max-w-[150px]">
                  {match.players.join(', ')}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReplayMatch(match)}
                  className="text-xs text-[#593B91] font-bold p-1 hover:bg-[#F1EAFF]"
                  rightIcon={<Play className="w-3 h-3 fill-current" />}
                >
                  Play Again
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialGame={selectedGameForRoom}
      />
    </div>
  );
};
