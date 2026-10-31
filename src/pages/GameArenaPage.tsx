import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { getGameById } from '../data/games/registry';
import { GameHeader } from '../components/game-ui/GameHeader';
import { GameInstructionsModal } from '../components/game-ui/GameInstructionsModal';
import { GamePauseModal } from '../components/game-ui/GamePauseModal';
import { GameResultsModal, type PlayerScoreSummary } from '../components/game-ui/GameResultsModal';
import { Button } from '../components/ui/Button';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { GameSessionProvider } from '../features/games/runtime/GameSessionProvider';
import { useGameSession } from '../features/games/runtime/useGameSession';
import { api } from '../services/api';

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

interface GameArenaContentProps {
  game: ReturnType<typeof getGameById>;
  roomCode?: string;
  gameKey: number;
  onRematchLocal: () => void;
  onReplaceSession: (sessionId: string) => void;
  onReturnToLobby: () => void;
}

const GameArenaContent: React.FC<GameArenaContentProps> = ({
  game,
  roomCode,
  gameKey,
  onRematchLocal,
  onReplaceSession,
  onReturnToLobby,
}) => {
  const session = useGameSession();
  const { user } = useAuth();
  const { currentRoom } = useRoom();

  const [localPaused, setLocalPaused] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [matchResults, setMatchResults] = useState<{
    winnerName?: string;
    playerScores: PlayerScoreSummary[];
  } | null>(null);
  const [rematchError, setRematchError] = useState<string | null>(null);

  // Authoritative pause synchronization
  const isPaused = session ? session.isPaused : localPaused;

  // Both participants switch to the new authoritative session when the host
  // successfully creates a rematch on the previous session channel. The guard
  // makes this transition idempotent even if a parent callback is recreated.
  const handledReplacementSessionRef = useRef<string | null>(null);
  useEffect(() => {
    const nextSessionId = session?.replacementSessionId;
    if (!nextSessionId || handledReplacementSessionRef.current === nextSessionId) return;
    handledReplacementSessionRef.current = nextSessionId;
    onReplaceSession(nextSessionId);
  }, [session?.replacementSessionId, onReplaceSession]);

  // Authoritative completion listener
  useEffect(() => {
    if (session?.sessionStatus === 'COMPLETED' && !showResults) {
      const winner = session.participants.find((p) => p.userId === session.winnerUserId);
      const playerScores: PlayerScoreSummary[] = session.participants.map((p) => ({
        playerId: p.userId,
        name: p.name,
        avatarInitials: p.name.substring(0, 2).toUpperCase(),
        avatarColor: 'bg-[#9670E8]',
        score: session.scores[p.userId] || 0,
        isWinner: p.userId === session.winnerUserId,
      }));

      setMatchResults({
        winnerName: winner ? winner.name : 'Tie / Cooperative Result',
        playerScores,
      });
      setShowResults(true);
    }
  }, [session?.sessionStatus, session?.winnerUserId, session?.participants, session?.scores, showResults]);

  if (!game) return null;

  // A room-backed arena must never silently fall back to the local pass-and-play
  // implementation while its authoritative session is loading or unavailable.
  if (session?.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-[#9670E8] animate-spin mb-4" />
        <h2 className="text-lg font-bold text-[#211A2D]">Connecting to Multiplayer Session</h2>
        <p className="text-xs text-[#756D82] mt-1">Loading the latest server-authoritative game state</p>
      </div>
    );
  }

  if (session?.error || (!session && roomCode)) {
    return (
      <div className="min-h-screen bg-[#FCFAFF] flex items-center justify-center p-4">
        <div className="max-w-md rounded-3xl border border-[#EAE3F3] bg-white p-8 text-center shadow-xl">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-xl font-bold text-[#211A2D]">Multiplayer Session Unavailable</h2>
          <p className="mt-2 text-sm text-[#756D82]">
            {session?.error || 'This room does not have an active game session connected to this arena.'}
          </p>
          <Button variant="primary" onClick={onReturnToLobby} className="mt-5">
            Return to Room Lobby
          </Button>
        </div>
      </div>
    );
  }

  // Resolve participants from session or current room
  const participants =
    session && session.participants.length > 0
      ? session.participants.map((p, idx) => ({
          id: p.userId,
          name: p.name,
          avatarInitials: p.name.substring(0, 2).toUpperCase(),
          avatarColor:
            idx === 0
              ? 'bg-[#9670E8]'
              : idx === 1
              ? 'bg-[#D94C65]'
              : idx === 2
              ? 'bg-[#06B6D4]'
              : 'bg-[#EAB308]',
        }))
      : currentRoom?.participants && currentRoom.participants.length > 0
      ? currentRoom.participants.map((p) => ({
          id: p.id,
          name: p.name,
          avatarInitials: p.avatarInitials,
          avatarColor: p.avatarColor,
        }))
      : [
          { id: user?.id || 'p1', name: user?.name || 'You', avatarInitials: 'ME', avatarColor: 'bg-[#9670E8]' },
          { id: 'p2', name: 'Partner', avatarInitials: 'PT', avatarColor: 'bg-[#D94C65]' },
        ];

  const handleFinishMatch = (results: {
    winnerName?: string;
    playerScores: PlayerScoreSummary[];
  }) => {
    setMatchResults(results);
    setShowResults(true);
  };

  const handleRematch = async () => {
    setRematchError(null);
    if (session) {
      const result = await session.requestRematch();
      if (!result.success) {
        setRematchError(result.error || 'Unable to start rematch.');
        return;
      }
    } else {
      onRematchLocal();
    }
    setShowResults(false);
    setMatchResults(null);
  };

  const handleTogglePause = () => {
    if (session) {
      session.togglePause();
    } else {
      setLocalPaused(!localPaused);
    }
  };

  const renderGameComponent = () => {
    const commonProps = {
      key: gameKey,
      players: participants,
      onFinishMatch: handleFinishMatch,
      isPaused,
      sessionState: session?.publicState,
      sessionPrivateState: session?.privateState,
      onSendAction: session?.sendAction,
      currentUserId: user?.id,
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
      <GameHeader
        game={game}
        roomCode={roomCode || 'MATCH'}
        mode={currentRoom?.mode || (game.modes.includes('friend') ? 'friend' : 'couple')}
        onPause={handleTogglePause}
        onOpenRules={() => setShowInstructions(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {renderGameComponent()}
      </main>

      {rematchError && (
        <div role="alert" className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700 shadow-lg">
          {rematchError}
        </div>
      )}

      <GameInstructionsModal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        game={game}
      />

      <GamePauseModal
        isOpen={isPaused}
        onResume={handleTogglePause}
        onRestart={handleRematch}
        onOpenRules={() => setShowInstructions(true)}
        onExitLobby={onReturnToLobby}
        gameName={game.name}
      />

      <GameResultsModal
        isOpen={showResults}
        gameName={game.name}
        winnerName={matchResults?.winnerName}
        playerScores={matchResults?.playerScores || []}
        onRematch={handleRematch}
        onReturnToLobby={onReturnToLobby}
      />
    </div>
  );
};

export const GameArenaPage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentRoom } = useRoom();
  const { user } = useAuth();

  const game = gameId ? getGameById(gameId) : undefined;
  const roomCode = searchParams.get('room') || currentRoom?.code;
  const urlSessionId = searchParams.get('session');

  const [activeSessionId, setActiveSessionId] = useState<string | null>(urlSessionId);
  const [isInitializing, setIsInitializing] = useState<boolean>(!urlSessionId && !!roomCode);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [gameKey, setGameKey] = useState(0);

  // Prefer the room's existing active session. Only the host may create a new
  // session, so a guest opening a URL without a session ID cannot accidentally
  // attempt to create a second session.
  useEffect(() => {
    if (activeSessionId || !roomCode || !game) return;

    let mounted = true;

    const initializeSession = async () => {
      setIsInitializing(true);
      setInitializationError(null);

      try {
        let roomSnapshot: any =
          currentRoom?.code === roomCode ? currentRoom : null;

        if (!roomSnapshot?.activeSessionId) {
          const latestSnapshot = await api.rooms.getByCode(roomCode);
          roomSnapshot = latestSnapshot.room || latestSnapshot;
        }

        if (!mounted) return;

        const existingSessionId = roomSnapshot?.activeSessionId;
        if (existingSessionId) {
          setActiveSessionId(existingSessionId);
          setSearchParams({ room: roomCode, session: existingSessionId });
          setIsInitializing(false);
          return;
        }

        if (!roomSnapshot?.id || roomSnapshot.hostId !== user?.id) {
          throw new Error('The room host has not started this game session yet.');
        }

        if (roomSnapshot.selectedGameId && roomSnapshot.selectedGameId !== game.id) {
          throw new Error('This room has selected a different game. Return to the lobby.');
        }

        const response = await api.games.start(roomSnapshot.id, game.id);
        if (!mounted) return;

        setActiveSessionId(response.sessionId);
        setSearchParams({ room: roomCode, session: response.sessionId });
        setIsInitializing(false);
      } catch (err: any) {
        if (!mounted) return;
        const message = err?.message || 'Unable to initialize the multiplayer session.';
        console.warn('[GameArena] Session initialization failed:', message);
        setInitializationError(message);
        setIsInitializing(false);
      }
    };

    void initializeSession();

    return () => {
      mounted = false;
    };
  }, [activeSessionId, roomCode, currentRoom, game, user?.id, setSearchParams]);

  const handleReturnToLobby = () => {
    if (roomCode) {
      navigate(`/room/${roomCode}`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleReplaceSession = useCallback((nextSessionId: string) => {
    setActiveSessionId((current) => current === nextSessionId ? current : nextSessionId);
    setSearchParams((previous) => {
      if (
        previous.get('session') === nextSessionId &&
        previous.get('room') === (roomCode || '')
      ) {
        return previous;
      }
      const next = new URLSearchParams(previous);
      if (roomCode) next.set('room', roomCode);
      else next.delete('room');
      next.set('session', nextSessionId);
      return next;
    });
    setGameKey((key) => key + 1);
  }, [roomCode, setSearchParams]);

  if (initializationError) {
    return (
      <div className="min-h-screen bg-[#FCFAFF] flex items-center justify-center p-4">
        <div className="max-w-md rounded-3xl border border-[#EAE3F3] bg-white p-8 text-center shadow-xl">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
          <h2 className="mt-4 text-xl font-bold text-[#211A2D]">Unable to open multiplayer session</h2>
          <p className="mt-2 text-sm text-[#756D82]">{initializationError}</p>
          <Button variant="primary" onClick={handleReturnToLobby} className="mt-5">
            Return to Room Lobby
          </Button>
        </div>
      </div>
    );
  }

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

  // Require room or session - No fake DEMO fallback in production flow
  if (!roomCode && !activeSessionId) {
    return (
      <div className="min-h-screen bg-[#FCFAFF] flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl border border-[#E3D6FA] shadow-xl max-w-md text-center flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-[#9670E8]" />
          <h2 className="text-xl font-bold text-[#211A2D]">Session Required</h2>
          <p className="text-xs text-[#756D82] leading-relaxed">
            Multiplayer matches in Better-Half require an active room and session. Direct navigation without a lobby session is not permitted.
          </p>
          <Button
            variant="primary"
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 w-full justify-center"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
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

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#FCFAFF] flex flex-col items-center justify-center p-6">
        <Loader2 className="w-10 h-10 text-[#9670E8] animate-spin mb-4" />
        <h2 className="text-lg font-bold text-[#211A2D]">Initializing Game Session...</h2>
        <p className="text-xs text-[#756D82] mt-1">Synchronizing live multiplayer arena</p>
      </div>
    );
  }

  if (activeSessionId) {
    return (
      <GameSessionProvider key={activeSessionId} sessionId={activeSessionId} initialGameId={game.id}>
        <GameArenaContent
          game={game}
          roomCode={roomCode}
          gameKey={gameKey}
          onRematchLocal={() => setGameKey((k) => k + 1)}
          onReplaceSession={handleReplaceSession}
          onReturnToLobby={handleReturnToLobby}
        />
      </GameSessionProvider>
    );
  }

  return (
    <GameArenaContent
      game={game}
      roomCode={roomCode}
      gameKey={gameKey}
      onRematchLocal={() => setGameKey((k) => k + 1)}
      onReplaceSession={() => undefined}
      onReturnToLobby={handleReturnToLobby}
    />
  );
};
