import React, { useState } from 'react';
import { PlusCircle, LogIn, Sparkles } from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import { JoinRoomModal } from '../modals/JoinRoomModal';
import { useAuth } from '../../context/AuthContext';
import { soundService } from '../../services/soundService';

interface DashboardRoomActionsProps {
  activeMode: 'couple' | 'friend';
}

export const DashboardRoomActions: React.FC<DashboardRoomActionsProps> = ({
  activeMode,
}) => {
  const { user } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCodeInput.trim().toUpperCase();
    if (clean.length < 4) return;
    soundService.playClick();
    setJoinModalOpen(true);
  };

  const displayName = user?.name || user?.username || 'Player';

  return (
    <div className="mb-8">
      {/* Dynamic Welcome Hero Card */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#1E1138] via-[#251545] to-[#180E2B] border border-[#3A225E] p-6 sm:p-8 shadow-2xl shadow-black/30 overflow-hidden text-white">
        {/* Atmospheric ambient glow */}
        <div
          className="absolute -top-12 -right-12 w-64 h-64 bg-[#9333EA]/15 rounded-full blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          {/* Welcome User Bio */}
          <div className="flex items-center gap-4">
            <Avatar name={displayName} initials={user?.avatarInitials} bgColor={user?.avatarColor} size="lg" className="ring-4 ring-[#7C3AED]/30 shrink-0" />
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3B2263] border border-[#523386] text-[11px] font-bold text-[#E9D5FF] mb-1.5">
                <Sparkles className="w-3 h-3 text-[#C084FC]" />
                <span>Multiplayer Gaming Hub</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-white">
                Welcome back, {displayName}
              </h1>
              <p className="text-xs sm:text-sm text-[#A79BBF] mt-0.5">
                Host a private room, join with a code, or browse all 11 multiplayer games below.
              </p>
            </div>
          </div>

          {/* Quick Room Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                soundService.playClick();
                setCreateModalOpen(true);
              }}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="rounded-2xl justify-center font-bold shadow-lg shadow-purple-900/40 text-sm py-3 px-5 cursor-pointer"
            >
              Create Room
            </Button>

            <Button
              variant="dark-outline"
              size="md"
              onClick={() => {
                soundService.playClick();
                setJoinModalOpen(true);
              }}
              leftIcon={<LogIn className="w-4 h-4" />}
              className="rounded-2xl justify-center font-bold text-sm py-3 px-5 border-[#4A2E78] hover:bg-[#2F1B4E] cursor-pointer"
            >
              Join Room
            </Button>

            {/* Quick inline code join */}
            <form onSubmit={handleJoinSubmit} className="hidden xl:flex items-center gap-2">
              <input
                type="text"
                placeholder="CODE"
                aria-label="Quick room code input"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 8))}
                className="w-24 rounded-2xl border border-[#3C2462] bg-[#140B22] px-2.5 py-2 text-xs font-mono font-bold tracking-widest text-white placeholder-[#786694] uppercase focus:border-[#9333EA] focus:outline-none text-center"
                maxLength={8}
              />
              <Button
                type="submit"
                variant="dark-outline"
                size="sm"
                disabled={roomCodeInput.trim().length < 4}
                className="rounded-2xl font-bold shrink-0 text-xs py-2"
              >
                Go
              </Button>
            </form>
          </div>
        </div>
      </div>

      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialMode={activeMode}
      />
      <JoinRoomModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        initialCode={roomCodeInput}
      />
    </div>
  );
};
