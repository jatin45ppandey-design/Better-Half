/**
 * PlaySpace Mock Social & Storage Service Adapter
 * 
 * Provides typed local storage / simulation boundary for:
 * - Profile & Career Stats
 * - Friends & Friend Requests
 * - Room Invitations
 * - Match History
 * - Rivalry Tracking
 * - Admin Platform Preview Data
 * 
 * IMPORTANT:
 * - All sample statistics are explicitly flagged as sample/demo data.
 * - BETWEEN US private answers are NEVER persisted to localStorage or logs.
 */

export interface PlayerProfileData {
  id: string;
  name: string;
  username: string;
  avatarInitials: string;
  avatarColor: string;
  bio: string;
  joinedDate: string;
  favouriteGames: string[];
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  gameStats: Record<string, { played: number; won: number; highscore?: number }>;
  privacy: {
    showOnlineStatus: boolean;
    allowDirectInvites: boolean;
    publicMatchHistory: boolean;
  };
  isSampleData: boolean;
}

export interface FriendItem {
  id: string;
  name: string;
  username: string;
  avatarInitials: string;
  avatarColor: string;
  status: 'online' | 'in-game' | 'in-lobby' | 'offline';
  statusText: string;
  currentGame?: string;
  isMutualCouple?: boolean;
}

export interface FriendRequestItem {
  id: string;
  name: string;
  username: string;
  avatarInitials: string;
  avatarColor: string;
  timestamp: string;
  mutualFriends: number;
}

export interface RoomInvitationItem {
  id: string;
  fromName: string;
  fromAvatarInitials: string;
  fromAvatarColor: string;
  roomCode: string;
  roomMode: 'couple' | 'friend';
  suggestedGameName: string;
  timestamp: string;
  status: 'pending' | 'expired' | 'declined';
  isDemoInvitation: boolean;
}

export interface MatchHistoryItem {
  id: string;
  gameId: string;
  gameName: string;
  mode: 'couple' | 'friend';
  date: string;
  duration: string;
  participants: {
    name: string;
    avatarInitials: string;
    avatarColor: string;
    score: number;
    isWinner: boolean;
    isCurrentUser?: boolean;
  }[];
  roundsPlayed: number;
  winnerName: string;
  details?: string;
  isDemoRecord: boolean;
}

export interface RivalrySummary {
  rivalName: string;
  rivalUsername: string;
  rivalAvatarInitials: string;
  rivalAvatarColor: string;
  totalMatches: number;
  userWins: number;
  rivalWins: number;
  draws: number;
  currentStreak: { holder: 'user' | 'rival' | 'none'; count: number };
  favouriteGamesTogether: { name: string; count: number }[];
  recentH2H: {
    id: string;
    gameName: string;
    date: string;
    userScore: number;
    rivalScore: number;
    winner: 'user' | 'rival' | 'draw';
  }[];
  isSampleData: boolean;
}

export interface AdminUserData {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  status: 'active' | 'suspended' | 'flagged';
  joinedDate: string;
  lastActive: string;
  matchesPlayed: number;
}

export interface AdminQuestionItem {
  id: string;
  gameType: 'truth-or-dare' | 'would-you-rather' | 'between-us';
  type?: 'truth' | 'dare';
  category: string;
  intensity: 'light' | 'medium' | 'deep' | 'wild';
  prompt: string;
  optionA?: string;
  optionB?: string;
}

export interface AdminAuditLog {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  target: string;
  severity: 'info' | 'warning' | 'alert';
}

// Default initial state for local demo
const DEFAULT_PROFILE: PlayerProfileData = {
  id: 'user-demo-1',
  name: 'Alex Rivera',
  username: '@alex_r',
  avatarInitials: 'AR',
  avatarColor: '#9670E8',
  bio: 'Competitive at Aloo Golf, casual at Pen Fight. Here for friendly game nights & couple showdowns!',
  joinedDate: 'Joined March 2026',
  favouriteGames: ['aloo-golf', 'original-card-game', 'tic-tac-toe'],
  totalMatches: 24,
  wins: 15,
  losses: 7,
  draws: 2,
  gameStats: {
    'aloo-golf': { played: 10, won: 7, highscore: -2 },
    'original-card-game': { played: 8, won: 5 },
    'tic-tac-toe': { played: 4, won: 2 },
    'basketball-rivalry': { played: 2, won: 1, highscore: 28 },
  },
  privacy: {
    showOnlineStatus: true,
    allowDirectInvites: true,
    publicMatchHistory: true,
  },
  isSampleData: true,
};

