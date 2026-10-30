import React, { useState } from 'react';
import { Sparkles, Users, Clock, Info } from 'lucide-react';
import { GAMES_DATA, GAME_CATEGORIES } from '../../data/games';
import { SectionHeading } from '../ui/SectionHeading';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { GameIcon } from '../ui/GameIcon';
import { Modal } from '../ui/Modal';
import type { GameItem, GameCategory } from '../../types/game';

export const GamesPreviewSection: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<GameCategory>('All');
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);

  const filteredGames =
    activeCategory === 'All'
      ? GAMES_DATA
      : GAMES_DATA.filter((game) => game.category === activeCategory);

  return (
    <section id="games" className="py-16 sm:py-24 bg-[#FCFAFF]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Complete 11-Game Library"
          title="Games for Every Mood & Chemistry"
          subtitle="From spicy late-night secrets to classroom desk wars and potato golf tournaments. Preview all 11 games launching across Phase 1 and Phase 2."
          align="center"
          className="mb-8"
        />

        {/* Category Tabs */}
        <div className="flex items-center justify-center flex-wrap gap-2 mb-12">
          {GAME_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#593B91] text-white shadow-xs'
                  : 'bg-white text-[#756D82] border border-[#EAE3F3] hover:border-[#D5C7EE] hover:text-[#211A2D]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 11 Game Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredGames.map((game, index) => (
            <div
              key={game.id}
              onClick={() => setSelectedGame(game)}
              className="flex flex-col justify-between bg-white rounded-2xl border border-[#EAE3F3] p-5 shadow-xs hover:border-[#D5C7EE] hover:shadow-md hover:shadow-[#593B91]/5 hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
            >
              <div>
                {/* Top Row: Icon + Category Badge */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center border transition-transform group-hover:scale-105 ${game.accentColor.bg} ${game.accentColor.border} ${game.accentColor.text}`}
                  >
                    <GameIcon name={game.iconName} className="w-5 h-5" />
                  </div>
                  <Badge variant="subtle" size="sm">
                    {game.badgeText}
                  </Badge>
                </div>

                {/* Game Title & Tagline */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[11px] font-bold text-[#9670E8]">
                    0{index + 1}
                  </span>
                  <h3 className="text-base font-bold text-[#211A2D] group-hover:text-[#593B91] transition-colors leading-tight">
                    {game.name}
                  </h3>
                </div>

                <p className="text-xs font-medium text-[#756D82] mb-3 line-clamp-1">
                  {game.tagline}
                </p>

                <p className="text-xs text-[#756D82] line-clamp-2 leading-relaxed mb-4">
                  {game.description}
                </p>
              </div>

              {/* Bottom Metadata */}
              <div className="pt-3 border-t border-[#F4EFFB] flex items-center justify-between text-[11px] text-[#756D82]">
                <span className="flex items-center gap-1 font-medium">
                  <Users className="w-3.5 h-3.5 text-[#9670E8]" />
                  {game.minPlayers === game.maxPlayers
                    ? `${game.minPlayers} Players`
                    : `${game.minPlayers} - ${game.maxPlayers} Players`}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#9D96A8]" />
                  {game.estimatedMinutes}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Honest Note Banner */}
        <div className="mt-12 p-4 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] max-w-2xl mx-auto flex items-center gap-3 text-xs text-[#593B91]">
          <Info className="w-4 h-4 shrink-0 text-[#9670E8]" />
          <span>
            <strong>Phase 1 Preview:</strong> All 11 games are established in our design system and state architecture. Real-time gameplay engines and room lobbies will be unlocked in Phase 2.
          </span>
        </div>
      </div>

      {/* Game Detail Preview Modal */}
      {selectedGame && (
        <Modal
          isOpen={!!selectedGame}
          onClose={() => setSelectedGame(null)}
          title={selectedGame.name}
          description={selectedGame.tagline}
          maxWidth="md"
        >
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex items-center gap-2">
              <Badge variant="lavender" size="sm">
                {selectedGame.category}
              </Badge>
              <Badge variant="subtle" size="sm">
                {selectedGame.minPlayers === selectedGame.maxPlayers
                  ? `${selectedGame.minPlayers} Players`
                  : `${selectedGame.minPlayers} to ${selectedGame.maxPlayers} Players`}
              </Badge>
              <Badge variant="warning" size="sm">
                Phase 2 Engine
              </Badge>
            </div>

            <p className="text-sm text-[#211A2D] leading-relaxed">
              {selectedGame.description}
            </p>

            <div className="p-4 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-2">
                Rules & Gameplay Teaser
              </h4>
              <ul className="flex flex-col gap-2 text-xs text-[#756D82]">
                {selectedGame.rulesPreview.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-bold text-[#9670E8]">{idx + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between text-xs text-[#756D82]">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-[#9670E8]" />
                Full multiplayer lobby in Phase 2
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedGame(null)}
              >
                Close Preview
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
};
