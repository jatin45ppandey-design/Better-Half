import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Users, Play } from 'lucide-react';
import { GAMES_DATA, GAME_CATEGORIES } from '../../data/games';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { GameIcon } from '../ui/GameIcon';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import type { GameItem, GameCategory } from '../../types/game';

export const CompactGameDiscovery: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All');
  const [selectedGameForRoom, setSelectedGameForRoom] = useState<GameItem | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const displayedGames =
    selectedCategory === 'All'
      ? GAMES_DATA.slice(0, 8)
      : GAMES_DATA.filter((g) => g.category === selectedCategory).slice(0, 8);

  const handleLaunchGameRoom = (game: GameItem) => {
    setSelectedGameForRoom(game);
    setCreateModalOpen(true);
  };

  return (
    <section className="py-14 sm:py-18 bg-[#FCFAFF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with direct Dashboard Link */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <Badge variant="subtle" size="sm" className="mb-2">
              Game Catalog Preview
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#211A2D] tracking-tight">
              Featured Multiplayer Games
            </h2>
            <p className="text-xs sm:text-sm text-[#756D82] mt-0.5">
              Select any game to initialize a room or explore all 11 games in your player dashboard.
            </p>
          </div>

          <Link to="/dashboard">
            <Button
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="font-bold shrink-0"
            >
              Open Full Library in Dashboard
            </Button>
          </Link>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 flex-wrap mb-6">
          {GAME_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#593B91] text-white shadow-xs'
                  : 'bg-white text-[#756D82] border border-[#EAE3F3] hover:border-[#D5C7EE]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Compact Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {displayedGames.map((game) => (
            <div
              key={game.id}
              className="p-4 rounded-2xl bg-white border border-[#EAE3F3] hover:border-[#D5C7EE] hover:shadow-md hover:shadow-[#593B91]/5 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border ${game.accentColor.bg} ${game.accentColor.border} ${game.accentColor.text}`}
                  >
                    <GameIcon name={game.iconName} className="w-4 h-4" />
                  </div>
                  <Badge variant="subtle" size="sm">
                    {game.badgeText}
                  </Badge>
                </div>

                <h3 className="text-sm font-bold text-[#211A2D] group-hover:text-[#593B91] transition-colors leading-tight mb-1">
                  {game.name}
                </h3>
                <p className="text-xs text-[#756D82] line-clamp-2 leading-relaxed mb-3">
                  {game.description}
                </p>
              </div>

              <div className="pt-2.5 border-t border-[#F4EFFB] flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#756D82]">
                  <Users className="w-3 h-3 text-[#9670E8]" />
                  {game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers}P`
                    : `${game.minPlayers}-${game.maxPlayers}P`}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleLaunchGameRoom(game)}
                  className="text-xs text-[#593B91] font-bold p-1 hover:bg-[#F1EAFF]"
                  rightIcon={<Play className="w-3 h-3 fill-current" />}
                >
                  Create Room
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialGame={selectedGameForRoom}
      />
    </section>
  );
};
