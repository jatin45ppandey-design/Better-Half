import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { socketService } from '../../../services/socket';
import { api } from '../../../services/api';
import { sendGameAction } from './gameActionClient';
import {
  GameSessionContext,
  type GameParticipantInfo,
} from './useGameSession';

interface GameSessionProviderProps {
  sessionId: string;
  initialGameId?: string;
  children: React.ReactNode;
}

export const GameSessionProvider: React.FC<GameSessionProviderProps> = ({
  sessionId,
  initialGameId = '',
  children,
}) => {
  const [gameId, setGameId] = useState<string>(initialGameId);
  const [mode, setMode] = useState<'couple' | 'friend'>('couple');
  const [publicState, setPublicState] = useState<any>(null);
  const [privateState, setPrivateState] = useState<any>(null);
  const [version, setVersion] = useState<number>(1);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [winnerUserId, setWinnerUserId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [participants, setParticipants] = useState<GameParticipantInfo[]>([]);
  const [lastEvent, setLastEvent] = useState<{ type: string; payload: any } | null>(null);

  const versionRef = useRef(version);
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  // Initialize and join session over Socket.IO and REST fallback
  useEffect(() => {
    let mounted = true;

    async function initSession() {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Initial snapshot from REST
        const sessionData = await api.games.getSession(sessionId);
        if (mounted && sessionData) {
          setGameId(sessionData.gameId);
          setMode((sessionData.mode?.toLowerCase() as 'couple' | 'friend') || 'couple');
          if (sessionData.publicState) {
            setPublicState(sessionData.publicState.state || sessionData.publicState);
            setVersion(sessionData.publicState.version || 1);
            setIsPaused(!!sessionData.publicState.isPaused);
            setScores(sessionData.publicState.scores || {});
            setWinnerUserId(sessionData.publicState.winnerUserId || null);
            if (sessionData.publicState.participants) {
              setParticipants(sessionData.publicState.participants);
            }
          }
          if (sessionData.privateState) {
            setPrivateState(sessionData.privateState);
          }
        }
      } catch (err: any) {
        console.warn('[GameSession] REST snapshot fetch failed, falling back to socket:', err.message);
      }

      // 2. Connect socket and join session
      const socket = await socketService.connect();
      if (!socket || !mounted) {
        if (mounted) setIsLoading(false);
        return;
      }

      socketService.emit(
        'game:session:join',
        { sessionId },
        (res: any) => {
          if (!mounted) return;
          setIsLoading(false);
          if (!res?.success) {
            setError(res?.error || 'Failed to connect to game session.');
          } else {
            if (res.publicState) {
              setPublicState(res.publicState.state || res.publicState);
              setVersion(res.publicState.version || 1);
              setIsPaused(!!res.publicState.isPaused);
              setScores(res.publicState.scores || {});
              setWinnerUserId(res.publicState.winnerUserId || null);
              if (res.publicState.participants) {
                setParticipants(res.publicState.participants);
              }
            }
            if (res.privateState) {
              setPrivateState(res.privateState);
            }
          }
        }
      );
    }

    initSession();

    // 3. Socket event subscriptions
    const unsubState = socketService.on('game:state', (data: any) => {
      if (!mounted || !data?.publicState) return;
      const pub = data.publicState;
      setPublicState(pub.state || pub);
      setVersion(pub.version || 1);
      setIsPaused(!!pub.isPaused);
      setScores(pub.scores || {});
      setWinnerUserId(pub.winnerUserId || null);
      if (pub.participants) {
        setParticipants(pub.participants);
      }
    });

    const unsubPrivate = socketService.on('game:state:private', (data: any) => {
      if (!mounted) return;
      setPrivateState(data.privateState);
    });

    const unsubEvent = socketService.on('game:event', (evt: any) => {
      if (!mounted) return;
      setLastEvent(evt);
    });

    const unsubPaused = socketService.on('game:paused', () => {
      if (!mounted) return;
      setIsPaused(true);
    });

    const unsubResumed = socketService.on('game:resumed', () => {
      if (!mounted) return;
      setIsPaused(false);
    });

    const unsubCompleted = socketService.on('game:completed', (data: any) => {
      if (!mounted) return;
      setWinnerUserId(data.winnerUserId);
      if (data.scores) setScores(data.scores);
    });

    return () => {
      mounted = false;
      unsubState();
      unsubPrivate();
      unsubEvent();
      unsubPaused();
      unsubResumed();
      unsubCompleted();
      socketService.emit('game:session:leave', { sessionId });
    };
  }, [sessionId]);

  const sendAction = useCallback(
    async (action: any): Promise<{ success: boolean; error?: string }> => {
      const res = await sendGameAction(sessionId, versionRef.current, action);
      if (!res.success) {
        return { success: false, error: res.error || 'Action rejected.' };
      }
      return { success: true };
    },
    [sessionId]
  );

  const togglePause = useCallback(async () => {
    if (isPaused) {
      socketService.emit('game:resume', { sessionId });
    } else {
      socketService.emit('game:pause', { sessionId });
    }
  }, [isPaused, sessionId]);

  const requestRematch = useCallback(async () => {
    socketService.emit('game:rematch:request', { sessionId });
  }, [sessionId]);

  return (
    <GameSessionContext.Provider
      value={{
        sessionId,
        gameId,
        mode,
        publicState,
        privateState,
        version,
        isPaused,
        isLoading,
        error,
        winnerUserId,
        scores,
        participants,
        sendAction,
        togglePause,
        requestRematch,
        lastEvent,
      }}
    >
      {children}
    </GameSessionContext.Provider>
  );
};
