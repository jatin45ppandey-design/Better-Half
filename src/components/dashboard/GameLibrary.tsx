import React, { useState } from 'react';
import { Search, Users, Play } from 'lucide-react';
import { GAMES_DATA, GAME_CATEGORIES } from '../../data/games';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { GameIcon } from '../ui/GameIcon';
import type { GameItem, GameCategory } from '../../types/game';

interface GameLibraryProps {
  activeMode: 'couple' | 'friend';
  onSelectGame: (game: GameItem) => void;
}

export const GameLibrary: React.FC<GameLibraryProps> = ({
  activeMode,
  onSelectGame,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<GameCategory>('All');
  const [modeFilter, setModeFilter] = useState<'all' | 'mode-only'>('all');

  // Filter games based on search, category, and mode
  const filteredGames = GAMES_DATA.filter((game) => {
    // Mode filter
    if (modeFilter === 'mode-only' && !game.modes.includes(activeMode)) {
      return false;
    }

    // Category filter
    if (selectedCategory !== 'All' && game.category !== selectedCategory) {
      return false;
    }

    // Search query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchName = game.name.toLowerCase().includes(q);
      const matchDesc = game.description.toLowerCase().includes(q);
      const matchTag = game.tagline.toLowerCase().includes(q);
      const matchCat = game.category.toLowerCase().includes(q);
      return matchName || matchDesc || matchTag || matchCat;
    }

    return true;
  });

  return (
    <div id="game-library" className="flex flex-col gap-6">
      {/* Library Title & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#211A2D]">
            Game Library ({filteredGames.length} / 11)
          </h2>
          <p className="text-xs sm:text-sm text-[#756D82] mt-0.5">
            Choose a game to review its mechanics and create a room.
          </p>
        </div>

        {/* Search input */}
        <div className="w-full md:w-72">
          <Input
            placeholder="Search games or categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-[#756D82]" />}
            className="text-xs"
          />
        </div>
      </div>

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3]">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
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

        {/* Mode specific filter toggle */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setModeFilter('all')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              modeFilter === 'all'
                ? 'bg-white text-[#593B91] font-bold shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            All 11
          </button>
          <button
            type="button"
            onClick={() => setModeFilter('mode-only')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
              modeFilter === 'mode-only'
                ? 'bg-white text-[#593B91] font-bold shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            {activeMode === 'couple' ? 'Couple Only' : 'Friend Mode Only'}
          </button>
        </div>
      </div>

      {/* Game Cards Grid */}
      {filteredGames.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGames.map((game) => (
            <div
              key={game.id}
              onClick={() => onSelectGame(game)}
              className="group relative flex flex-col justify-between bg-white rounded-2xl border border-[#EAE3F3] p-5 shadow-xs hover:border-[#D5C7EE] hover:shadow-md hover:shadow-[#593B91]/5 hover:-translate-y-1 transition-all duration-200 cursor-pointer"
            >
              <div>
                {/* Header: Icon + Category Badge */}
                <div className="flex items-start justify-between gap-2 mb-3.5">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105 ${game.accentColor.bg} ${game.accentColor.border} ${game.accentColor.text}`}
                  >
                    <GameIcon name={game.iconName} className="w-5 h-5" />
                  </div>
                  <Badge variant="subtle" size="sm">
                    {game.badgeText}
                  </Badge>
                </div>

                {/* Name & Tagline */}
                <h3 className="text-base font-bold text-[#211A2D] group-hover:text-[#593B91] transition-colors leading-tight mb-1">
                  {game.name}
                </h3>
                <p className="text-xs font-medium text-[#756D82] line-clamp-1 mb-2.5">
                  {game.tagline}
                </p>

                {/* Description */}
                <p className="text-xs text-[#756D82] line-clamp-2 leading-relaxed mb-4">
                  {game.description}
                </p>
              </div>

              {/* Bottom Card Footer */}
              <div className="pt-3 border-t border-[#F4EFFB] flex items-center justify-between">
                <span className="flex items-center gap-1 text-[11px] font-medium text-[#756D82]">
                  <Users className="w-3.5 h-3.5 text-[#9670E8]" />
                  {game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers} Players`
                    : `${game.minPlayers}-${game.maxPlayers} Players`}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#593B91] font-semibold p-1 hover:bg-[#F1EAFF]"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectGame(game);
                  }}
                  rightIcon={<Play className="w-3 h-3 fill-current" />}
                >
                  Preview
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Games Found"
          description="We couldn't find any games matching your current search or category filter."
          actionLabel="Clear All Filters"
          onAction={() => {
            setSearchQuery('');
            setSelectedCategory('All');
            setModeFilter('all');
          }}
        />
      )}
    </div>
  );
};
