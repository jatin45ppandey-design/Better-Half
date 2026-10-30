export interface RoomParticipantSnapshot {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  avatarInitials?: string | null;
  avatarColor?: string | null;
  role: 'HOST' | 'PLAYER';
  isReady: boolean;
  isOnline?: boolean;
  joinedAt: Date | string;
}

export interface RoomSnapshot {
  id: string;
  code: string;
  name: string;
  mode: 'couple' | 'friend';
  status: string;
  selectedGameId: string | null;
  maxPlayers: number;
  hostId: string;
  hostName: string;
  participants: RoomParticipantSnapshot[];
  gameVotes: Record<string, string[]>;
  chatMessages: RoomMessageSnapshot[];
  createdAt: Date | string;
  expiresAt: Date | string;
}

export interface RoomMessageSnapshot {
  id: string;
  roomId?: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isSystem: boolean;
  createdAt?: Date | string;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomSnapshot) => void;
  'room:player:joined': (data: { participant: RoomParticipantSnapshot }) => void;
  'room:player:left': (data: { userId: string; newHostId?: string; roomClosed?: boolean }) => void;
  'room:player:ready': (data: { userId: string; isReady: boolean; roomStatus: string }) => void;
  'room:game:voted': (data: { userId: string; gameId: string; votes: Record<string, string[]> }) => void;
  'room:game:selected': (data: { selectedGameId: string }) => void;
  'room:start:launch': (data: { gameId: string; launchedAt: string }) => void;
  'room:host:changed': (data: { hostId: string; hostName?: string }) => void;
  'room:player:kicked': (data: { targetUserId: string }) => void;
  'room:chat:new': (message: RoomMessageSnapshot) => void;
  'room:reaction:new': (data: { senderId: string; reaction: string; timestamp: string }) => void;
  'room:presence:update': (data: { onlineUserIds: string[] }) => void;
  'room:error': (data: { code: string; message: string }) => void;
}

export interface ClientToServerEvents {
  'room:join': (
    payload: { roomId?: string; code?: string },
    callback?: (response: { success: boolean; error?: string; room?: RoomSnapshot }) => void
  ) => void;
  'room:leave': (
    payload: { roomId: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'room:ready:update': (
    payload: { roomId: string; isReady: boolean },
    callback?: (response: { success: boolean; error?: string; isReady?: boolean }) => void
  ) => void;
  'room:game:vote': (
    payload: { roomId: string; gameId: string },
    callback?: (response: { success: boolean; error?: string; votes?: Record<string, string[]> }) => void
  ) => void;
  'room:game:select': (
    payload: { roomId: string; gameId: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'room:start:prepare': (
    payload: { roomId: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'room:host:transfer': (
    payload: { roomId: string; newHostId: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'room:player:kick': (
    payload: { roomId: string; targetUserId: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
  'room:chat:send': (
    payload: { roomId: string; message: string },
    callback?: (response: { success: boolean; error?: string; message?: RoomMessageSnapshot }) => void
  ) => void;
  'room:reaction:send': (
    payload: { roomId: string; reaction: string },
    callback?: (response: { success: boolean; error?: string }) => void
  ) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  email?: string;
  user?: any;
}