const DEFAULT_FRIENDS: FriendItem[] = [
  {
    id: 'f-1',
    name: 'Jordan Taylor',
    username: '@jordy_t',
    avatarInitials: 'JT',
    avatarColor: '#593B91',
    status: 'online',
    statusText: 'In Lobby (Waiting)',
    isMutualCouple: true,
  },
  {
    id: 'f-2',
    name: 'Samira Chen',
    username: '@samira_c',
    avatarInitials: 'SC',
    avatarColor: '#30B0C7',
    status: 'in-game',
    statusText: 'Playing Aloo Golf',
    currentGame: 'Aloo Golf',
  },
  {
    id: 'f-3',
    name: 'Marcus Bell',
    username: '@marcus_b',
    avatarInitials: 'MB',
    avatarColor: '#F2A33A',
    status: 'in-lobby',
    statusText: 'Lobby #DUEL9',
  },
  {
    id: 'f-4',
    name: 'Riley Davis',
    username: '@riley_d',
    avatarInitials: 'RD',
    avatarColor: '#34C759',
    status: 'offline',
    statusText: 'Last active 2h ago',
  },
];

const DEFAULT_REQUESTS: FriendRequestItem[] = [
  {
    id: 'req-1',
    name: 'Elena Rostova',
    username: '@elena_r',
    avatarInitials: 'ER',
    avatarColor: '#EC4899',
    timestamp: '2 hours ago',
    mutualFriends: 2,
  },
  {
    id: 'req-2',
    name: 'Noah Williams',
    username: '@noah_w',
    avatarInitials: 'NW',
    avatarColor: '#6366F1',
    timestamp: 'Yesterday',
    mutualFriends: 1,
  },
];

const DEFAULT_INVITATIONS: RoomInvitationItem[] = [
  {
    id: 'inv-1',
    fromName: 'Jordan Taylor',
    fromAvatarInitials: 'JT',
    fromAvatarColor: '#593B91',
    roomCode: 'LOVE2',
    roomMode: 'couple',
    suggestedGameName: 'Aloo Golf',
    timestamp: '5 mins ago',
    status: 'pending',
    isDemoInvitation: true,
  },
  {
    id: 'inv-2',
    fromName: 'Samira Chen',
    fromAvatarInitials: 'SC',
    fromAvatarColor: '#30B0C7',
    roomCode: 'SQUAD4',
    roomMode: 'friend',
    suggestedGameName: 'Original Card Game',
    timestamp: '35 mins ago',
    status: 'pending',
    isDemoInvitation: true,
  },
  {
    id: 'inv-3',
    fromName: 'Marcus Bell',
    fromAvatarInitials: 'MB',
    fromAvatarColor: '#F2A33A',
    roomCode: 'FAST9',
    roomMode: 'friend',
    suggestedGameName: 'Snatch the Fries',
    timestamp: '3 hours ago',
    status: 'expired',
    isDemoInvitation: true,
  },
];

