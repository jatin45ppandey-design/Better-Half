import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart,
  Users,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { GAMES_DATA } from '../../data/games';
import { useAuth } from '../../context/AuthContext';
import { useRoom } from '../../context/RoomContext';
import { useGameCatalog } from '../../context/GameCatalogContext';
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
  const { createRoom } = useRoom();
  const { isLoading: catalogLoading, error: catalogError, refreshCatalog, isAvailable } = useGameCatalog();
  const navigate = useNavigate();

  const [selectedMode, setSelectedMode] = useState<'couple' | 'friend'>(initialMode);
  const [roomName, setRoomName] = useState('');
  const [selectedGameId, setSelectedGameId] = useState<string>(
    initialGame
      ? initialGame.id
      : initialMode === 'couple'
      ? 'between-us'
      : 'uno-style'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedMode(initialMode);
      setRoomName(
        user?.name ? `${user.name.split(' ')[0]}'s Room` : 'Game Room'
      );
      if (initialGame) {
        setSelectedGameId(initialGame.id);
      } else {
        setSelectedGameId(initialMode === 'couple' ? 'between-us' : 'uno-style');
      }
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [initialMode, initialGame, isOpen, user?.name]);

  const handleClose = () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    onClose();
  };

  const availableGames = useMemo(
    () => GAMES_DATA.filter((game) => game.modes.includes(selectedMode) && isAvailable(game.id, selectedMode)),
    [selectedMode, isAvailable]
  );

  useEffect(() => {
    if (!isOpen || catalogLoading || catalogError) return;
    if (!availableGames.some((game) => game.id === selectedGameId)) {
      setSelectedGameId(availableGames[0]?.id || '');
    }
  }, [isOpen, catalogLoading, catalogError, availableGames, selectedGameId]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    if (catalogLoading || catalogError || !isAvailable(selectedGameId, selectedMode)) {
      setErrorMessage(catalogError || 'This game is not currently available in the selected mode. Refresh availability and choose another game.');
      setIsSubmitting(false);
      return;
    }

    try {
      const created = await createRoom({
        name: roomName.trim() || (selectedMode === 'couple' ? 'Couple Room' : 'Friend Room'),
        mode: selectedMode,
        selectedGameId,
      });

      onClose();
      navigate(`/room/${created.code}`);
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Could not create room. Please verify your connection and try again.'
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Create Room"
      description="Select an experience mode and opening game to get started."
      maxWidth="lg"
    >
      <form onSubmit={handleCreateRoom} className="flex flex-col gap-5 pt-1">
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-[#FDF0F2] border border-[#F8D2D9] flex items-center gap-2.5 text-xs text-[#D94C65]">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

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
                const currentGame = GAMES_DATA.find((item) => item.id === selectedGameId);
                if (!currentGame || !isAvailable(currentGame.id, 'couple')) {
                  const fallback = GAMES_DATA.find((item) => item.modes.includes('couple') && isAvailable(item.id, 'couple'));
                  setSelectedGameId(fallback?.id || '');
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
                const currentGame = GAMES_DATA.find((item) => item.id === selectedGameId);
                if (!currentGame || !isAvailable(currentGame.id, 'friend')) {
                  const fallback = GAMES_DATA.find((item) => item.modes.includes('friend') && isAvailable(item.id, 'friend'));
                  setSelectedGameId(fallback?.id || '');
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

          {catalogLoading ? (
            <p className="text-xs text-[#756D82] py-4">Checking live game availability…</p>
          ) : catalogError ? (
            <div className="rounded-xl border border-[#F8D2D9] bg-[#FDF0F2] p-3 flex items-center justify-between gap-3">
              <p className="text-xs text-[#A52E45]">{catalogError}</p>
              <button type="button" onClick={() => void refreshCatalog()} className="text-xs font-bold text-[#593B91] underline">Retry</button>
            </div>
          ) : availableGames.length === 0 ? (
            <p className="text-xs text-[#A52E45] py-4">No games are enabled for this mode right now.</p>
          ) : (
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
          )}
        </div>

        {/* Actions */}
        <div className="pt-2 border-t border-[#EAE3F3] flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isSubmitting || catalogLoading || Boolean(catalogError) || !availableGames.some((game) => game.id === selectedGameId)}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            {isSubmitting ? 'Creating Room...' : 'Create Room'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
