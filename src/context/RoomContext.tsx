import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { RoomSession, RoomParticipant, ChatMessage } from '../types/game';
import { isGameEligibleForMode } from '../data/games/registry';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import { api } from '../services/api';
import { socketService } from '../services/socket';

interface CreateRoomParams {
  name: string;
  mode: 'couple' | 'friend';
  selectedGameId: string;
}

interface RoomContextType {
  currentRoom: RoomSession | null;
  allRooms: Record<string, RoomSession>;
  isRoomLoading: boolean;
  roomError: string | null;
  createRoom: (params: CreateRoomParams) => Promise<RoomSession>;
  joinRoom: (code: string) => Promise<{ success: boolean; error?: string; room?: RoomSession }>;
  leaveRoom: () => Promise<void>;
  getRoomByCode: (code: string) => RoomSession | undefined;
  fetchRoom: (code: string) => Promise<RoomSession | null>;
  toggleReady: (participantId?: string) => Promise<void>;
  setRoomGame: (gameId: string) => Promise<{ success: boolean; error?: string }>;
  voteForGame: (gameId: string) => Promise<void>;
  sendChatMessage: (text: string) => void;
  sendEmojiReaction: (emoji: string) => void;
  setRoomStatus: (status: 'lobby' | 'playing' | 'results') => void;
  canStartGame: () => { canStart: boolean; reason?: string };
  refreshCurrentRoom: () => Promise<void>;
}

