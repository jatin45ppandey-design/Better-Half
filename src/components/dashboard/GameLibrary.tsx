import React, { useState } from 'react';
import { Search, Users, Play, Sparkles, Filter, X } from 'lucide-react';
import { GAMES_DATA, GAME_CATEGORIES } from '../../data/games';
import { GameIcon } from '../ui/GameIcon';
import { soundService } from '../../services/soundService';
import { useGameCatalog } from '../../context/GameCatalogContext';
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
  const [filterByActiveModeOnly, setFilterByActiveModeOnly] = useState(false);
  const {
    isLoading: catalogLoading,
    error: catalogError,
    refreshCatalog,
    isAvailable,
    isAvailableInAnyMode,
    getAvailability,
  } = useGameCatalog();

  // Filter games against server-authoritative mode availability, then search/category.
  const filteredGames = GAMES_DATA.filter((game) => {
    // Mode filter
    if (filterByActiveModeOnly && !isAvailable(game.id, activeMode)) {
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

  const handleCardClick = (game: GameItem) => {
    if (catalogLoading || catalogError || !isAvailableInAnyMode(game.id)) return;
    soundService.playClick();
    onSelectGame(game);
  };

  return (
    <div id="game-library" className="flex flex-col gap-6">
      {catalogError && (
        <div className="rounded-2xl border border-[#7F1D1D] bg-[#1C0F17] px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[#FCA5A5]">{catalogError}</p>
          <button
            type="button"
            onClick={() => void refreshCatalog()}
            className="shrink-0 text-xs font-bold text-white underline underline-offset-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* Library Title & Search Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-white">
              All 11 Multiplayer Games
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#271542] border border-[#3E2368] text-xs font-bold text-[#C084FC]">
              {filteredGames.length} / 11
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#A79BBF] mt-0.5">
            Discover cards, duels, trivia, and physics showdowns. Tap any game to review rules or host a room.
          </p>
        </div>

        {/* Search input */}
        <div className="w-full md:w-80 relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7A6A94] pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Search all 11 games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-[#2D1B48] bg-[#160E25] pl-10 pr-9 py-2.5 text-xs font-medium text-white placeholder-[#7A6A94] focus:border-[#9333EA] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7A6A94] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar: Categories + Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[#160E25] border border-[#2D1B48]">
        {/* Category Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {GAME_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                soundService.playClick();
                setSelectedCategory(cat);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#7C3AED] text-white shadow-md shadow-purple-900/30'
                  : 'bg-[#211438] text-[#A79BBF] hover:text-white hover:bg-[#2C1A4B]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Mode filter switch */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              setFilterByActiveModeOnly(false);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
              !filterByActiveModeOnly
                ? 'bg-[#2A1647] text-white border border-[#4E2B80]'
                : 'text-[#A79BBF] hover:text-white'
            }`}
          >
            Show All 11
          </button>
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              setFilterByActiveModeOnly(true);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
              filterByActiveModeOnly
                ? 'bg-[#2A1647] text-[#C084FC] border border-[#4E2B80]'
                : 'text-[#A79BBF] hover:text-white'
            }`}
          >
            <Filter className="w-3 h-3" />
            <span>{activeMode === 'couple' ? 'Couple Available' : 'Friend Available'}</span>
          </button>
        </div>
      </div>

      {/* Game Cards Grid (All 11 on the same page!) */}
      {filteredGames.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredGames.map((game) => {
            const isCoupleExclusive = game.modes.length === 1 && game.modes[0] === 'couple';
            const isBothModes = game.modes.includes('couple') && game.modes.includes('friend');
            const isEnabledSomewhere = isAvailableInAnyMode(game.id);
            const isEnabledForActiveMode = isAvailable(game.id, activeMode);
            const availability = getAvailability(game.id);
            const availabilityLabel = !isEnabledSomewhere
              ? 'Disabled by admin'
              : !isEnabledForActiveMode
              ? `Available in ${activeMode === 'couple' ? 'Friend' : 'Couple'} Mode`
              : null;

            return (
              <div
                key={game.id}
                onClick={() => handleCardClick(game)}
                aria-disabled={catalogLoading || Boolean(catalogError) || !isEnabledSomewhere}
                title={availability?.maintenanceMessage || availabilityLabel || undefined}
                className={`group relative flex flex-col justify-between bg-[#160E25] rounded-3xl border border-[#2D1B48] p-5 shadow-lg shadow-black/25 transition-all duration-200 select-none ${
                  catalogLoading || catalogError || !isEnabledSomewhere
                    ? 'opacity-55 cursor-not-allowed'
                    : 'hover:border-[#5B339A] hover:bg-[#1D1231] hover:-translate-y-1.5 cursor-pointer'
                }`}
              >
                <div>
                  {/* Card Header: Icon + Eligibility Badge */}
                  <div className="flex items-start justify-between gap-2 mb-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-inner transition-transform group-hover:scale-105 ${game.accentColor.bg} ${game.accentColor.border} ${game.accentColor.text}`}
                    >
                      <GameIcon name={game.iconName} className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {availabilityLabel && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#27272A] text-[#D4D4D8] border border-[#52525B]">
                          {availabilityLabel}
                        </span>
                      )}
                      {isCoupleExclusive ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#3E142F] text-[#F472B6] border border-[#6E2254]">
                          Couple Exclusive
                        </span>
                      ) : isBothModes ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#271542] text-[#C084FC] border border-[#4B287F]">
                          Couple & Friend
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#271542] text-[#C084FC] border border-[#4B287F]">
                          Friend Party
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Game Name & Tagline */}
                  <h3 className="text-base font-bold text-white group-hover:text-[#C084FC] transition-colors leading-tight mb-1 font-heading">
                    {game.name}
                  </h3>
                  <p className="text-xs font-semibold text-[#A79BBF] line-clamp-1 mb-2">
                    {game.tagline}
                  </p>

                  {/* Short Description */}
                  <p className="text-xs text-[#8E7FA8] line-clamp-2 leading-relaxed mb-4">
                    {game.description}
                  </p>
                </div>

                {/* Card Footer: Player Requirements & Action Button */}
                <div className="pt-3 border-t border-[#291742] flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#A79BBF]">
                    <Users className="w-3.5 h-3.5 text-[#C084FC]" />
                    {game.minPlayers === game.maxPlayers
                      ? `${game.minPlayers} Players`
                      : `${game.minPlayers}–${game.maxPlayers} Players`}
                  </span>

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C084FC] group-hover:text-white transition-colors">
                    <span>Rules</span>
                    <Play className="w-3 h-3 fill-current" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[#362157] bg-[#140C22] p-10 text-center text-white">
          <Sparkles className="w-8 h-8 text-[#785E9E] mx-auto mb-3" />
          <h3 className="font-bold text-base text-white">No games match your search</h3>
          <p className="text-xs text-[#A79BBF] mt-1 mb-4">
            Try adjusting your search query or clear the active category filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('All');
              setFilterByActiveModeOnly(false);
            }}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#7C3AED] text-white hover:bg-[#6D28D9] transition-colors cursor-pointer"
          >
            Clear All Filters
          </button>
        </div>
      )}
    </div>
  );
};
