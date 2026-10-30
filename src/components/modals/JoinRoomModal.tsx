import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Sparkles, Check, ArrowRight } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { useToast } from '../../context/ToastContext';
import { useRoom } from '../../context/RoomContext';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCode?: string;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  initialCode = '',
}) => {
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState('');
  const [joinedRoom, setJoinedRoom] = useState<{
    code: string;
    hostName: string;
    mode: 'couple' | 'friend';
    gameName: string;
    roomName: string;
  } | null>(null);

  const { addToast } = useToast();
  const { joinRoom, getRoomByCode } = useRoom();
  const navigate = useNavigate();

  const handleClose = () => {
    setCode(initialCode);
    setError('');
    setJoinedRoom(null);
    onClose();
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (cleanCode.length !== 6) {
      setError('Room code must be exactly 6 characters.');
      return;
    }

    const joinRes = joinRoom(cleanCode);
    if (!joinRes.success) {
      setError(joinRes.error || `Room "${cleanCode}" not found. Try PLAY69 or LOVE22.`);
      return;
    }

    const foundRoom = getRoomByCode(cleanCode);
    const mockRoom = {
      code: cleanCode,
      hostName: foundRoom?.hostName || 'Room Host',
      mode: (foundRoom?.mode || 'couple') as 'couple' | 'friend',
      gameName: foundRoom?.selectedGameId ? foundRoom.selectedGameId.toUpperCase() : 'Lobby Game',
      roomName: foundRoom?.name || 'PlaySpace Game Room',
    };

    setJoinedRoom(mockRoom);
    setError('');
    addToast(`Connected to room ${cleanCode}!`, {
      type: 'success',
      message: `Hosted by ${mockRoom.hostName} • ${mockRoom.roomName}`,
    });
  };

  const handleQuickAutofill = (demoCode: string) => {
    setCode(demoCode);
    setError('');
  };

  const handleEnterLobby = () => {
    if (joinedRoom) {
      onClose();
      navigate(`/room/${joinedRoom.code}`);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={joinedRoom ? 'Room Joined' : 'Join Multiplayer Room'}
      description={
        joinedRoom
          ? 'You have connected to the mock multiplayer room lobby.'
          : 'Enter a 6-character room code from your partner or host.'
      }
      maxWidth="md"
    >
      {!joinedRoom ? (
        <form onSubmit={handleJoin} className="flex flex-col gap-5 pt-1">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-1.5 block">
              6-Character Room Code
            </label>
            <Input
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase().slice(0, 6));
                if (error) setError('');
              }}
              placeholder="e.g. PLAY69"
              className="text-center font-mono text-xl tracking-widest uppercase font-bold"
              maxLength={6}
              error={error}
              autoFocus
              required
            />
          </div>

          {/* Quick Demo Suggestions */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#756D82]">
              Quick Demo Codes:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickAutofill('PLAY69')}
                className="px-2.5 py-1 rounded-lg border border-[#EAE3F3] bg-[#F8F4FF] text-xs font-mono font-bold text-[#593B91] hover:bg-[#F1EAFF] transition-colors cursor-pointer"
              >
                PLAY69 (Friend Mode)
              </button>
              <button
                type="button"
                onClick={() => handleQuickAutofill('LOVE22')}
                className="px-2.5 py-1 rounded-lg border border-[#FCE7F3] bg-[#FDF2F8] text-xs font-mono font-bold text-[#9D174D] hover:bg-[#FCE7F3] transition-colors cursor-pointer"
              >
                LOVE22 (Couple Mode)
              </button>
            </div>
          </div>

          {/* Honest Note */}
          <div className="p-3 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] text-xs text-[#593B91] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#9670E8] shrink-0" />
            <span>
              <strong>Phase 1 Preview:</strong> Validates room code input and transitions to the product lobby state. Real-time peer-to-peer sync activates in Phase 2.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              Connect to Room
            </Button>
          </div>
        </form>
      ) : (
        /* Joined Room Summary */
        <div className="flex flex-col gap-5 pt-1">
          <div className="p-5 rounded-2xl bg-gradient-to-br from-[#F8F4FF] to-white border border-[#EAE3F3] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#756D82]">
                Room {joinedRoom.code}
              </span>
              <Badge variant={joinedRoom.mode === 'couple' ? 'pink' : 'lavender'} size="sm">
                {joinedRoom.mode === 'couple' ? 'Couple Mode (2P)' : 'Friend Mode (4P)'}
              </Badge>
            </div>

            <h3 className="text-xl font-bold text-[#211A2D]">
              {joinedRoom.roomName}
            </h3>

            <div className="flex items-center gap-2 text-xs text-[#756D82]">
              <span>Hosted by <strong className="text-[#211A2D]">{joinedRoom.hostName}</strong></span>
              <span>•</span>
              <span>Opening Game: <strong className="text-[#593B91]">{joinedRoom.gameName}</strong></span>
            </div>
          </div>

          {/* Participant preview */}
          <div className="p-3 rounded-xl border border-[#EAE3F3] bg-[#FCFAFF] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#593B91] text-white flex items-center justify-center font-bold text-xs">
                {joinedRoom.hostName[0]}
              </div>
              <span className="font-semibold text-[#211A2D]">{joinedRoom.hostName} (Host)</span>
            </div>
            <span className="flex items-center gap-1 text-[#248A62] font-semibold">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              In Lobby
            </span>
          </div>

          <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setJoinedRoom(null)}>
              Join Another Code
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnterLobby}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Enter Room Lobby
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
