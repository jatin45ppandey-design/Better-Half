import React, { useState } from 'react';
import { PlusCircle, LogIn, Sparkles, Heart, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import { JoinRoomModal } from '../modals/JoinRoomModal';
import { useAuth } from '../../context/AuthContext';

interface DashboardRoomActionsProps {
  activeMode: 'couple' | 'friend';
  onModeChange: (mode: 'couple' | 'friend') => void;
}

export const DashboardRoomActions: React.FC<DashboardRoomActionsProps> = ({
  activeMode,
  onModeChange,
}) => {
  const { user } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [roomCodeInput, setRoomCodeInput] = useState('');

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomCodeInput.trim().length !== 6) return;
    setJoinModalOpen(true);
  };

  return (
    <div className="mb-8">
      {/* Top Greeting & Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#211A2D] tracking-tight">
            Game Room Hub
          </h1>
          <p className="text-xs sm:text-sm text-[#756D82] mt-0.5">
            Welcome back, <strong>{user?.name || 'Player'}</strong>. Launch a room, join with a code, or browse all 11 games.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#F8F4FF] rounded-xl border border-[#EAE3F3]">
            <button
              type="button"
              onClick={() => onModeChange('couple')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'couple'
                  ? 'bg-white text-[#9D174D] shadow-xs'
                  : 'text-[#756D82] hover:text-[#211A2D]'
              }`}
            >
              <Heart className="w-3.5 h-3.5 fill-current" />
              Couple (2P)
            </button>
            <button
              type="button"
              onClick={() => onModeChange('friend')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'friend'
                  ? 'bg-white text-[#593B91] shadow-xs'
                  : 'text-[#756D82] hover:text-[#211A2D]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Friend (2–4P)
            </button>
          </div>
        </div>
      </div>

      {/* Primary Room Action Cards (Create Room + Join with Code) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Create Room Card */}
        <div className="md:col-span-7 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-[#593B91] via-[#6C42B3] to-[#9670E8] text-white shadow-md shadow-[#593B91]/10 flex flex-col justify-between">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200">
                Host New Lobby
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
                Create a Multiplayer Room
              </h2>
              <p className="text-xs text-purple-100 max-w-md mt-1 leading-relaxed">
                Choose between Couple Mode or Friend Mode, set room rules, and pick your opening game.
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
              <PlusCircle className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="outline"
              size="md"
              onClick={() => setCreateModalOpen(true)}
              leftIcon={<PlusCircle className="w-4 h-4 text-[#593B91]" />}
              className="bg-white text-[#593B91] hover:bg-white/95 border-none font-bold"
            >
              Create {activeMode === 'couple' ? 'Couple Room' : 'Friend Room'}
            </Button>
            <span className="text-xs text-purple-200 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Instant 6-char room code
            </span>
          </div>
        </div>

        {/* Join Room with Code Card */}
        <div className="md:col-span-5 p-5 sm:p-6 rounded-3xl bg-white border border-[#EAE3F3] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#756D82]">
                Have a Code?
              </span>
              <LogIn className="w-4 h-4 text-[#593B91]" />
            </div>
            <h3 className="text-lg font-bold text-[#211A2D] mb-1">
              Join with Room Code
            </h3>
            <p className="text-xs text-[#756D82] mb-4">
              Enter a 6-character room code from your friend or partner.
            </p>
          </div>

          <form onSubmit={handleJoinSubmit} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="6-character room code"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase().slice(0, 6))}
              className="flex-1 rounded-xl border border-[#EAE3F3] bg-[#FCFAFF] px-3.5 py-2 text-xs font-mono font-bold tracking-widest text-[#211A2D] placeholder-[#9D96A8] uppercase focus:border-[#9670E8] focus:bg-white focus:outline-none"
              maxLength={6}
            />
            <Button
              type="submit"
              variant="secondary"
              size="sm"
              disabled={roomCodeInput.trim().length !== 6}
              className="font-bold shrink-0"
            >
              Join
            </Button>
          </form>
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