const DEFAULT_MATCH_HISTORY: MatchHistoryItem[] = [
  {
    id: 'match-101',
    gameId: 'aloo-golf',
    gameName: 'Aloo Golf',
    mode: 'couple',
    date: 'Today, 2:15 PM',
    duration: '4m 12s',
    roundsPlayed: 3,
    winnerName: 'Alex Rivera',
    details: 'Won by 2 strokes after hole 3 water hazard',
    isDemoRecord: true,
    participants: [
      { name: 'Alex Rivera', avatarInitials: 'AR', avatarColor: '#9670E8', score: 8, isWinner: true, isCurrentUser: true },
      { name: 'Jordan Taylor', avatarInitials: 'JT', avatarColor: '#593B91', score: 10, isWinner: false },
    ],
  },
  {
    id: 'match-102',
    gameId: 'original-card-game',
    gameName: 'Original Card Game',
    mode: 'friend',
    date: 'Yesterday, 8:40 PM',
    duration: '11m 30s',
    roundsPlayed: 1,
    winnerName: 'Samira Chen',
    details: 'Samira called last card and dropped Draw Two on Jordan',
    isDemoRecord: true,
    participants: [
      { name: 'Samira Chen', avatarInitials: 'SC', avatarColor: '#30B0C7', score: 0, isWinner: true },
      { name: 'Alex Rivera', avatarInitials: 'AR', avatarColor: '#9670E8', score: 28, isWinner: false, isCurrentUser: true },
      { name: 'Jordan Taylor', avatarInitials: 'JT', avatarColor: '#593B91', score: 45, isWinner: false },
      { name: 'Marcus Bell', avatarInitials: 'MB', avatarColor: '#F2A33A', score: 62, isWinner: false },
    ],
  },
  {
    id: 'match-103',
    gameId: 'tic-tac-toe',
    gameName: 'Tic Tac Toe',
    mode: 'couple',
    date: 'Oct 28, 2026',
    duration: '2m 10s',
    roundsPlayed: 3,
    winnerName: 'Jordan Taylor',
    details: 'Jordan won match 2-1 on diagonal lock',
    isDemoRecord: true,
    participants: [
      { name: 'Jordan Taylor', avatarInitials: 'JT', avatarColor: '#593B91', score: 2, isWinner: true },
      { name: 'Alex Rivera', avatarInitials: 'AR', avatarColor: '#9670E8', score: 1, isWinner: false, isCurrentUser: true },
    ],
  },
  {
    id: 'match-104',
    gameId: 'basketball-rivalry',
    gameName: 'Basketball Rivalry',
    mode: 'friend',
    date: 'Oct 27, 2026',
    duration: '3m 00s',
    roundsPlayed: 1,
    winnerName: 'Alex Rivera',
    details: 'Alex sank 4 buzzer-beaters in bonus round',
    isDemoRecord: true,
    participants: [
      { name: 'Alex Rivera', avatarInitials: 'AR', avatarColor: '#9670E8', score: 32, isWinner: true, isCurrentUser: true },
      { name: 'Marcus Bell', avatarInitials: 'MB', avatarColor: '#F2A33A', score: 24, isWinner: false },
      { name: 'Samira Chen', avatarInitials: 'SC', avatarColor: '#30B0C7', score: 18, isWinner: false },
    ],
  },
  {
    id: 'match-105',
    gameId: 'blind-ranking',
    gameName: 'Blind Ranking',
    mode: 'couple',
    date: 'Oct 25, 2026',
    duration: '5m 20s',
    roundsPlayed: 1,
    winnerName: 'Tie Match',
    details: 'Both players locked in identical top 3 vacation spots',
    isDemoRecord: true,
    participants: [
      { name: 'Alex Rivera', avatarInitials: 'AR', avatarColor: '#9670E8', score: 10, isWinner: true, isCurrentUser: true },
      { name: 'Jordan Taylor', avatarInitials: 'JT', avatarColor: '#593B91', score: 10, isWinner: true },
    ],
  },
];

const DEFAULT_RIVALRY: RivalrySummary = {
  rivalName: 'Jordan Taylor',
  rivalUsername: '@jordy_t',
  rivalAvatarInitials: 'JT',
  rivalAvatarColor: '#593B91',
  totalMatches: 18,
  userWins: 10,
  rivalWins: 7,
  draws: 1,
  currentStreak: { holder: 'user', count: 2 },
  favouriteGamesTogether: [
    { name: 'Aloo Golf', count: 7 },
    { name: 'Tic Tac Toe', count: 5 },
    { name: 'Original Card Game', count: 4 },
    { name: 'Blind Ranking', count: 2 },
  ],
  recentH2H: [
    { id: 'h2h-1', gameName: 'Aloo Golf', date: 'Today, 2:15 PM', userScore: 8, rivalScore: 10, winner: 'user' },
    { id: 'h2h-2', gameName: 'Basketball Rivalry', date: 'Yesterday', userScore: 32, rivalScore: 28, winner: 'user' },
    { id: 'h2h-3', gameName: 'Tic Tac Toe', date: 'Oct 28', userScore: 1, rivalScore: 2, winner: 'rival' },
    { id: 'h2h-4', gameName: 'Original Card Game', date: 'Oct 26', userScore: 15, rivalScore: 35, winner: 'user' },
    { id: 'h2h-5', gameName: 'Aloo Golf', date: 'Oct 24', userScore: 12, rivalScore: 9, winner: 'rival' },
  ],
  isSampleData: true,
};

