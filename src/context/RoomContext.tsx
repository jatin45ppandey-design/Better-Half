import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  leaveRoom: () => Promise<{ success: boolean; error?: string }>;
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
    activeSessionId: snapshot.activeSessionId || null,
    activeSessionStatus: snapshot.activeSessionStatus || null,
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

  const currentRoomCodeRef = useRef<string | null>(null);
  const currentRoomIdRef = useRef<string | null>(null);

  const currentRoom = useMemo(
    () => (currentRoomCode ? allRooms[currentRoomCode] || null : null),
    [currentRoomCode, allRooms]
  );

  useEffect(() => {
    currentRoomCodeRef.current = currentRoomCode;
    currentRoomIdRef.current = currentRoomCode ? allRooms[currentRoomCode]?.id || null : null;
  }, [currentRoomCode, allRooms]);

  const getRoomByCode = useCallback(
    (code: string) => allRooms[code.toUpperCase()],
    [allRooms]
  );

  // Initialize Socket.IO connection when user is authenticated, and cleanly tear down on logout
  useEffect(() => {
    if (user) {
      socketService.connect();
    } else {
      socketService.disconnect();
      setCurrentRoomCode(null);
      setAllRooms({});
      setRoomError(null);
      currentRoomCodeRef.current = null;
      currentRoomIdRef.current = null;
    }
  }, [user]);

  // Handle Socket.IO events for active room
  useEffect(() => {
    if (!currentRoomCode) return;

    // Listen to real-time state updates
    const unsubState = socketService.on('room:state', (snapshot: any) => {
      if (!snapshot) return;
      const formatted = formatSnapshotToRoomSession(snapshot);
      const activeCode = currentRoomCodeRef.current;
      const activeId = currentRoomIdRef.current;
      if (!activeCode) return;
      if (formatted.code !== activeCode && formatted.id !== activeId) return;

      setAllRooms((prev) => ({ ...prev, [formatted.code]: formatted }));
    });

    const unsubJoined = socketService.on('room:player:joined', ({ participant, roomId }: any) => {
      const activeCode = currentRoomCodeRef.current;
      const activeId = currentRoomIdRef.current;
      if (!activeCode || !participant) return;
      if (roomId && activeId && roomId !== activeId) return;

      const pId = participant.userId || participant.id;

      setAllRooms((prev) => {
        const room = prev[activeCode];
        if (!room) return prev;
        const exists = room.participants.some((p) => p.id === pId);
        if (exists) return prev;

        const newP: RoomParticipant = {
          id: pId,
          name: participant.displayName || participant.name || 'Player',
          avatarInitials:
            participant.avatarInitials ||
            (participant.displayName || participant.name
              ? (participant.displayName || participant.name).substring(0, 2).toUpperCase()
              : 'PL'),
          avatarColor: participant.avatarColor || 'bg-[#9670E8]',
          isHost: participant.role === 'HOST' || participant.isHost,
          isReady: participant.isReady ?? false,
          isOnline: true,
        };

        return {
          ...prev,
          [activeCode]: {
            ...room,
            participants: [...room.participants, newP],
          },
        };
      });
    });

    const unsubLeft = socketService.on(
      'room:player:left',
      ({ userId, newHostId, roomClosed, roomId }: any) => {
        const activeCode = currentRoomCodeRef.current;
        const activeId = currentRoomIdRef.current;
        if (!activeCode) return;
        if (roomId && activeId && roomId !== activeId) return;

        setAllRooms((prev) => {
          const room = prev[activeCode];
          if (!room) return prev;

          // If roomId wasn't provided, ensure userId belonged to this room
          const isParticipant = room.participants.some((p) => p.id === userId);
          if (!roomId && userId && !isParticipant) return prev;

          if (roomClosed) {
            // Only close if the leaving user was actually the host of this room
            if (userId && userId !== room.hostId && !isParticipant) return prev;
            addToast('The host closed this room.', { type: 'info' });
            setCurrentRoomCode(null);
            currentRoomCodeRef.current = null;
            currentRoomIdRef.current = null;
            return {};
          }

          const updatedParticipants = room.participants
            .filter((p) => p.id !== userId)
            .map((p) => (newHostId && p.id === newHostId ? { ...p, isHost: true } : p));

          return {
            ...prev,
            [activeCode]: {
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
      ({ userId, isReady, roomStatus, roomId }: any) => {
        const activeCode = currentRoomCodeRef.current;
        const activeId = currentRoomIdRef.current;
        if (!activeCode) return;
        if (roomId && activeId && roomId !== activeId) return;

        setAllRooms((prev) => {
          const room = prev[activeCode];
          if (!room) return prev;
          if (!roomId && userId && !room.participants.some((p) => p.id === userId)) return prev;

          const updatedParticipants = room.participants.map((p) =>
            p.id === userId ? { ...p, isReady } : p
          );

          return {
            ...prev,
            [activeCode]: {
              ...room,
              status: roomStatus === 'IN_PROGRESS' ? 'playing' : room.status,
              participants: updatedParticipants,
            },
          };
        });
      }
    );

    const unsubVoted = socketService.on('room:game:voted', ({ votes, roomId }: any) => {
      const activeCode = currentRoomCodeRef.current;
      const activeId = currentRoomIdRef.current;
      if (!activeCode || !votes) return;
      if (roomId && activeId && roomId !== activeId) return;

      setAllRooms((prev) => {
        const room = prev[activeCode];
        if (!room) return prev;
        return {
          ...prev,
          [activeCode]: {
            ...room,
            gameVotes: votes,
          },
        };
      });
    });

    const unsubSelected = socketService.on('room:game:selected', ({ selectedGameId, roomId }: any) => {
      const activeCode = currentRoomCodeRef.current;
      const activeId = currentRoomIdRef.current;
      if (!activeCode || !selectedGameId) return;
      if (roomId && activeId && roomId !== activeId) return;

      setAllRooms((prev) => {
        const room = prev[activeCode];
        if (!room) return prev;
        return {
          ...prev,
          [activeCode]: {
            ...room,
            selectedGameId,
          },
        };
      });
    });

    const unsubChat = socketService.on('room:chat:new', (msg: any) => {
      const activeCode = currentRoomCodeRef.current;
      const activeId = currentRoomIdRef.current;
      if (!activeCode || !msg) return;
      if (msg.roomId && activeId && msg.roomId !== activeId) return;

      setAllRooms((prev) => {
        const room = prev[activeCode];
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
          [activeCode]: {
            ...room,
            chatMessages: [...room.chatMessages, newMsg],
          },
        };
      });
    });

    const unsubReaction = socketService.on('room:reaction:new', ({ senderId, reaction, roomId }: any) => {
      const activeCode = currentRoomCodeRef.current;
      const activeId = currentRoomIdRef.current;
      if (!activeCode) return;
      if (roomId && activeId && roomId !== activeId) return;

      setAllRooms((prev) => {
        const room = prev[activeCode];
        const sender = room?.participants.find((p) => p.id === senderId);
        if (sender) {
          addToast(`${sender.name} reacted: ${reaction}`, { type: 'info' });
        }
        return prev;
      });
    });

    const unsubPresence = socketService.on('room:presence:update', ({ onlineUserIds, roomId }: any) => {
      const activeCode = currentRoomCodeRef.current;
      const activeId = currentRoomIdRef.current;
      if (!activeCode) return;
      if (roomId && activeId && roomId !== activeId) return;

      setAllRooms((prev) => {
        const room = prev[activeCode];
        if (!room) return prev;
        const onlineSet = new Set(onlineUserIds || []);
        const updated = room.participants.map((p) => ({
          ...p,
          isOnline: onlineSet.has(p.id),
        }));
        return {
          ...prev,
          [activeCode]: {
            ...room,
            participants: updated,
          },
        };
      });
    });

    const unsubLaunch = socketService.on('room:start:launch', ({ gameId, roomId }: any) => {
      const activeCode = currentRoomCodeRef.current;
      const activeId = currentRoomIdRef.current;
      if (!activeCode) return;
      if (roomId && activeId && roomId !== activeId) return;

      setAllRooms((prev) => {
        const room = prev[activeCode];
        if (!room) return prev;
        return {
          ...prev,
          [activeCode]: {
            ...room,
            selectedGameId: gameId || room.selectedGameId,
            status: 'playing',
          },
        };
      });
    });

    const unsubMembershipRevoked = socketService.on(
      'room:membership:revoked',
      ({ roomId, userId, reason }: any) => {
        if (userId !== user?.id) return;
        const activeId = currentRoomIdRef.current;
        if (roomId && activeId && activeId !== roomId) return;

        addToast(
          reason === 'KICKED'
            ? 'You were removed from this room by the host.'
            : 'You left this room on another device.',
          { type: 'info' }
        );
        setCurrentRoomCode(null);
        currentRoomCodeRef.current = null;
        currentRoomIdRef.current = null;
      }
    );

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
      unsubMembershipRevoked();
    };
  }, [currentRoomCode, user?.id, addToast]);

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
        if (currentRoomCodeRef.current) {
          const oldRoom = allRooms[currentRoomCodeRef.current];
          const oldRoomId = oldRoom?.id || currentRoomCodeRef.current;
          socketService.emit('room:leave', { roomId: oldRoomId });
        }

        const roomName =
          name.trim() || (mode === 'couple' ? 'Cozy Couple Lounge' : 'Game Night Squad');
        const backendSnapshot = await api.rooms.create({
          name: roomName,
          mode,
          selectedGameId,
        });

        const formatted = formatSnapshotToRoomSession(backendSnapshot);
        setAllRooms({ [formatted.code]: formatted });
        setCurrentRoomCode(formatted.code);

        // Join socket channel
        socketService.emit('room:join', { roomId: formatted.id, code: formatted.code }, (response) => {
          if (!response?.success) console.warn('Room socket join failed:', response?.error);
        });

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
    [user, allRooms]
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
        if (currentRoomCodeRef.current && currentRoomCodeRef.current !== cleanCode) {
          const oldRoom = allRooms[currentRoomCodeRef.current];
          const oldRoomId = oldRoom?.id || currentRoomCodeRef.current;
          socketService.emit('room:leave', { roomId: oldRoomId });
        }

        const backendSnapshot = await api.rooms.join(cleanCode);
        const snapshotData = backendSnapshot.room || backendSnapshot;
        const formatted = formatSnapshotToRoomSession(snapshotData);

        setAllRooms({ [formatted.code]: formatted });
        setCurrentRoomCode(formatted.code);

        // Join socket channel
        socketService.emit('room:join', { roomId: formatted.id, code: formatted.code }, (response) => {
          if (!response?.success) console.warn('Room socket join failed:', response?.error);
        });

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
    [user, allRooms]
  );

  const isLeavingRef = useRef(false);

  const leaveRoom = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (isLeavingRef.current) {
      return { success: false, error: 'Leave room operation is already in progress.' };
    }

    const code = currentRoomCodeRef.current;
    if (!code) {
      setCurrentRoomCode(null);
      setAllRooms({});
      return { success: true };
    }

    isLeavingRef.current = true;
    setIsRoomLoading(true);

    const room = allRooms[code];
    const roomId = room?.id || code;

    try {
      // 1. Primary path: Socket acknowledgement with 3.5s bounded timeout
      let socketSuccess = false;
      let socketError: string | undefined;

      try {
        const res = await Promise.race([
          new Promise<any>((resolve) => {
            socketService.emit('room:leave', { roomId }, (response: any) => {
              resolve(response);
            });
          }),
          new Promise<any>((resolve) =>
            setTimeout(() => resolve({ success: false, error: 'Socket leave timed out' }), 3500)
          ),
        ]);
        socketSuccess = Boolean(res?.success);
        socketError = res?.error;
      } catch (sockErr: any) {
        socketSuccess = false;
        socketError = sockErr?.message;
      }

      // 2. REST fallback if socket didn't succeed
      if (!socketSuccess) {
        try {
          await api.rooms.leave(roomId);
        } catch (restErr: any) {
          // If room already left / 404 / 400 (not member), consider it successfully cleared
          if (restErr?.status !== 404 && restErr?.status !== 400) {
            const errorMsg = restErr?.message || socketError || 'Failed to leave room. Please try again.';
            setRoomError(errorMsg);
            return { success: false, error: errorMsg };
          }
        }
      }

      // 3. Clear active room references on confirmed leave
      setCurrentRoomCode(null);
      currentRoomCodeRef.current = null;
      currentRoomIdRef.current = null;
      setAllRooms({});
      setRoomError(null);
      return { success: true };
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to leave room.';
      setRoomError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      isLeavingRef.current = false;
      setIsRoomLoading(false);
    }
  }, [allRooms]);

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

      // Socket is the single authoritative write path. The backend persists
      // the value once and broadcasts the committed room snapshot to everyone.
      socketService.emit(
        'room:ready:update',
        { roomId: currentRoom.id, isReady: nextReady },
        (response) => {
          if (response?.success) return;

          setAllRooms((prev) => {
            const room = prev[currentRoom.code];
            if (!room) return prev;
            return {
              ...prev,
              [room.code]: {
                ...room,
                participants: room.participants.map((participant) =>
                  participant.id === targetId
                    ? { ...participant, isReady: Boolean(currentParticipant?.isReady) }
                    : participant
                ),
              },
            };
          });
          console.warn('Failed to update ready status:', response?.error);
        }
      );
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

      const previousGameId = currentRoom.selectedGameId;
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

      return new Promise((resolve) => {
        socketService.emit('room:game:select', { roomId: currentRoom.id, gameId }, (response) => {
          if (response?.success) {
            resolve({ success: true });
            return;
          }

          setAllRooms((prev) => {
            const room = prev[currentRoom.code];
            if (!room) return prev;
            return {
              ...prev,
              [room.code]: { ...room, selectedGameId: previousGameId },
            };
          });
          resolve({
            success: false,
            error: response?.error || 'Failed to select game on server',
          });
        });
      });
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

      socketService.emit('room:game:vote', { roomId: currentRoom.id, gameId }, (response) => {
        if (response?.success) return;

        const previousVotes = Object.fromEntries(
          Object.entries(currentRoom.gameVotes).map(([id, ids]) => [id, [...ids]])
        );
        setAllRooms((prev) => {
          const room = prev[currentRoom.code];
          if (!room) return prev;
          return {
            ...prev,
            [room.code]: { ...room, gameVotes: previousVotes },
          };
        });
        console.warn('Failed to persist game vote:', response?.error);
      });
    },
    [currentRoom, user]
  );

  const sendChatMessage = useCallback(
    (text: string) => {
      if (!currentRoom || !text.trim()) return;
      const clean = text.trim();

      socketService.emit('room:chat:send', { roomId: currentRoom.id, message: clean });
    },
    [currentRoom]
  );

  const sendEmojiReaction = useCallback(
    (emoji: string) => {
      if (!currentRoom) return;
      socketService.emit('room:reaction:send', { roomId: currentRoom.id, reaction: emoji });
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
