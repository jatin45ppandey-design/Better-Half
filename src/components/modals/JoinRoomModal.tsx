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
  const [isJoining, setIsJoining] = useState(false);
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
    setIsJoining(false);
    setJoinedRoom(null);
    onClose();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (cleanCode.length !== 6) {
      setError('Room code must be exactly 6 characters.');
      return;
    }

    setIsJoining(true);
    setError('');
    const joinRes = await joinRoom(cleanCode);
    setIsJoining(false);

    if (!joinRes.success) {
      setError(joinRes.error || `Room "${cleanCode}" could not be reached or does not exist.`);
      return;
    }

    const foundRoom = joinRes.room || getRoomByCode(cleanCode);
    const roomDetails = {
      code: cleanCode,
      hostName: foundRoom?.hostName || 'Room Host',
      mode: (foundRoom?.mode || 'couple') as 'couple' | 'friend',
      gameName: foundRoom?.selectedGameId ? foundRoom.selectedGameId.toUpperCase() : 'Lobby Game',
      roomName: foundRoom?.name || 'PlaySpace Game Room',
    };

    setJoinedRoom(roomDetails);
    setError('');
    addToast(`Connected to room ${cleanCode}!`, {
      type: 'success',
      message: `Hosted by ${roomDetails.hostName} • ${roomDetails.roomName}`,
    });
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
          ? 'You have connected to the multiplayer room lobby.'
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
              placeholder="e.g. LOVE22"
              className="text-center font-mono text-xl tracking-widest uppercase font-bold"
              maxLength={6}
              error={error}
              autoFocus
              required
            />
          </div>

          {/* Real-time sync note */}
          <div className="p-3 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] text-xs text-[#593B91] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#9670E8] shrink-0" />
            <span>
              <strong>Real-Time Multiplayer:</strong> Connecting syncs live participants, ready checks, and lobby chat directly via WebSockets.
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isJoining}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isJoining}
              disabled={isJoining}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              {isJoining ? 'Connecting...' : 'Join Room'}
            </Button>
          </div>
        </form>
      ) : (
        /* Joined Room Summary Screen */
        <div className="flex flex-col gap-5 pt-1">
          <div className="p-4 rounded-2xl bg-[#F7FCF9] border border-[#C6ECD9] flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#248A62] text-white flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-[#211A2D]">
                Room #{joinedRoom.code} Found!
              </h4>
              <p className="text-xs text-[#756D82] mt-0.5">
                {joinedRoom.roomName} • Hosted by {joinedRoom.hostName}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex flex-col gap-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#756D82]">Match Mode:</span>
              <Badge variant={joinedRoom.mode === 'couple' ? 'pink' : 'purple'} size="sm">
                {joinedRoom.mode === 'couple' ? 'Couple Mode (2P)' : 'Friend Mode (4P)'}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#756D82]">Selected Game:</span>
              <span className="font-bold text-[#593B91]">{joinedRoom.gameName}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={handleClose}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEnterLobby}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Enter Lobby
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
