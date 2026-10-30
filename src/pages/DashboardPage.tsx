import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardRoomActions } from '../components/dashboard/DashboardRoomActions';
import { RecentlyPlayedSection } from '../components/dashboard/RecentlyPlayedSection';
import { ModeSelector } from '../components/dashboard/ModeSelector';
import { GameLibrary } from '../components/dashboard/GameLibrary';
import { GameDetailModal } from '../components/dashboard/GameDetailModal';
import { CreateRoomModal } from '../components/modals/CreateRoomModal';
import { Button } from '../components/ui/Button';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { Footer } from '../components/navigation/Footer';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { GameItem } from '../types/game';

export const DashboardPage: React.FC = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { addToast } = useToast();

  const [activeMode, setActiveMode] = useState<'couple' | 'friend'>(
    () => user?.preferredMode || 'couple'
  );
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [targetRoomGame, setTargetRoomGame] = useState<GameItem | null>(null);

  const handleSelectMode = (mode: 'couple' | 'friend') => {
    setActiveMode(mode);
    addToast(`${mode === 'couple' ? 'Couple Mode (2P)' : 'Friend Mode (2–4P)'} selected.`, {
      type: 'info',
      message: 'The game library is filtered for this experience.',
    });
  };

  const handleOpenRoomModal = (mode?: 'couple' | 'friend') => {
    if (mode) setActiveMode(mode);
    setTargetRoomGame(null);
    setRoomModalOpen(true);
  };

  const handleLaunchGame = (game: GameItem) => {
    setSelectedGame(null);
    setTargetRoomGame(game);
    setRoomModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FCFAFF]">
        <LoadingIndicator label="Loading your PlaySpace dashboard..." size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 py-16 bg-[#FCFAFF]">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#EAE3F3] shadow-lg p-8 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F1EAFF] text-[#593B91] flex items-center justify-center">
            <LogIn className="w-7 h-7 text-[#9670E8]" />
          </div>
          <h2 className="text-2xl font-bold text-[#211A2D]">Sign in to PlaySpace</h2>
          <p className="text-sm text-[#756D82] leading-relaxed">
            Sign in to create a room, join friends and continue your matches.
          </p>
          <Link to="/login" className="w-full">
            <Button variant="primary" size="md" className="w-full font-bold">
              Go to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <DashboardHeader activeMode={activeMode} onModeChange={handleSelectMode} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
        <DashboardRoomActions activeMode={activeMode} onModeChange={handleSelectMode} />
        <RecentlyPlayedSection />
        <ModeSelector
          activeMode={activeMode}
          onSelectMode={handleSelectMode}
          onOpenRoomModal={handleOpenRoomModal}
        />
        <GameLibrary
          activeMode={activeMode}
          onSelectGame={(game) => setSelectedGame(game)}
        />
      </main>

      <GameDetailModal
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
        onLaunchPhase2={handleLaunchGame}
      />

      <CreateRoomModal
        isOpen={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        initialGame={targetRoomGame}
        initialMode={activeMode}
      />

      <Footer />
    </div>
  );
};
