import React, { useState } from 'react';
import { Play, RotateCcw, BookOpen, LogOut, AlertTriangle } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface GamePauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onOpenRules: () => void;
  onExitLobby: () => void;
  gameName: string;
}

export const GamePauseModal: React.FC<GamePauseModalProps> = ({
  isOpen,
  onResume,
  onRestart,
  onOpenRules,
  onExitLobby,
  gameName,
}) => {
  const [confirmExit, setConfirmExit] = useState(false);

  const handleClose = () => {
    setConfirmExit(false);
    onResume();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={confirmExit ? 'Exit to Lobby?' : 'Game Paused'}
      description={confirmExit ? 'Current match progress will be lost.' : gameName}
      maxWidth="sm"
    >
      <div className="flex flex-col gap-3 pt-2">
        {!confirmExit ? (
          <>
            <Button
              variant="primary"
              size="md"
              onClick={onResume}
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              className="w-full justify-center font-bold"
            >
              Resume Game
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={onRestart}
              leftIcon={<RotateCcw className="w-4 h-4" />}
              className="w-full justify-center font-bold"
            >
              Restart Match
            </Button>

            <Button
              variant="outline"
              size="md"
              onClick={onOpenRules}
              leftIcon={<BookOpen className="w-4 h-4" />}
              className="w-full justify-center"
            >
              Game Instructions
            </Button>

            <div className="pt-2 border-t border-[#EAE3F3]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmExit(true)}
                leftIcon={<LogOut className="w-4 h-4 text-[#D94C65]" />}
                className="w-full justify-center text-[#D94C65] hover:bg-[#FDF2F4]"
              >
                Exit to Room Lobby
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="p-3.5 rounded-xl bg-[#FDF0F2] border border-[#F8D2D9] flex items-center gap-2.5 text-xs text-[#D94C65]">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>
                Are you sure you want to exit? You will return to the room lobby with all participants.
              </span>
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmExit(false)}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={onExitLobby}>
                Confirm Exit
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
