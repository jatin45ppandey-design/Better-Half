import React from 'react';
import { Users, Clock, Play } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { GameIcon } from '../ui/GameIcon';
import type { GameItem } from '../../types/game';

interface GameDetailModalProps {
  game: GameItem | null;
  onClose: () => void;
  onLaunchPhase2: (game: GameItem) => void;
}

export const GameDetailModal: React.FC<GameDetailModalProps> = ({
  game,
  onClose,
  onLaunchPhase2,
}) => {
  if (!game) return null;

  return (
    <Modal
      isOpen={!!game}
      onClose={onClose}
      title={game.name}
      description={game.tagline}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5 pt-2">
        {/* Top Badges Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border ${game.accentColor.bg} ${game.accentColor.border} ${game.accentColor.text}`}
          >
            <GameIcon name={game.iconName} className="w-4 h-4" />
          </div>
          <Badge variant="lavender" size="sm">
            {game.category}
          </Badge>
          <Badge variant="subtle" size="sm" icon={<Users className="w-3 h-3" />}>
            {game.minPlayers === game.maxPlayers
              ? `${game.minPlayers} Players`
              : `${game.minPlayers} - ${game.maxPlayers} Players`}
          </Badge>
          <Badge variant="subtle" size="sm" icon={<Clock className="w-3 h-3" />}>
            {game.estimatedMinutes}
          </Badge>
          <Badge variant="warning" size="sm">
            Game
          </Badge>
        </div>

        {/* Description */}
        <div className="p-4 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] text-sm text-[#211A2D] leading-relaxed">
          <p>{game.description}</p>
        </div>

        {/* Rules Teaser */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-2.5">
            Rules & Game Mechanics
          </h4>
          <div className="p-4 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3]">
            <ul className="flex flex-col gap-2.5 text-xs text-[#211A2D]">
              {game.rulesPreview.map((rule, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#EAE3F3] text-[#593B91] font-bold flex items-center justify-center shrink-0 text-[10px]">
                    {idx + 1}
                  </span>
                  <span className="leading-tight pt-0.5">{rule}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer CTAs */}
        <div className="pt-2 border-t border-[#EAE3F3] flex flex-col sm:flex-row items-center justify-between gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="w-full sm:w-auto">
            Back to Library
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onLaunchPhase2(game)}
            rightIcon={<Play className="w-3.5 h-3.5 fill-current" />}
            className="w-full sm:w-auto"
          >
            Create Room & Play
          </Button>
        </div>
      </div>
    </Modal>
  );
};