const DEFAULT_ADMIN_USERS: AdminUserData[] = [
  { id: 'usr-1', name: 'Alex Rivera', email: 'alex@example.com', role: 'admin', status: 'active', joinedDate: '2026-03-01', lastActive: 'Just now', matchesPlayed: 24 },
  { id: 'usr-2', name: 'Jordan Taylor', email: 'jordan@example.com', role: 'user', status: 'active', joinedDate: '2026-03-05', lastActive: '5m ago', matchesPlayed: 19 },
  { id: 'usr-3', name: 'Samira Chen', email: 'samira@example.com', role: 'user', status: 'active', joinedDate: '2026-03-10', lastActive: '12m ago', matchesPlayed: 14 },
  { id: 'usr-4', name: 'Marcus Bell', email: 'marcus@example.com', role: 'user', status: 'active', joinedDate: '2026-03-12', lastActive: '1h ago', matchesPlayed: 11 },
  { id: 'usr-5', name: 'ToxicPlayer99', email: 'troll@example.com', role: 'user', status: 'suspended', joinedDate: '2026-03-20', lastActive: '2d ago', matchesPlayed: 2 },
];

const DEFAULT_ADMIN_QUESTIONS: AdminQuestionItem[] = [
  { id: 'q-1', gameType: 'truth-or-dare', type: 'truth', category: 'Romantic & Flirty', intensity: 'medium', prompt: 'What was your very first impression of me on our first date?' },
  { id: 'q-2', gameType: 'truth-or-dare', type: 'dare', category: 'Playful & Physical', intensity: 'light', prompt: 'Do your best runway model walk across the room without laughing.' },
  { id: 'q-3', gameType: 'would-you-rather', category: 'Lifestyle & Fun', intensity: 'light', prompt: 'Would you rather have unlimited free flights forever or never pay for food again?', optionA: 'Free flights forever', optionB: 'Never pay for food again' },
  { id: 'q-4', gameType: 'between-us', category: 'Daily Life & Dynamics', intensity: 'medium', prompt: 'What small habit of mine do you find surprisingly endearing?' },
  { id: 'q-5', gameType: 'between-us', category: 'Intimacy & Romance', intensity: 'deep', prompt: 'What is a shared memory that always makes your heart skip a beat?' },
];

const DEFAULT_ADMIN_LOGS: AdminAuditLog[] = [
  { id: 'log-1', timestamp: '10:14 AM', action: 'Question Added', actor: 'alex@example.com', target: 'Truth or Dare #q-108', severity: 'info' },
  { id: 'log-2', timestamp: '09:42 AM', action: 'User Suspended', actor: 'System Auto-Mod', target: 'ToxicPlayer99 (Griefing report)', severity: 'warning' },
  { id: 'log-3', timestamp: '08:30 AM', action: 'Game Toggled', actor: 'alex@example.com', target: 'Pen Fight (Status: Active)', severity: 'info' },
  { id: 'log-4', timestamp: 'Yesterday', action: 'Config Saved', actor: 'alex@example.com', target: 'Room Limits: Couple (2), Friend (4)', severity: 'info' },
];

