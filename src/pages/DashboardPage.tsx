import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, LogIn } from 'lucide-react';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { DashboardRoomActions } from '../components/dashboard/DashboardRoomActions';
import { RecentlyPlayedSection } from '../components/dashboard/RecentlyPlayedSection';
import { ModeSelector } from '../components/dashboard/ModeSelector';
import { GameLibrary } from '../components/dashboard/GameLibrary';
import { GameDetailModal } from '../components/dashboard/GameDetailModal';
import { Phase2PreviewModal } from '../components/dashboard/Phase2PreviewModal';
import { Button } from '../components/ui/Button';
import { LoadingIndicator } from '../components/ui/LoadingIndicator';
import { Footer } from '../components/navigation/Footer';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { GameItem } from '../types/game';

export const DashboardPage: React.FC = () => {
  const { user, isAuthenticated, isLoading, setDevUser } = useAuth();
  const { addToast } = useToast();

  const [activeMode, setActiveMode] = useState<'couple' | 'friend'>(
    () => user?.preferredMode || 'couple'
  );
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [targetRoomGame, setTargetRoomGame] = useState<GameItem | null>(null);

  const handleSelectMode = (mode: 'couple' | 'friend') => {
    setActiveMode(mode);
    setDevUser(mode);
    addToast(`${mode === 'couple' ? 'Couple Mode (2P)' : 'Friend Mode (Up to 4P)'} selected!`, {
      type: 'success',
      message: 'Game library filtered for this experience.',
    });
  };

  const handleOpenRoomModal = (mode?: 'couple' | 'friend') => {
    if (mode) setActiveMode(mode);
    setTargetRoomGame(null);
    setRoomModalOpen(true);
  };

  const handleLaunchGamePhase2 = (game: GameItem) => {
    setSelectedGame(null);
    setTargetRoomGame(game);
    setRoomModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FCFAFF]">
        <LoadingIndicator label="Initializing player dashboard..." size="lg" />
      </div>
    );
  }

  // Missing session state with honest dev mock bypass
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center px-4 py-16 bg-[#FCFAFF]">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[#EAE3F3] shadow-lg p-8 text-center flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#F1EAFF] text-[#593B91] flex items-center justify-center">
            <LogIn className="w-7 h-7 text-[#9670E8]" />
          </div>
          <h2 className="text-2xl font-bold text-[#211A2D]">
            Dashboard Session Required
          </h2>
          <p className="text-sm text-[#756D82] leading-relaxed">
            You are currently signed out. You can sign in with your account or immediately launch a quick development test session.
          </p>
          <div className="flex flex-col gap-2.5 w-full pt-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => setDevUser('couple')}
              leftIcon={<Sparkles className="w-4 h-4 text-white" />}
              className="w-full font-bold"
            >
              Start Quick Dev Mock Session
            </Button>
            <Link to="/login" className="w-full">
              <Button variant="outline" size="md" className="w-full">
                Go to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      {/* Top Navigation Bar — NO PERMANENT LEFT SIDEBAR */}
      <DashboardHeader
        activeMode={activeMode}
        onModeChange={handleSelectMode}
      />

      {/* Spacious Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
        {/* Primary Room Hub Actions: Create & Join */}
        <DashboardRoomActions
          activeMode={activeMode}
          onModeChange={handleSelectMode}
        />

        {/* Recently Played Section (Clear Mock Data) */}
        <RecentlyPlayedSection />

        {/* Mode Selection Cards */}
        <ModeSelector
          activeMode={activeMode}
          onSelectMode={handleSelectMode}
          onOpenRoomModal={(mode) => handleOpenRoomModal(mode)}
        />

        {/* 11 Games Library Grid */}
        <GameLibrary
          activeMode={activeMode}
          onSelectGame={(game) => setSelectedGame(game)}
        />
      </main>

      {/* Game Rules / Detail Modal */}
      <GameDetailModal
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
        onLaunchPhase2={handleLaunchGamePhase2}
      />

      {/* Phase 2 Preview & Room Modal */}
      <Phase2PreviewModal
        isOpen={roomModalOpen}
        onClose={() => setRoomModalOpen(false)}
        selectedGame={targetRoomGame}
        mode={activeMode}
      />

      <Footer />
    </div>
  );
};
