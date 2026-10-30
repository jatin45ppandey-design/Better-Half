export type GameMode = 'all' | 'couple' | 'friend';

export type GameCategory = 
  | 'All'
  | 'Connection'
  | 'Party'
  | 'Quick Duel'
  | 'Card & Board'
  | 'Arcade & Physics';

export interface GameItem {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: GameCategory;
  modes: ('couple' | 'friend')[];
  minPlayers: number;
  maxPlayers: number;
  activeBoardPlayers?: number; // E.g. Tic Tac Toe active duelists = 2 even if room has 4
  estimatedMinutes: string;
  iconName: string;
  badgeText: string;
  accentColor: {
    bg: string;
    border: string;
    text: string;
    pillBg: string;
  };
  rulesPreview: string[];
  instructions: {
    overview: string;
    rules: string[];
    controls: string;
    prototypeNotes: string;
  };
  featured?: boolean;
}

export interface ModeDetail {
  id: 'couple' | 'friend';
  name: string;
  tagline: string;
  playerCount: string;
  description: string;
  badge: string;
  icon: string;
  accent: {
    bg: string;
    border: string;
    pill: string;
  };
  highlights: string[];
}

export interface RecentMatch {
  id: string;
  gameId: string;
  gameName: string;
  mode: 'couple' | 'friend';
  playedAgo: string;
  players: string[];
  outcome: string;
  scoreOrRounds: string;
  isMockData: true;
}

export interface RoomParticipant {
  id: string;
  name: string;
  avatarInitials: string;
  avatarColor: string;
  isHost: boolean;
  isReady: boolean;
  isDemo?: boolean;
  isOnline?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isSystem?: boolean;
}

export interface RoomSession {
  id?: string;
  code: string;
  name: string;
  mode: 'couple' | 'friend';
  maxPlayers: number;
  selectedGameId: string;
  hostId: string;
  hostName: string;
  participants: RoomParticipant[];
  gameVotes: Record<string, string[]>; // gameId -> participantId[]
  chatMessages: ChatMessage[];
  status: 'lobby' | 'playing' | 'results';
  createdAt: string;
}
