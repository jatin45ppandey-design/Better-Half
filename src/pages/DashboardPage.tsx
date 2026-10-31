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
    addToast(`${mode === 'couple' ? 'Couple Mode (2P)' : 'Friend Mode (2–4P)'} active.`, {
      type: 'info',
      message: 'Filtered recommendations updated.',
    });
  };

  const handleLaunchGame = (game: GameItem) => {
    setSelectedGame(null);
    setTargetRoomGame(game);
    setRoomModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0A19]">
        <LoadingIndicator label="Loading your Better-Half dashboard..." size="lg" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 py-16 bg-[#0F0A19] text-white">
        <div className="max-w-md w-full bg-[#170E28] rounded-3xl border border-[#2F1E4E] shadow-2xl p-8 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#29174A] text-[#C084FC] flex items-center justify-center border border-[#3E2568]">
            <LogIn className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold font-heading text-white">Sign in to Better-Half</h2>
          <p className="text-xs sm:text-sm text-[#A79BBF] leading-relaxed">
            Sign in to create a room, join friends and continue your multiplayer matches.
          </p>
          <Link to="/login" className="w-full mt-2">
            <Button variant="primary" size="md" className="w-full font-bold rounded-2xl">
              Go to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0F0A19] text-[#F5EEFD]">
      <DashboardHeader />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
        {/* Dynamic Welcome Hero & Fast Room Actions */}
        <DashboardRoomActions activeMode={activeMode} />

        {/* Recently Played from Real API */}
        <RecentlyPlayedSection />

        {/* ONE Unified Mode Selector */}
        <ModeSelector
          activeMode={activeMode}
          onSelectMode={handleSelectMode}
        />

        {/* ONE Unified Game Library with All 11 Games on the Same Page */}
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
        onClose={() => {
          setRoomModalOpen(false);
          setTargetRoomGame(null);
        }}
        initialMode={
          targetRoomGame
            ? targetRoomGame.modes.includes(activeMode)
              ? activeMode
              : targetRoomGame.modes[0] || 'couple'
            : activeMode
        }
        initialGame={targetRoomGame}
      />

      <Footer />
    </div>
  );
};
