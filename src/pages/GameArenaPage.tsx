import React, { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { getGameById } from '../data/games/registry';
import { GameHeader } from '../components/game-ui/GameHeader';
import { GameInstructionsModal } from '../components/game-ui/GameInstructionsModal';
import { GamePauseModal } from '../components/game-ui/GamePauseModal';
import { GameResultsModal, type PlayerScoreSummary } from '../components/game-ui/GameResultsModal';
import { Button } from '../components/ui/Button';
import { AlertCircle, ArrowLeft } from 'lucide-react';

// Game Module Imports
import { TruthOrDareGame } from '../features/games/truth-or-dare/TruthOrDareGame';
import { WouldYouRatherGame } from '../features/games/would-you-rather/WouldYouRatherGame';
import { BlindRankingGame } from '../features/games/blind-ranking/BlindRankingGame';
import { OriginalCardGame } from '../features/games/original-card-game/OriginalCardGame';
import { TicTacToeGame } from '../features/games/tic-tac-toe/TicTacToeGame';
import { PenFightGame } from '../features/games/pen-fight/PenFightGame';
import { KabzaGame } from '../features/games/kabza/KabzaGame';
import { BasketballRivalryGame } from '../features/games/basketball-rivalry/BasketballRivalryGame';
import { SnatchTheFriesGame } from '../features/games/snatch-the-fries/SnatchTheFriesGame';
import { AlooGolfGame } from '../features/games/aloo-golf/AlooGolfGame';
import { BetweenUsGame } from '../features/games/between-us/BetweenUsGame';

export const GameArenaPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentRoom } = useRoom();

  const game = gameId ? getGameById(gameId) : undefined;
  const roomCode = searchParams.get('room') || currentRoom?.code || 'DEMO';

  // Modal controls
  const [isPaused, setIsPaused] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [matchResults, setMatchResults] = useState<{
    winnerName?: string;
    playerScores: PlayerScoreSummary[];
  } | null>(null);

  // Rematch key to force component recreation
  const [gameKey, setGameKey] = useState(0);

  // Derive players from room context or fall back to demo participants
  const participants = currentRoom?.participants && currentRoom.participants.length > 0
    ? currentRoom.participants.map((p) => ({
        id: p.id,
        name: p.name,
        avatarInitials: p.avatarInitials,
        avatarColor: p.avatarColor,
      }))
    : game?.modes.includes('couple') && !game.modes.includes('friend')
    ? [
        { id: 'p1', name: 'Alex (You)', avatarInitials: 'AY', avatarColor: 'bg-primary-500' },
        { id: 'p2', name: 'Jordan', avatarInitials: 'JD', avatarColor: 'bg-rose-500' },
      ]
    : [
        { id: 'p1', name: 'Alex (You)', avatarInitials: 'AY', avatarColor: 'bg-primary-500' },
        { id: 'p2', name: 'Taylor', avatarInitials: 'TY', avatarColor: 'bg-secondary-500' },
        { id: 'p3', name: 'Sam', avatarInitials: 'SM', avatarColor: 'bg-cyan-500' },
        { id: 'p4', name: 'Morgan', avatarInitials: 'MG', avatarColor: 'bg-amber-500' },
      ];

  // Callback when any game completes
  const handleFinishMatch = (results: {
    winnerName?: string;
    playerScores: PlayerScoreSummary[];
  }) => {
    setMatchResults(results);
    setShowResults(true);
  };

  const handleRematch = () => {
    setShowResults(false);
    setMatchResults(null);
    setGameKey((k) => k + 1);
  };

  const handleReturnToLobby = () => {
    if (roomCode && roomCode !== 'DEMO') {
      navigate(`/room/${roomCode}`);
    } else {
      navigate('/dashboard');
    }
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-red-200 shadow-xl max-w-md text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900">Game Not Found</h2>
          <p className="text-xs text-gray-600">
            The requested game module "{gameId}" does not exist in the active registry.
          </p>
          <Button onClick={() => navigate('/dashboard')} className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Enforce mode restriction: Couple-only games cannot launch in Friend Mode rooms
  if (currentRoom && currentRoom.mode === 'friend' && !game.modes.includes('friend')) {
    return (
      <div className="min-h-screen bg-[#FCFAFF] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-[#FDE68A] shadow-xl max-w-md text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-[#D97706]" />
          <h2 className="text-xl font-bold text-[#211A2D]">Mode Restriction</h2>
          <p className="text-xs text-[#756D82] leading-relaxed">
            "{game.name}" is an intimate Couple-exclusive game and cannot be launched in Friend Mode (Room #{currentRoom.code}).
          </p>
          <Button
            variant="primary"
            onClick={handleReturnToLobby}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Room Lobby
          </Button>
        </div>
      </div>
    );
  }

  // Render game module component
  const renderGameComponent = () => {
    const commonProps = {
      key: gameKey,
      players: participants,
      onFinishMatch: handleFinishMatch,
      isPaused,
    };

    switch (game.id) {
      case 'truth-or-dare':
        return <TruthOrDareGame {...commonProps} />;
      case 'would-you-rather':
        return <WouldYouRatherGame {...commonProps} />;
      case 'blind-ranking':
        return <BlindRankingGame {...commonProps} />;
      case 'uno-style':
      case 'original-card-game':
        return <OriginalCardGame {...commonProps} />;
      case 'tic-tac-toe':
        return <TicTacToeGame {...commonProps} />;
      case 'pen-fight':
        return <PenFightGame {...commonProps} />;
      case 'kabza':
        return <KabzaGame {...commonProps} />;
      case 'basketball-rivalry':
        return <BasketballRivalryGame {...commonProps} />;
      case 'snatch-the-fries':
        return <SnatchTheFriesGame {...commonProps} />;
      case 'aloo-golf':
        return <AlooGolfGame {...commonProps} />;
      case 'between-us':
        return <BetweenUsGame {...commonProps} />;
      default:
        return (
          <div className="p-8 text-center text-gray-500">
            Module under initialization...
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 flex flex-col">
      {/* Universal Game Header Bar */}
      <GameHeader
        game={game}
        roomCode={roomCode}
        mode={currentRoom?.mode || (game.modes.includes('friend') ? 'friend' : 'couple')}
        onPause={() => setIsPaused(!isPaused)}
        onOpenRules={() => setShowInstructions(true)}
      />

      {/* Main Arena Playing Surface */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {renderGameComponent()}
      </main>

      {/* Instructions Modal */}
      <GameInstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        game={game}
      />

      {/* Pause Menu Modal */}
      <GamePauseModal
        isOpen={isPaused}
        onResume={() => setIsPaused(false)}
        onRestart={() => {
          setIsPaused(false);
          setGameKey((k) => k + 1);
        }}
        onOpenRules={() => {
          setShowInstructions(true);
        }}
        onExitLobby={handleReturnToLobby}
        gameName={game.name}
      />

      {/* Match Results Podium Modal */}
      <GameResultsModal
        isOpen={showResults}
        gameName={game.name}
        winnerName={matchResults?.winnerName}
        playerScores={matchResults?.playerScores || []}
        onRematch={handleRematch}
        onReturnToLobby={handleReturnToLobby}
      />
    </div>
  );
};
