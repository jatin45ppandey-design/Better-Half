import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { RoomSession, RoomParticipant, ChatMessage } from '../types/game';
import { isGameEligibleForMode } from '../data/games/registry';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface CreateRoomParams {
  code?: string;
  name: string;
  mode: 'couple' | 'friend';
  selectedGameId: string;
}

interface RoomContextType {
  currentRoom: RoomSession | null;
  allRooms: Record<string, RoomSession>;
  createRoom: (params: CreateRoomParams) => RoomSession;
  joinRoom: (code: string) => { success: boolean; error?: string };
  leaveRoom: () => void;
  getRoomByCode: (code: string) => RoomSession | undefined;
  toggleReady: (participantId?: string) => void;
  setRoomGame: (gameId: string) => { success: boolean; error?: string };
  voteForGame: (gameId: string) => void;
  sendChatMessage: (text: string) => void;
  sendEmojiReaction: (emoji: string) => void;
  addDemoPlayer: () => void;
  removeDemoPlayer: (participantId: string) => void;
  setRoomStatus: (status: 'lobby' | 'playing' | 'results') => void;
  canStartGame: () => { canStart: boolean; reason?: string };
}

const SEEDED_ROOMS: Record<string, RoomSession> = {
  LOVE22: {
    code: 'LOVE22',
    name: 'Cozy Evening Lounge',
    mode: 'couple',
    maxPlayers: 2,
    selectedGameId: 'between-us',
    hostId: 'dev-user-01',
    hostName: 'Alex Rivera',
    participants: [
      {
        id: 'dev-user-01',
        name: 'Alex Rivera',
        avatarInitials: 'AR',
        avatarColor: 'bg-[#9670E8]',
        isHost: true,
        isReady: true,
      },
      {
        id: 'demo-partner-02',
        name: 'Sam Patel',
        avatarInitials: 'SP',
        avatarColor: 'bg-[#D94C65]',
        isHost: false,
        isReady: true,
        isDemo: true,
      },
    ],
    gameVotes: { 'between-us': ['dev-user-01', 'demo-partner-02'] },
    chatMessages: [
      {
        id: 'msg-1',
        senderId: 'system',
        senderName: 'System',
        text: 'Room LOVE22 created in Couple Mode (2 Players max).',
        timestamp: '10:00 AM',
        isSystem: true,
      },
      {
        id: 'msg-2',
        senderId: 'demo-partner-02',
        senderName: 'Sam',
        text: 'Ready for deep questions tonight! 💜',
        timestamp: '10:01 AM',
      },
    ],
    status: 'lobby',
    createdAt: '2026-10-30T10:00:00Z',
  },
  PLAY69: {
    code: 'PLAY69',
    name: 'Friday Banter Squad',
    mode: 'friend',
    maxPlayers: 4,
    selectedGameId: 'uno-style',
    hostId: 'dev-user-01',
    hostName: 'Alex Rivera',
    participants: [
      {
        id: 'dev-user-01',
        name: 'Alex Rivera',
        avatarInitials: 'AR',
        avatarColor: 'bg-[#9670E8]',
        isHost: true,
        isReady: true,
      },
      {
        id: 'demo-friend-02',
        name: 'Leo Vance',
        avatarInitials: 'LV',
        avatarColor: 'bg-[#3B82F6]',
        isHost: false,
        isReady: true,
        isDemo: true,
      },
      {
        id: 'demo-friend-03',
        name: 'Zara Chen',
        avatarInitials: 'ZC',
        avatarColor: 'bg-[#10B981]',
        isHost: false,
        isReady: true,
        isDemo: true,
      },
      {
        id: 'demo-friend-04',
        name: 'Kai Miller',
        avatarInitials: 'KM',
        avatarColor: 'bg-[#F59E0B]',
        isHost: false,
        isReady: true,
        isDemo: true,
      },
    ],
    gameVotes: {
      'uno-style': ['dev-user-01', 'demo-friend-03'],
      'blind-ranking': ['demo-friend-02'],
      'kabza': ['demo-friend-04'],
    },
    chatMessages: [
      {
        id: 'msg-f1',
        senderId: 'system',
        senderName: 'System',
        text: 'Room PLAY69 initialized in Friend Mode (4 Players).',
        timestamp: '10:15 AM',
        isSystem: true,
      },
      {
        id: 'msg-f2',
        senderId: 'demo-friend-02',
        senderName: 'Leo',
        text: 'Whoever draws +4 is getting no mercy tonight 😂',
        timestamp: '10:16 AM',
      },
    ],
    status: 'lobby',
    createdAt: '2026-10-30T10:15:00Z',
  },
};

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [allRooms, setAllRooms] = useState<Record<string, RoomSession>>(SEEDED_ROOMS);
  const [currentRoomCode, setCurrentRoomCode] = useState<string | null>(null);

  const currentRoom = useMemo(
    () => (currentRoomCode ? allRooms[currentRoomCode] || null : null),
    [currentRoomCode, allRooms]
  );

  const getRoomByCode = useCallback(
    (code: string) => allRooms[code.toUpperCase()],
    [allRooms]
  );

  const createRoom = useCallback(
    ({ code, name, mode, selectedGameId }: CreateRoomParams): RoomSession => {
      const roomCode =
        code?.toUpperCase() || Math.random().toString(36).substring(2, 8).toUpperCase();
      const hostId = user?.id || 'dev-host-01';
      const hostName = user?.name || 'Alex Rivera';

      const initialParticipants: RoomParticipant[] = [
        {
          id: hostId,
          name: hostName,
          avatarInitials: user?.avatarInitials || 'AR',
          avatarColor: user?.avatarColor || 'bg-[#9670E8]',
          isHost: true,
          isReady: true,
        },
      ];

      // Add default seeded demo partner if Couple Mode
      if (mode === 'couple') {
        initialParticipants.push({
          id: 'demo-partner-02',
          name: 'Sam Patel',
          avatarInitials: 'SP',
          avatarColor: 'bg-[#D94C65]',
          isHost: false,
          isReady: true,
          isDemo: true,
        });
      }

      const newRoom: RoomSession = {
        code: roomCode,
        name: name.trim() || (mode === 'couple' ? 'Cozy Couple Room' : 'Party Squad Arena'),
        mode,
        maxPlayers: mode === 'couple' ? 2 : 4,
        selectedGameId,
        hostId,
        hostName,
        participants: initialParticipants,
        gameVotes: { [selectedGameId]: [hostId] },
        chatMessages: [
          {
            id: `msg-${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            text: `Room ${roomCode} created in ${mode === 'couple' ? 'Couple' : 'Friend'} Mode.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isSystem: true,
          },
        ],
        status: 'lobby',
        createdAt: new Date().toISOString(),
      };

      setAllRooms((prev) => ({ ...prev, [roomCode]: newRoom }));
      setCurrentRoomCode(roomCode);
      return newRoom;
    },
    [user]
  );

  const joinRoom = useCallback(
    (code: string): { success: boolean; error?: string } => {
      const cleanCode = code.trim().toUpperCase();
      const room = allRooms[cleanCode];

      if (!room) {
        return {
          success: false,
          error: `Room "${cleanCode}" was not found. Please verify the code or try demo code PLAY69 or LOVE22.`,
        };
      }

      const playerId = user?.id || 'guest-user-01';
      const playerName = user?.name || 'Guest Player';

      // Check if already in room
      const alreadyJoined = room.participants.some((p) => p.id === playerId);
      if (!alreadyJoined) {
        if (room.participants.length >= room.maxPlayers) {
          return {
            success: false,
            error: `Room ${cleanCode} is full (Maximum ${room.maxPlayers} players allowed for ${room.mode === 'couple' ? 'Couple' : 'Friend'} Mode).`,
          };
        }

        const newParticipant: RoomParticipant = {
          id: playerId,
          name: playerName,
          avatarInitials: user?.avatarInitials || 'GP',
          avatarColor: user?.avatarColor || 'bg-[#865CE3]',
          isHost: false,
          isReady: false,
        };

        const updatedRoom: RoomSession = {
          ...room,
          participants: [...room.participants, newParticipant],
          chatMessages: [
            ...room.chatMessages,
            {
              id: `msg-${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              text: `${playerName} connected to the room.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              isSystem: true,
            },
          ],
        };

        setAllRooms((prev) => ({ ...prev, [cleanCode]: updatedRoom }));
      }

      setCurrentRoomCode(cleanCode);
      return { success: true };
    },
    [allRooms, user]
  );

  const leaveRoom = useCallback(() => {
    setCurrentRoomCode(null);
  }, []);

  const toggleReady = useCallback(
    (participantId?: string) => {
      if (!currentRoom) return;
      const targetId = participantId || user?.id || currentRoom.hostId;

      setAllRooms((prev) => {
        const room = prev[currentRoom.code];
        if (!room) return prev;

        const updatedParticipants = room.participants.map((p) =>
          p.id === targetId ? { ...p, isReady: !p.isReady } : p
        );

        return {
          ...prev,
          [room.code]: {
            ...room,
            participants: updatedParticipants,
          },
        };
      });
    },
    [currentRoom, user]
  );

  const setRoomGame = useCallback(
    (gameId: string): { success: boolean; error?: string } => {
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

      return { success: true };
    },
    [currentRoom]
  );

  const voteForGame = useCallback(
    (gameId: string) => {
      if (!currentRoom) return;
      const voterId = user?.id || currentRoom.hostId;

      setAllRooms((prev) => {
        const room = prev[currentRoom.code];
        if (!room) return prev;

        const votes = { ...room.gameVotes };
        // Remove voter from all other votes
        Object.keys(votes).forEach((k) => {
          votes[k] = votes[k].filter((id) => id !== voterId);
        });

        // Add vote
        votes[gameId] = [...(votes[gameId] || []), voterId];

        // Find game with most votes to auto-select as top candidate
        let maxVotes = 0;
        let topGame = room.selectedGameId;
        Object.entries(votes).forEach(([gId, voters]) => {
          if (voters.length > maxVotes) {
            maxVotes = voters.length;
            topGame = gId;
          }
        });

        return {
          ...prev,
          [room.code]: {
            ...room,
            gameVotes: votes,
            selectedGameId: topGame,
          },
        };
      });
    },
    [currentRoom, user]
  );

  const sendChatMessage = useCallback(
    (text: string) => {
      if (!currentRoom || !text.trim()) return;
      const senderName = user?.name || 'Alex';
      const senderId = user?.id || 'host-user';

      const newMsg: ChatMessage = {
        id: `chat-${Date.now()}`,
        senderId,
        senderName,
        text: text.trim(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setAllRooms((prev) => {
        const room = prev[currentRoom.code];
        if (!room) return prev;
        return {
          ...prev,
          [room.code]: {
            ...room,
            chatMessages: [...room.chatMessages, newMsg],
          },
        };
      });
    },
    [currentRoom, user]
  );

  const sendEmojiReaction = useCallback(
    (emoji: string) => {
      sendChatMessage(emoji);
    },
    [sendChatMessage]
  );

  const addDemoPlayer = useCallback(() => {
    if (!currentRoom) return;
    if (currentRoom.participants.length >= currentRoom.maxPlayers) {
      addToast('Room is at maximum player capacity!', { type: 'error' });
      return;
    }

    const availableNames = [
      { name: 'Jordan Vance', initials: 'JV', color: 'bg-[#0369A1]' },
      { name: 'Maya Lin', initials: 'ML', color: 'bg-[#9D174D]' },
      { name: 'Chloe Ray', initials: 'CR', color: 'bg-[#854D0E]' },
    ];

    const currentNames = new Set(currentRoom.participants.map((p) => p.name));
    const nextPick = availableNames.find((p) => !currentNames.has(p.name)) || {
      name: `Player ${currentRoom.participants.length + 1}`,
      initials: `P${currentRoom.participants.length + 1}`,
      color: 'bg-[#593B91]',
    };

    const newParticipant: RoomParticipant = {
      id: `demo-bot-${Date.now()}`,
      name: nextPick.name,
      avatarInitials: nextPick.initials,
      avatarColor: nextPick.color,
      isHost: false,
      isReady: true,
      isDemo: true,
    };

    setAllRooms((prev) => {
      const room = prev[currentRoom.code];
      if (!room) return prev;
      return {
        ...prev,
        [room.code]: {
          ...room,
          participants: [...room.participants, newParticipant],
        },
      };
    });

    addToast(`${nextPick.name} joined the room!`, { type: 'success' });
  }, [currentRoom, addToast]);

  const removeDemoPlayer = useCallback(
    (participantId: string) => {
      if (!currentRoom) return;

      setAllRooms((prev) => {
        const room = prev[currentRoom.code];
        if (!room) return prev;
        return {
          ...prev,
          [room.code]: {
            ...room,
            participants: room.participants.filter((p) => p.id !== participantId),
          },
        };
      });
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
        createRoom,
        joinRoom,
        leaveRoom,
        getRoomByCode,
        toggleReady,
        setRoomGame,
        voteForGame,
        sendChatMessage,
        sendEmojiReaction,
        addDemoPlayer,
        removeDemoPlayer,
        setRoomStatus,
        canStartGame,
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
