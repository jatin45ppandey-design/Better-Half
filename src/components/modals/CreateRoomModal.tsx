import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Users,
  Copy,
  Check,
  Gamepad2,
  Sparkles,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { GAMES_DATA } from '../../data/games';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useRoom } from '../../context/RoomContext';
import type { GameItem } from '../../types/game';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'couple' | 'friend';
  initialGame?: GameItem | null;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'couple',
  initialGame = null,
}) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { createRoom } = useRoom();
  const navigate = useNavigate();

  const [step, setStep] = useState<'configure' | 'ready'>('configure');
  const [selectedMode, setSelectedMode] = useState<'couple' | 'friend'>(initialMode);
  const [roomName, setRoomName] = useState(
    user?.name ? `${user.name.split(' ')[0]}'s Game Room` : 'Evening Game Room'
  );
  const [selectedGameId, setSelectedGameId] = useState<string>(
    initialGame ? initialGame.id : 'between-us'
  );
  const [activeRoomCode, setActiveRoomCode] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setStep('configure');
    setSelectedMode(initialMode);
    setCopied(false);
    setIsSubmitting(false);
    onClose();
  };

  const availableGames = GAMES_DATA.filter((g) =>
    g.modes.includes(selectedMode)
  );

  const selectedGame =
    GAMES_DATA.find((g) => g.id === selectedGameId) || availableGames[0];

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const created = await createRoom({ name: roomName, mode: selectedMode, selectedGameId });
      setActiveRoomCode(created.code);
      setStep('ready');
      addToast(`Room ${created.code} Created!`, {
        type: 'success',
        message: `${selectedMode === 'couple' ? 'Couple Mode (2P)' : 'Friend Mode (4P)'} configured.`,
      });
    } catch (err: any) {
      addToast(err?.message || 'Failed to create room. Please check backend connection.', {
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    const codeToCopy = activeRoomCode;
    if (!codeToCopy) return;
    navigator.clipboard?.writeText(codeToCopy);
    setCopied(true);
    addToast('Room Code Copied!', {
      type: 'info',
      message: `Code: ${codeToCopy}`,
    });
    setTimeout(() => setCopied(false), 2500);
  };

  const handleEnterLobby = () => {
    onClose();
    if (activeRoomCode) {
      navigate(`/room/${activeRoomCode}`);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'configure' ? 'Create Multiplayer Room' : 'Room Ready — Lobby Preview'}
      description={
        step === 'configure'
          ? 'Configure player mode and select the opening game.'
          : `Share room code with your ${selectedMode === 'couple' ? 'partner' : 'friends'}.`
      }
      maxWidth="lg"
    >
      {step === 'configure' ? (
        <form onSubmit={handleCreateRoom} className="flex flex-col gap-5 pt-1">
          {/* 1. Mode Selection Cards */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-2 block">
              1. Choose Experience Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedMode('couple');
                  // If selected game not in couple mode, reset to between-us
                  const g = GAMES_DATA.find((item) => item.id === selectedGameId);
                  if (g && !g.modes.includes('couple')) {
                    setSelectedGameId('between-us');
                  }
                }}
                className={`p-3.5 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                  selectedMode === 'couple'
                    ? 'border-[#9670E8] bg-[#F1EAFF]/50 shadow-xs'
                    : 'border-[#EAE3F3] bg-white hover:border-[#D5C7EE]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FDF2F8] text-[#9D174D] flex items-center justify-center">
                    <Heart className="w-4 h-4 fill-current" />
                  </div>
                  <Badge variant="pink" size="sm">
                    2 Players
                  </Badge>
                </div>
                <span className="text-sm font-bold text-[#211A2D]">Couple Mode</span>
                <span className="text-[11px] text-[#756D82]">Intimate & cozy</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedMode('friend');
                  const g = GAMES_DATA.find((item) => item.id === selectedGameId);
                  if (g && !g.modes.includes('friend')) {
                    setSelectedGameId('uno-style');
                  }
                }}
                className={`p-3.5 rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                  selectedMode === 'friend'
                    ? 'border-[#9670E8] bg-[#F1EAFF]/50 shadow-xs'
                    : 'border-[#EAE3F3] bg-white hover:border-[#D5C7EE]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-xl bg-[#F1EAFF] text-[#593B91] flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <Badge variant="lavender" size="sm">
                    Up to 4 Players
                  </Badge>
                </div>
                <span className="text-sm font-bold text-[#211A2D]">Friend Mode</span>
                <span className="text-[11px] text-[#756D82]">Group banter & energy</span>
              </button>
            </div>
          </div>

          {/* 2. Room Name */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-1.5 block">
              2. Room Name
            </label>
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Saturday Night Showdown"
              required
            />
          </div>

          {/* 3. Opening Game Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#593B91]">
                3. Initial Game Pick
              </label>
              <span className="text-[11px] text-[#756D82]">
                {availableGames.length} games available for {selectedMode === 'couple' ? 'Couple' : 'Friend'} mode
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 border border-[#EAE3F3] rounded-2xl bg-[#FCFAFF]">
              {availableGames.map((game) => {
                const isSelected = selectedGameId === game.id;
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => setSelectedGameId(game.id)}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#9670E8] bg-white shadow-xs font-bold text-[#593B91]'
                        : 'border-transparent hover:bg-white text-[#211A2D]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold truncate">{game.name}</span>
                    </div>
                    <Badge variant={isSelected ? 'purple' : 'subtle'} size="sm">
                      {game.category}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Live Multiplayer Note */}
          <div className="p-3 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] text-xs text-[#593B91] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#9670E8] shrink-0" />
            <span>
              <strong>Live Multiplayer Room:</strong> Your room will be created on the game server with real-time Socket.IO synchronization.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              {isSubmitting ? 'Creating Room...' : 'Create Live Room'}
            </Button>
          </div>
        </form>
      ) : (
        /* Room Ready Screen */
        <div className="flex flex-col gap-5 pt-1">
          {/* Room Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F8F4FF] via-white to-[#F1EAFF] border border-[#EAE3F3] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#756D82]">
                  {selectedMode === 'couple' ? 'Couple Room (2P)' : 'Friend Room (4P)'}
                </span>
                <h3 className="text-xl font-bold text-[#211A2D]">{roomName}</h3>
              </div>
              <Badge variant="success" size="sm">
                Room Created
              </Badge>
            </div>

            {/* Room Code Display */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-white border-2 border-[#9670E8] shadow-xs">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#756D82]">
                  Join Code
                </span>
                <span className="text-2xl font-mono font-extrabold tracking-widest text-[#593B91]">
                  {activeRoomCode}
                </span>
              </div>
              <Button
                variant={copied ? 'secondary' : 'outline'}
                size="sm"
                onClick={handleCopyCode}
                leftIcon={copied ? <Check className="w-4 h-4 text-[#248A62]" /> : <Copy className="w-4 h-4" />}
              >
                {copied ? 'Copied' : 'Copy Code'}
              </Button>
            </div>

            {/* Selected Game Card */}
            {selectedGame && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#FCFAFF] border border-[#EAE3F3]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#593B91] text-white flex items-center justify-center font-bold text-xs">
                    <Gamepad2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-[#211A2D] block">
                      {selectedGame.name}
                    </span>
                    <span className="text-[11px] text-[#756D82]">
                      {selectedGame.category} • {selectedGame.estimatedMinutes}
                    </span>
                  </div>
                </div>
                <Badge variant="subtle" size="sm">
                  Opening Game
                </Badge>
              </div>
            )}
          </div>

          {/* Player Slots Preview */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-2.5">
              Player Slots ({selectedMode === 'couple' ? '1 of 2 joined' : '1 of 4 joined'})
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-xl border-2 border-[#9670E8] bg-white flex flex-col items-center text-center">
                <div className="w-9 h-9 rounded-full bg-[#9670E8] text-white font-bold flex items-center justify-center text-xs mb-1">
                  {user?.name ? user.name[0].toUpperCase() : 'H'}
                </div>
                <span className="text-xs font-bold text-[#211A2D] truncate w-full">
                  {user?.name || 'Host Player'}
                </span>
                <span className="text-[10px] text-[#248A62] font-semibold">Host (Ready)</span>
              </div>

              {Array.from({ length: selectedMode === 'couple' ? 1 : 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-dashed border-[#D5C7EE] bg-[#FAF8FE] flex flex-col items-center justify-center text-center text-[#756D82]"
                >
                  <div className="w-9 h-9 rounded-full border border-dashed border-[#D5C7EE] flex items-center justify-center text-xs mb-1">
                    ?
                  </div>
                  <span className="text-xs font-medium">Slot {idx + 2}</span>
                  <span className="text-[10px] text-[#9D96A8]">Waiting for code</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setStep('configure')}>
              Change Settings
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnterLobby}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              Enter Room Lobby
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
