import React, { useState } from 'react';
import { Users, Sparkles, Check, Copy } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useToast } from '../../context/ToastContext';
import type { GameItem } from '../../types/game';

interface Phase2PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGame?: GameItem | null;
  mode?: 'couple' | 'friend';
}

export const Phase2PreviewModal: React.FC<Phase2PreviewModalProps> = ({
  isOpen,
  onClose,
  selectedGame,
  mode = 'couple',
}) => {
  const [mockRoomCode] = useState(() =>
    Math.random().toString(36).substring(2, 8).toUpperCase()
  );
  const { addToast } = useToast();

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(mockRoomCode);
    addToast('Mock Room Code Copied!', {
      type: 'info',
      message: `Code: ${mockRoomCode} (Development Preview)`,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={selectedGame ? `Lobby: ${selectedGame.name}` : 'Multiplayer Lobby Preview'}
      description="Phase 2 Upcoming Architecture & Room Flow"
      maxWidth="md"
    >
      <div className="flex flex-col gap-5 pt-1">
        {/* Transparent Roadmap Pill */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#9670E8]" />
            <span className="text-xs font-bold text-[#593B91]">
              Phase 2 Preview Environment
            </span>
          </div>
          <Badge variant="purple" size="sm">
            Roadmap
          </Badge>
        </div>

        {/* Simulated Room Card */}
        <div className="p-5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#756D82] uppercase tracking-wider">
              Simulated Room Code
            </span>
            <span className="text-xs text-[#248A62] font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#248A62] inline-block animate-pulse" />
              Lobby Initialized (Mock)
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-[#EAE3F3]">
            <span className="text-xl font-mono font-bold tracking-widest text-[#593B91]">
              {mockRoomCode}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyCode}
              leftIcon={<Copy className="w-3.5 h-3.5" />}
            >
              Copy
            </Button>
          </div>

          <div className="text-[11px] text-[#756D82] flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-[#9670E8]" />
            <span>
              Target Mode:{' '}
              <strong className="text-[#211A2D]">
                {mode === 'couple' ? 'Couple Mode (2 Players)' : 'Friend Mode (Up to 4 Players)'}
              </strong>
            </span>
          </div>
        </div>

        {/* Phase 2 Engineering Specifications */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-2">
            What is coming in Phase 2?
          </h4>
          <ul className="flex flex-col gap-2 text-xs text-[#756D82]">
            <li className="flex items-start gap-2">
              <div className="p-0.5 rounded-full bg-[#EBF7F2] text-[#248A62] shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Real-time WebSocket / WebRTC room state synchronization</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="p-0.5 rounded-full bg-[#EBF7F2] text-[#248A62] shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Interactive gameplay canvas & turns for all 11 games</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="p-0.5 rounded-full bg-[#EBF7F2] text-[#248A62] shrink-0 mt-0.5">
                <Check className="w-3 h-3 stroke-[3]" />
              </div>
              <span>Instant mobile pass-and-play and private QR code invites</span>
            </li>
          </ul>
        </div>

        {/* Bottom CTA */}
        <div className="pt-2 border-t border-[#EAE3F3] flex justify-end">
          <Button variant="primary" size="sm" onClick={onClose}>
            Got it, return to Dashboard
          </Button>
        </div>
      </div>
    </Modal>
  );
};