function formatSnapshotToRoomSession(snapshot: any): RoomSession {
  return {
    id: snapshot.id,
    code: snapshot.code,
    name: snapshot.name,
    mode: (snapshot.mode || 'couple').toLowerCase() as 'couple' | 'friend',
    maxPlayers: snapshot.maxPlayers || (snapshot.mode?.toLowerCase() === 'couple' ? 2 : 4),
    selectedGameId:
      snapshot.selectedGameId ||
      (snapshot.mode?.toLowerCase() === 'couple' ? 'between-us' : 'uno-style'),
    hostId: snapshot.hostId,
    hostName: snapshot.hostName || snapshot.host?.displayName || 'Host',
    participants: (snapshot.participants || []).map((p: any) => ({
      id: p.userId || p.id,
      name: p.displayName || p.name || 'Player',
      avatarInitials:
        p.avatarInitials ||
        (p.displayName || p.name
          ? (p.displayName || p.name).substring(0, 2).toUpperCase()
          : 'PL'),
      avatarColor: p.avatarColor || 'bg-[#9670E8]',
      isHost:
        p.role === 'HOST' ||
        p.isHost ||
        (snapshot.hostId && (p.userId || p.id) === snapshot.hostId),
      isReady: p.isReady ?? false,
      isDemo: false,
      isOnline: p.isOnline ?? false,
    })),
    gameVotes: snapshot.gameVotes || {},
    chatMessages: (snapshot.chatMessages || snapshot.messages || []).map((m: any) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.senderName || (m.sender ? m.sender.displayName : 'System'),
      text: m.text || m.message,
      timestamp:
        m.timestamp ||
        new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: m.isSystem || m.senderId === 'system',
    })),
    status:
      snapshot.status === 'IN_PROGRESS'
        ? 'playing'
        : snapshot.status === 'COMPLETED'
        ? 'results'
        : 'lobby',
    createdAt:
      typeof snapshot.createdAt === 'string'
        ? snapshot.createdAt
        : new Date(snapshot.createdAt || Date.now()).toISOString(),
  };
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [allRooms, setAllRooms] = useState<Record<string, RoomSession>>({});
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);
  const [isRoomLoading, setIsRoomLoading] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const currentRoom = useMemo(
    () => (currentRoomCode ? allRooms[currentRoomCode] || null : null),
    [currentRoomCode, allRooms]
  );

  const getRoomByCode = useCallback(
    (code: string) => allRooms[code.toUpperCase()],
    [allRooms]
  );

  // Initialize Socket.IO connection when user is authenticated
  useEffect(() => {
    if (user) {
      socketService.connect();
    } else {
      socketService.disconnect();
    }
  }, [user]);

  // Handle Socket.IO events for active room
  useEffect(() => {
    if (!currentRoomCode) return;

    // Listen to real-time state updates
    const unsubState = socketService.on('room:state', (snapshot: any) => {
      const formatted = formatSnapshotToRoomSession(snapshot);
      setAllRooms((prev) => ({ ...prev, [formatted.code]: formatted }));
    });

    const unsubJoined = socketService.on('room:player:joined', ({ participant }: any) => {
      setAllRooms((prev) => {
        const room = prev[currentRoomCode];
        if (!room) return prev;
        const exists = room.participants.some(
          (p) => p.id === (participant.userId || participant.id)
        );
        if (exists) return prev;

        const newP: RoomParticipant = {
          id: participant.userId || participant.id,
          name: participant.displayName || participant.name || 'Player',
          avatarInitials: participant.avatarInitials || 'PL',
          avatarColor: participant.avatarColor || 'bg-[#9670E8]',
          isHost: participant.role === 'HOST' || participant.isHost,
          isReady: participant.isReady ?? false,
          isOnline: true,
        };

        return {
          ...prev,
          [currentRoomCode]: {
            ...room,
            participants: [...room.participants, newP],
          },
        };
      });
    });

    const unsubLeft = socketService.on(
      'room:player:left',
      ({ userId, newHostId, roomClosed }: any) => {
        if (roomClosed) {
          addToast('The host closed this room.', { type: 'info' });
          setCurrentRoomCode(null);
          return;
        }

        setAllRooms((prev) => {
          const room = prev[currentRoomCode];
          if (!room) return prev;
          const updatedParticipants = room.participants
            .filter((p) => p.id !== userId)
            .map((p) => (newHostId && p.id === newHostId ? { ...p, isHost: true } : p));

          return {
            ...prev,
            [currentRoomCode]: {
              ...room,
              hostId: newHostId || room.hostId,
              participants: updatedParticipants,
            },
          };
        });
      }
    );

    const unsubReady = socketService.on(
      'room:player:ready',
      ({ userId, isReady, roomStatus }: any) => {
        setAllRooms((prev) => {
          const room = prev[currentRoomCode];
          if (!room) return prev;
          const updatedParticipants = room.participants.map((p) =>
            p.id === userId ? { ...p, isReady } : p
          );

          return {
            ...prev,
            [currentRoomCode]: {
              ...room,
              status: roomStatus === 'IN_PROGRESS' ? 'playing' : room.status,
              participants: updatedParticipants,
            },
          };
        });
      }
    );

    const unsubVoted = socketService.on('room:game:voted', ({ votes }: any) => {
      setAllRooms((prev) => {
        const room = prev[currentRoomCode];
        if (!room) return prev;
        return {
          ...prev,
          [currentRoomCode]: {
            ...room,
            gameVotes: votes,
          },
        };
      });
    });

    const unsubSelected = socketService.on('room:game:selected', ({ selectedGameId }: any) => {
      setAllRooms((prev) => {
        const room = prev[currentRoomCode];
        if (!room) return prev;
        return {
          ...prev,
          [currentRoomCode]: {
            ...room,
            selectedGameId,
          },
        };
      });
    });

    const unsubChat = socketService.on('room:chat:new', (msg: any) => {
      setAllRooms((prev) => {
        const room = prev[currentRoomCode];
        if (!room) return prev;
        const newMsg: ChatMessage = {
          id: msg.id || `msg-${Date.now()}`,
          senderId: msg.senderId,
          senderName: msg.senderName,
          text: msg.text || msg.message,
          timestamp:
            msg.timestamp ||
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: msg.isSystem,
        };

        // Prevent duplicate messages
        if (room.chatMessages.some((m) => m.id === newMsg.id)) {
          return prev;
        }

        return {
          ...prev,
          [currentRoomCode]: {
            ...room,
            chatMessages: [...room.chatMessages, newMsg],
          },
        };
      });
    });

    const unsubReaction = socketService.on('room:reaction:new', ({ senderId, reaction }: any) => {
      const room = allRooms[currentRoomCode];
      const sender = room?.participants.find((p) => p.id === senderId);
      addToast(`${sender?.name || 'Player'} reacted: ${reaction}`, { type: 'info' });
    });

    const unsubPresence = socketService.on('room:presence:update', ({ onlineUserIds }: any) => {
      setAllRooms((prev) => {
        const room = prev[currentRoomCode];
        if (!room) return prev;
        const onlineSet = new Set(onlineUserIds || []);
        const updated = room.participants.map((p) => ({
          ...p,
          isOnline: onlineSet.has(p.id),
        }));
        return {
          ...prev,
          [currentRoomCode]: {
            ...room,
            participants: updated,
          },
        };
      });
    });

    const unsubLaunch = socketService.on('room:start:launch', ({ gameId }: any) => {
      addToast(`Launching ${gameId.toUpperCase()}!`, { type: 'success' });
      setAllRooms((prev) => {
        const room = prev[currentRoomCode];
        if (!room) return prev;
        return {
          ...prev,
          [currentRoomCode]: {
            ...room,
            status: 'playing',
          },
        };
      });
    });

    return () => {
      unsubState();
      unsubJoined();
      unsubLeft();
      unsubReady();
      unsubVoted();
      unsubSelected();
      unsubChat();
      unsubReaction();
      unsubPresence();
      unsubLaunch();
    };
  }, [currentRoomCode, allRooms, addToast]);

  const refreshCurrentRoom = useCallback(async () => {
    if (!currentRoomCode) return;
    try {
      const snapshot = await api.rooms.getByCode(currentRoomCode);
      const formatted = formatSnapshotToRoomSession(snapshot);
      setAllRooms((prev) => ({ ...prev, [formatted.code]: formatted }));
    } catch (err: any) {
      console.warn('Could not refresh room from server:', err);
    }
  }, [currentRoomCode]);

  const fetchRoom = useCallback(
    async (code: string): Promise<RoomSession | null> => {
      const cleanCode = code.trim().toUpperCase();
      if (!cleanCode) return null;

      try {
        const snapshot = await api.rooms.getByCode(cleanCode);
        const formatted = formatSnapshotToRoomSession(snapshot);
        setAllRooms((prev) => ({ ...prev, [formatted.code]: formatted }));
        return formatted;
      } catch {
        return null;
      }
    },
    []
  );

  const createRoom = useCallback(
    async ({ name, mode, selectedGameId }: CreateRoomParams): Promise<RoomSession> => {
      if (!user) {
        throw new Error('You must be signed in to create a multiplayer room.');
      }

      setIsRoomLoading(true);
      setRoomError(null);

      try {
        const roomName =
          name.trim() || (mode === 'couple' ? 'Cozy Couple Lounge' : 'Game Night Squad');
        const backendSnapshot = await api.rooms.create({
          name: roomName,
          mode,
          selectedGameId,
        });

        const formatted = formatSnapshotToRoomSession(backendSnapshot);
        setAllRooms((prev) => ({ ...prev, [formatted.code]: formatted }));
        setCurrentRoomCode(formatted.code);

        // Join socket channel
        socketService.emit('room:join', { roomId: formatted.id, code: formatted.code });

        return formatted;
      } catch (err: any) {
        const msg =
          err?.message || 'Failed to create multiplayer room. Please verify backend connectivity.';
        setRoomError(msg);
        throw new Error(msg);
      } finally {
        setIsRoomLoading(false);
      }
    },
    [user]
  );

  const joinRoom = useCallback(
    async (
      code: string
    ): Promise<{ success: boolean; error?: string; room?: RoomSession }> => {
      const cleanCode = code.trim().toUpperCase();

      if (!cleanCode || cleanCode.length < 4) {
        return {
          success: false,
          error: 'Please enter a valid room code.',
        };
      }

      if (!user) {
        return {
          success: false,
          error: 'You must be signed in to join a multiplayer room.',
        };
      }

      setIsRoomLoading(true);
      setRoomError(null);

      try {
        const backendSnapshot = await api.rooms.join(cleanCode);
        const snapshotData = backendSnapshot.room || backendSnapshot;
        const formatted = formatSnapshotToRoomSession(snapshotData);

        setAllRooms((prev) => ({ ...prev, [formatted.code]: formatted }));
        setCurrentRoomCode(formatted.code);

        // Join socket channel
        socketService.emit('room:join', { roomId: formatted.id, code: formatted.code });

        return { success: true, room: formatted };
      } catch (err: any) {
        const msg = err?.message || `Room "${cleanCode}" could not be found or is unavailable.`;
        setRoomError(msg);
        return {
          success: false,
          error: msg,
        };
      } finally {
        setIsRoomLoading(false);
      }
    },
    [user]
  );

  const leaveRoom = useCallback(async () => {
    if (currentRoomCode) {
      const code = currentRoomCode;
      setCurrentRoomCode(null);
      try {
        socketService.emit('room:leave', { roomId: code });
        await api.rooms.leave(code);
      } catch (err) {
        console.warn('Error notifying room leave to server:', err);
      }
    }
  }, [currentRoomCode]);

  const toggleReady = useCallback(
    async (participantId?: string) => {
      if (!currentRoom) return;
      const targetId = participantId || user?.id || currentRoom.hostId;
      const currentParticipant = currentRoom.participants.find((p) => p.id === targetId);
      const nextReady = !currentParticipant?.isReady;

      // Optimistic update
      setAllRooms((prev) => {
        const room = prev[currentRoom.code];
        if (!room) return prev;

        const updatedParticipants = room.participants.map((p) =>
          p.id === targetId ? { ...p, isReady: nextReady } : p
        );

        return {
          ...prev,
          [room.code]: {
            ...room,
            participants: updatedParticipants,
          },
        };
      });

      // Emit to socket & backend API
      socketService.emit('room:ready:update', {
        roomId: currentRoom.code,
        isReady: nextReady,
      });

      try {
        await api.rooms.toggleReady(currentRoom.code, nextReady);
      } catch (err) {
        console.warn('Failed to persist ready toggle:', err);
      }
    },
    [currentRoom, user]
  );

  const setRoomGame = useCallback(
    async (gameId: string): Promise<{ success: boolean; error?: string }> => {
      if (!currentRoom) return { success: false, error: 'No active room.' };

      if (!isGameEligibleForMode(gameId, currentRoom.mode)) {
        return {
          success: false,
          error: `This game is not permitted in ${currentRoom.mode === 'couple' ? 'Couple' : 'Friend'} Mode.`,
        };
      }

      setAllRooms((prev) => {
        const room = prev[currentRoom.code];
        if (!room) return prev;

        return {
          ...prev,
          [room.code]: {
            ...room,
            selectedGameId: gameId,
          },
        };
      });

      socketService.emit('room:game:select', { roomId: currentRoom.code, gameId });

      try {
        await api.rooms.selectGame(currentRoom.code, gameId);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to select game on server' };
      }
    },
    [currentRoom]
  );

  const voteForGame = useCallback(
    async (gameId: string) => {
      if (!currentRoom) return;
      const voterId = user?.id || currentRoom.hostId;

      setAllRooms((prev) => {
        const room = prev[currentRoom.code];
        if (!room) return prev;

        const votes = { ...room.gameVotes };
        // Remove voter from other votes
        Object.keys(votes).forEach((k) => {
          votes[k] = votes[k].filter((id) => id !== voterId);
        });

        votes[gameId] = [...(votes[gameId] || []), voterId];

        return {
          ...prev,
          [room.code]: {
            ...room,
            gameVotes: votes,
          },
        };
      });

      socketService.emit('room:game:vote', { roomId: currentRoom.code, gameId });

      try {
        await api.rooms.voteGame(currentRoom.code, gameId);
      } catch (err) {
        console.warn('Failed to persist game vote:', err);
      }
    },
    [currentRoom, user]
  );

  const sendChatMessage = useCallback(
    (text: string) => {
      if (!currentRoom || !text.trim()) return;
      const clean = text.trim();

      socketService.emit('room:chat:send', { roomId: currentRoom.code, message: clean });
    },
    [currentRoom]
  );

  const sendEmojiReaction = useCallback(
    (emoji: string) => {
      if (!currentRoom) return;
      socketService.emit('room:reaction:send', { roomId: currentRoom.code, reaction: emoji });
    },
    [currentRoom]
  );

  const setRoomStatus = useCallback(
    (status: 'lobby' | 'playing' | 'results') => {
      if (!currentRoom) return;
      setAllRooms((prev) => {
        const room = prev[currentRoom.code];
        if (!room) return prev;
        return {
          ...prev,
          [room.code]: {
            ...room,
            status,
          },
        };
      });
    },
    [currentRoom]
  );

  const canStartGame = useCallback((): { canStart: boolean; reason?: string } => {
    if (!currentRoom) return { canStart: false, reason: 'No room loaded.' };

    const { mode, participants, selectedGameId } = currentRoom;

    // Check game mode eligibility
    if (!isGameEligibleForMode(selectedGameId, mode)) {
      return {
        canStart: false,
        reason: `Selected game is not supported in ${mode === 'couple' ? 'Couple' : 'Friend'} Mode.`,
      };
    }

    // Couple Mode requires exactly 2 players
    if (mode === 'couple' && participants.length !== 2) {
      return {
        canStart: false,
        reason: `Couple Mode requires exactly 2 active players (Current: ${participants.length}).`,
      };
    }

    // Friend Mode requires at least 2 players
    if (mode === 'friend' && participants.length < 2) {
      return {
        canStart: false,
        reason: 'Friend Mode requires at least 2 players to start a match.',
      };
    }

    // Check all players ready
    const unready = participants.filter((p) => !p.isReady);
    if (unready.length > 0) {
      return {
        canStart: false,
        reason: `Waiting for all players to toggle Ready (${unready.map((u) => u.name).join(', ')} not ready).`,
      };
    }

    return { canStart: true };
  }, [currentRoom]);

  return (
    <RoomContext.Provider
      value={{
        currentRoom,
        allRooms,
        isRoomLoading,
        roomError,
        createRoom,
        joinRoom,
        leaveRoom,
        getRoomByCode,
        fetchRoom,
        toggleReady,
        setRoomGame,
        voteForGame,
        sendChatMessage,
        sendEmojiReaction,
        setRoomStatus,
        canStartGame,
        refreshCurrentRoom,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }
  return context;
};
