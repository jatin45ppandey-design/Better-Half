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
  const [sessionStatus, setSessionStatus] = useState<'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED'>('ACTIVE');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [winnerUserId, setWinnerUserId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [participants, setParticipants] = useState<GameParticipantInfo[]>([]);
  const [lastEvent, setLastEvent] = useState<{ type: string; payload: any } | null>(null);
  const [replacementSessionId, setReplacementSessionId] = useState<string | null>(null);

  const versionRef = useRef(version);
  useEffect(() => {
    // Never let a delayed React render move the request version backwards.
    versionRef.current = Math.max(versionRef.current, version);
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
            const initialVersion = sessionData.publicState.version || 1;
            versionRef.current = Math.max(versionRef.current, initialVersion);
            setVersion(versionRef.current);
            setIsPaused(!!sessionData.publicState.isPaused);
            setSessionStatus(sessionData.publicState.status || 'ACTIVE');
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
              const joinedVersion = res.publicState.version || 1;
              versionRef.current = Math.max(versionRef.current, joinedVersion);
              setVersion(versionRef.current);
              setIsPaused(!!res.publicState.isPaused);
              setSessionStatus(res.publicState.status || res.status || 'ACTIVE');
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
      if (pub.sessionId && pub.sessionId !== sessionId) return;
      const incomingVersion = pub.version || 1;
      if (incomingVersion < versionRef.current) return;
      versionRef.current = incomingVersion;
      setPublicState(pub.state || pub);
      setVersion(versionRef.current);
      setIsPaused(!!pub.isPaused);
      setSessionStatus(pub.status || 'ACTIVE');
      setScores(pub.scores || {});
      setWinnerUserId(pub.winnerUserId || null);
      if (pub.participants) {
        setParticipants(pub.participants);
      }
    });

    const unsubPrivate = socketService.on('game:state:private', (data: any) => {
      if (!mounted || data?.sessionId !== sessionId) return;
      setPrivateState(data.privateState);
    });

    const unsubEvent = socketService.on('game:event', (evt: any) => {
      if (!mounted || (evt?.sessionId && evt.sessionId !== sessionId)) return;
      setLastEvent(evt);
    });

    const unsubPaused = socketService.on('game:paused', (data: any) => {
      if (!mounted || data?.sessionId !== sessionId) return;
      setIsPaused(true);
      setSessionStatus('PAUSED');
    });

    const unsubResumed = socketService.on('game:resumed', (data: any) => {
      if (!mounted || data?.sessionId !== sessionId) return;
      setIsPaused(false);
      setSessionStatus('ACTIVE');
    });

    const unsubCompleted = socketService.on('game:completed', (data: any) => {
      if (!mounted || data?.sessionId !== sessionId) return;
      setWinnerUserId(data.winnerUserId ?? null);
      setSessionStatus('COMPLETED');
      if (data.scores) setScores(data.scores);
    });

    const unsubReplacement = socketService.on('game:session:started', (data: any) => {
      if (!mounted || !data?.sessionId || data.sessionId === sessionId) return;
      setReplacementSessionId(data.sessionId);
    });

    return () => {
      mounted = false;
      unsubState();
      unsubPrivate();
      unsubEvent();
      unsubPaused();
      unsubResumed();
      unsubCompleted();
      unsubReplacement();
      socketService.emit('game:session:leave', { sessionId });
    };
  }, [sessionId]);

  const actionQueueRef = useRef<Promise<void>>(Promise.resolve());

  const sendAction = useCallback(
    (action: any): Promise<{ success: boolean; error?: string }> => {
      // Serialize actions from this tab so rapid consecutive input uses the
      // version acknowledged by the previous action instead of a stale render.
      const request = actionQueueRef.current.then(async () => {
        const res = await sendGameAction(sessionId, versionRef.current, action);
        if (!res.success) {
          return { success: false, error: res.error || 'Action rejected.' };
        }
        if (typeof res.version === 'number' && Number.isFinite(res.version)) {
          versionRef.current = Math.max(versionRef.current, res.version);
          setVersion(versionRef.current);
        }
        return { success: true };
      });

      actionQueueRef.current = request.then(() => undefined, () => undefined);
      return request;
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

  const requestRematch = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socketService.emit('game:rematch:request', { sessionId }, (response: any) => {
        if (!response?.success || !response.newSessionId) {
          resolve({
            success: false,
            error: response?.error || 'The server could not start a rematch.',
          });
          return;
        }
        setReplacementSessionId(response.newSessionId);
        resolve({ success: true });
      });
    });
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
        sessionStatus,
        isLoading,
        error,
        winnerUserId,
        scores,
        participants,
        sendAction,
        togglePause,
        requestRematch,
        replacementSessionId,
        lastEvent,
      }}
    >
      {children}
    </GameSessionContext.Provider>
  );
};
