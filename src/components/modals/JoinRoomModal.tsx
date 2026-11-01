import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
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
  const [code, setCode] = useState(initialCode.trim().toUpperCase());
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const { joinRoom } = useRoom();
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      setCode(initialCode.trim().toUpperCase());
      setError('');
      setIsJoining(false);
    }
  }, [initialCode, isOpen]);

  const handleClose = () => {
    if (isJoining) return;
    setError('');
    onClose();
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode || cleanCode.length < 4 || cleanCode.length > 8) {
      setError('Please enter a valid room code.');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      const joinRes = await joinRoom(cleanCode);
      if (!joinRes.success) {
        setError(joinRes.error || `Room "${cleanCode}" could not be found or is unavailable.`);
        setIsJoining(false);
        return;
      }

      onClose();
      navigate(`/room/${cleanCode}`);
    } catch (err: any) {
      setError(err?.message || `Unable to join room "${cleanCode}".`);
      setIsJoining(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Join Room"
      description="Enter the room code shared by your friend or partner."
      maxWidth="md"
    >
      <form onSubmit={handleJoin} className="flex flex-col gap-5 pt-1">
        <div>
          <label className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-1.5 block">
            Room Code
          </label>
          <Input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase().slice(0, 8));
              if (error) setError('');
            }}
            placeholder="e.g. LOVE22"
            className="text-center font-mono text-xl tracking-widest uppercase font-bold"
            maxLength={8}
            error={error}
            autoFocus
            required
            disabled={isJoining}
          />
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isJoining}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isJoining}
            disabled={isJoining || !code.trim()}
            leftIcon={<LogIn className="w-4 h-4" />}
          >
            {isJoining ? 'Joining...' : 'Join Room'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
