import React from 'react';
import { BookOpen, Keyboard, ShieldAlert } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import type { GameItem } from '../../types/game';

interface GameInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  game: GameItem;
}

export const GameInstructionsModal: React.FC<GameInstructionsModalProps> = ({
  isOpen,
  onClose,
  game,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`How to Play: ${game.name}`}
      description={game.tagline}
      maxWidth="lg"
    >
      <div className="flex flex-col gap-5 pt-1">
        {/* Overview banner */}
        <div className="p-4 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] text-xs sm:text-sm text-[#211A2D] leading-relaxed">
          <p className="font-semibold text-[#593B91] mb-1">Game Overview</p>
          <p className="text-[#756D82]">{game.instructions.overview}</p>
        </div>

        {/* Rules */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Rules & Sequence
          </h4>
          <ul className="flex flex-col gap-2 p-3.5 rounded-2xl bg-white border border-[#EAE3F3] text-xs text-[#211A2D]">
            {game.instructions.rules.map((rule, idx) => (
              <li key={idx} className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#F1EAFF] text-[#593B91] font-bold flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                  {idx + 1}
                </span>
                <span className="leading-tight pt-0.5">{rule}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Controls */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-1.5 flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5" />
            Player Controls
          </h4>
          <div className="p-3 rounded-xl bg-[#FCFAFF] border border-[#EAE3F3] text-xs text-[#756D82]">
            {game.instructions.controls}
          </div>
        </div>

        {/* Prototype Rule Decisions Note */}
        <div className="p-3 rounded-xl bg-[#FFFBEB] border border-[#FEF3C7] flex items-start gap-2 text-xs text-[#92400E]">
          <ShieldAlert className="w-4 h-4 shrink-0 text-[#D97706] mt-0.5" />
          <div>
            <strong>Phase 2 Prototype Rule Assumptions:</strong> {game.instructions.prototypeNotes}
          </div>
        </div>

        <div className="pt-2 border-t border-[#EAE3F3] flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            Back to Match
          </Button>
        </div>
      </div>
    </Modal>
  );
};