class MockSocialAdapter {
  // Profiles
  public getProfile(): PlayerProfileData {
    try {
      const data = localStorage.getItem('playspace_profile');
      return data ? JSON.parse(data) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  }

  public updateProfile(updated: Partial<PlayerProfileData>): PlayerProfileData {
    const current = this.getProfile();
    const merged = { ...current, ...updated };
    try {
      localStorage.setItem('playspace_profile', JSON.stringify(merged));
    } catch {
      // ignore
    }
    return merged;
  }

  // Friends
  public getFriends(): FriendItem[] {
    try {
      const data = localStorage.getItem('playspace_friends');
      return data ? JSON.parse(data) : DEFAULT_FRIENDS;
    } catch {
      return DEFAULT_FRIENDS;
    }
  }

  public removeFriend(friendId: string): void {
    const friends = this.getFriends().filter((f) => f.id !== friendId);
    try {
      localStorage.setItem('playspace_friends', JSON.stringify(friends));
    } catch {
      // ignore
    }
  }

  // Requests
  public getFriendRequests(): FriendRequestItem[] {
    try {
      const data = localStorage.getItem('playspace_friend_requests');
      return data ? JSON.parse(data) : DEFAULT_REQUESTS;
    } catch {
      return DEFAULT_REQUESTS;
    }
  }

  public acceptFriendRequest(requestId: string): void {
    const reqs = this.getFriendRequests();
    const req = reqs.find((r) => r.id === requestId);
    if (req) {
      const friends = this.getFriends();
      friends.push({
        id: `f-${Date.now()}`,
        name: req.name,
        username: req.username,
        avatarInitials: req.avatarInitials,
        avatarColor: req.avatarColor,
        status: 'online',
        statusText: 'Just connected',
      });
      try {
        localStorage.setItem('playspace_friends', JSON.stringify(friends));
        localStorage.setItem('playspace_friend_requests', JSON.stringify(reqs.filter((r) => r.id !== requestId)));
      } catch {
        // ignore
      }
    }
  }

  public rejectFriendRequest(requestId: string): void {
    const reqs = this.getFriendRequests().filter((r) => r.id !== requestId);
    try {
      localStorage.setItem('playspace_friend_requests', JSON.stringify(reqs));
    } catch {
      // ignore
    }
  }

  // Invitations
  public getInvitations(): RoomInvitationItem[] {
    try {
      const data = localStorage.getItem('playspace_invitations');
      return data ? JSON.parse(data) : DEFAULT_INVITATIONS;
    } catch {
      return DEFAULT_INVITATIONS;
    }
  }

  public declineInvitation(invitationId: string): void {
    const invs = this.getInvitations().map((inv) =>
      inv.id === invitationId ? { ...inv, status: 'declined' as const } : inv
    );
    try {
      localStorage.setItem('playspace_invitations', JSON.stringify(invs));
    } catch {
      // ignore
    }
  }

  // Match History
  public getMatchHistory(): MatchHistoryItem[] {
    try {
      const data = localStorage.getItem('playspace_match_history');
      return data ? JSON.parse(data) : DEFAULT_MATCH_HISTORY;
    } catch {
      return DEFAULT_MATCH_HISTORY;
    }
  }

  public recordMatch(item: Omit<MatchHistoryItem, 'id' | 'isDemoRecord'>): void {
    const history = this.getMatchHistory();
    const newItem: MatchHistoryItem = {
      ...item,
      id: `match-${Date.now()}`,
      isDemoRecord: false, // Locally recorded live match
    };
    history.unshift(newItem);
    try {
      localStorage.setItem('playspace_match_history', JSON.stringify(history.slice(0, 30)));
    } catch {
      // ignore
    }
  }

  // Rivalry
  public getRivalry(): RivalrySummary {
    try {
      const data = localStorage.getItem('playspace_rivalry');
      return data ? JSON.parse(data) : DEFAULT_RIVALRY;
    } catch {
      return DEFAULT_RIVALRY;
    }
  }

  // Admin Data
  public getAdminUsers(): AdminUserData[] {
    try {
      const data = localStorage.getItem('playspace_admin_users');
      return data ? JSON.parse(data) : DEFAULT_ADMIN_USERS;
    } catch {
      return DEFAULT_ADMIN_USERS;
    }
  }

  public toggleUserStatus(userId: string): AdminUserData[] {
    const users = this.getAdminUsers().map((u) => {
      if (u.id === userId) {
        const nextStatus: AdminUserData['status'] = u.status === 'active' ? 'suspended' : 'active';
        return { ...u, status: nextStatus };
      }
      return u;
    });
    try {
      localStorage.setItem('playspace_admin_users', JSON.stringify(users));
    } catch {
      // ignore
    }
    return users;
  }

  public getAdminQuestions(): AdminQuestionItem[] {
    try {
      const data = localStorage.getItem('playspace_admin_questions');
      return data ? JSON.parse(data) : DEFAULT_ADMIN_QUESTIONS;
    } catch {
      return DEFAULT_ADMIN_QUESTIONS;
    }
  }

  public addAdminQuestion(q: Omit<AdminQuestionItem, 'id'>): AdminQuestionItem[] {
    const list = this.getAdminQuestions();
    const newQ: AdminQuestionItem = { ...q, id: `q-${Date.now()}` };
    list.unshift(newQ);
    try {
      localStorage.setItem('playspace_admin_questions', JSON.stringify(list));
    } catch {
      // ignore
    }
    return list;
  }

  public deleteAdminQuestion(id: string): AdminQuestionItem[] {
    const list = this.getAdminQuestions().filter((q) => q.id !== id);
    try {
      localStorage.setItem('playspace_admin_questions', JSON.stringify(list));
    } catch {
      // ignore
    }
    return list;
  }

  public getAdminLogs(): AdminAuditLog[] {
    try {
      const data = localStorage.getItem('playspace_admin_logs');
      return data ? JSON.parse(data) : DEFAULT_ADMIN_LOGS;
    } catch {
      return DEFAULT_ADMIN_LOGS;
    }
  }
}

export const mockSocialAdapter = new MockSocialAdapter();
