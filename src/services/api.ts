import { supabase } from '../lib/supabase';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const API_V1 = `${API_BASE_URL}/api/v1`;

export class ApiError extends Error {
  public status: number;
  public details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_V1}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15_000);

  if (options.signal) {
    options.signal.addEventListener('abort', () => controller.abort());
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    if (fetchErr.name === 'AbortError') {
      throw new ApiError('Request timed out. Please check your connection.', 408);
    }
    throw new ApiError(fetchErr?.message || 'Network request failed.', 0);
  } finally {
    clearTimeout(timeoutId);
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401) {
      // Clear expired credentials to prevent stale auth loops
      void supabase.auth.signOut().catch(() => {});
    }
    const message = (isJson && (data.message || data.error)) || `HTTP ${response.status}: ${response.statusText}`;
    throw new ApiError(message, response.status, isJson ? data.details : undefined);
  }

  return data as T;
}

export interface UserProfileResponse {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
  settings?: UserSettingsResponse;
}

export interface UserSettingsResponse {
  id: string;
  userId: string;
  showOnlineStatus: boolean;
  allowDirectInvites: boolean;
  publicMatchHistory: boolean;
  ghostMode: boolean;
  soundMuted: boolean;
  volume: number;
  reducedMotion: boolean;
}

export interface FriendItemResponse {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  avatarInitials: string | null;
  avatarColor: string | null;
  bio: string | null;
  showOnlineStatus: boolean;
  since: string;
}

export interface FriendRequestsResponse {
  incoming: Array<{
    id: string;
    createdAt: string;
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      avatarInitials: string | null;
      avatarColor: string | null;
    };
  }>;
  outgoing: Array<{
    id: string;
    createdAt: string;
    user: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      avatarInitials: string | null;
      avatarColor: string | null;
    };
  }>;
}

export interface BlockItemResponse {
  id: string;
  createdAt: string;
  blockedUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    avatarInitials: string | null;
    avatarColor: string | null;
  };
}

export const api = {
  // Profiles
  profiles: {
    getMe: () => request<UserProfileResponse>('/profiles/me'),
    updateMe: (data: Partial<UserProfileResponse>) =>
      request<UserProfileResponse>('/profiles/me', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getByUsername: (username: string) =>
      request<UserProfileResponse>(`/profiles/${encodeURIComponent(username)}`),
    search: (query: string) =>
      request<{ results: UserProfileResponse[] }>(`/profiles/search?q=${encodeURIComponent(query)}`),
  },

  // Settings
  settings: {
    get: () => request<UserSettingsResponse>('/settings'),
    update: (data: Partial<UserSettingsResponse>) =>
      request<UserSettingsResponse>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // Friends & Social
  friends: {
    list: () => request<{ friends: FriendItemResponse[] }>('/friends'),
    listRequests: () => request<FriendRequestsResponse>('/friends/requests'),
    sendRequest: (input: { receiverId?: string; username?: string }) =>
      request<{ id: string; status: string; message: string }>('/friends/requests', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    acceptRequest: (requestId: string) =>
      request<{ success: boolean; message: string }>(`/friends/requests/${requestId}/accept`, {
        method: 'POST',
      }),
    rejectRequest: (requestId: string) =>
      request<{ success: boolean; message: string }>(`/friends/requests/${requestId}/reject`, {
        method: 'POST',
      }),
    cancelRequest: (requestId: string) =>
      request<{ success: boolean; message: string }>(`/friends/requests/${requestId}`, {
        method: 'DELETE',
      }),
    remove: (friendId: string) =>
      request<{ success: boolean; message: string }>(`/friends/${friendId}`, {
        method: 'DELETE',
      }),
  },

  // Blocks
  blocks: {
    list: () => request<{ blocked: BlockItemResponse[] }>('/blocks'),
    block: (userId: string) =>
      request<{ success: boolean; message: string }>(`/blocks/${userId}`, {
        method: 'POST',
      }),
    unblock: (userId: string) =>
      request<{ success: boolean; message: string }>(`/blocks/${userId}`, {
        method: 'DELETE',
      }),
  },

  // Real Multiplayer Rooms (Phase 2)
  rooms: {
    create: (data: { name?: string; mode: 'couple' | 'friend'; selectedGameId?: string }) =>
      request<any>('/rooms', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getById: (id: string) => request<any>(`/rooms/${id}`),
    getByCode: (code: string) => request<any>(`/rooms/code/${encodeURIComponent(code)}`),
    getMyActive: () => request<{ rooms: any[] }>('/rooms/me'),
    join: (code: string) =>
      request<any>('/rooms/join', {
        method: 'POST',
        body: JSON.stringify({ code }),
      }),
    leave: (id: string) =>
      request<any>(`/rooms/${id}/leave`, {
        method: 'POST',
      }),
    close: (id: string) =>
      request<any>(`/rooms/${id}/close`, {
        method: 'POST',
      }),
    toggleReady: (id: string, isReady?: boolean) =>
      request<any>(`/rooms/${id}/ready`, {
        method: 'POST',
        body: JSON.stringify({ isReady }),
      }),
    voteGame: (id: string, gameId: string) =>
      request<any>(`/rooms/${id}/vote`, {
        method: 'POST',
        body: JSON.stringify({ gameId }),
      }),
    selectGame: (id: string, gameId: string) =>
      request<any>(`/rooms/${id}/select-game`, {
        method: 'POST',
        body: JSON.stringify({ gameId }),
      }),
    canStart: (id: string) => request<{ canStart: boolean; reason?: string }>(`/rooms/${id}/can-start`),
    transferHost: (id: string, newHostId: string) =>
      request<any>(`/rooms/${id}/transfer-host`, {
        method: 'POST',
        body: JSON.stringify({ newHostId }),
      }),
    kick: (id: string, targetUserId: string) =>
      request<any>(`/rooms/${id}/kick`, {
        method: 'POST',
        body: JSON.stringify({ targetUserId }),
      }),
    getMessages: (id: string, limit?: number) =>
      request<{ messages: any[] }>(`/rooms/${id}/messages${limit ? `?limit=${limit}` : ''}`),
    sendMessage: (id: string, message: string) =>
      request<any>(`/rooms/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
  },

  // Room Invitations (Phase 2)
  roomInvitations: {
    send: (roomId: string, receiverId: string) =>
      request<any>('/invitations/rooms', {
        method: 'POST',
        body: JSON.stringify({ roomId, receiverId }),
      }),
    getReceived: () => request<{ invitations: any[] }>('/invitations/rooms/received'),
    accept: (id: string) =>
      request<any>(`/invitations/rooms/${id}/accept`, {
        method: 'POST',
      }),
    decline: (id: string) =>
      request<any>(`/invitations/rooms/${id}/decline`, {
        method: 'POST',
      }),
    cancel: (id: string) =>
      request<any>(`/invitations/rooms/${id}/cancel`, {
        method: 'POST',
      }),
  },

  // Game Sessions (Phase 3)
  games: {
    start: (roomId: string, gameId?: string) =>
      request<{
        sessionId: string;
        roomCode: string;
        gameId: string;
        mode: string;
        publicState: any;
        privateState: any;
      }>(`/games/rooms/${roomId}/start`, {
        method: 'POST',
        body: JSON.stringify({ gameId }),
      }),
    getSession: (sessionId: string) =>
      request<{
        sessionId: string;
        gameId: string;
        mode: string;
        publicState: any;
        privateState: any;
      }>(`/games/sessions/${sessionId}`),
    getState: (sessionId: string) =>
      request<{
        sessionId: string;
        publicState: any;
        privateState: any;
      }>(`/games/sessions/${sessionId}/state`),
    rematch: (sessionId: string) =>
      request<{
        sessionId: string;
        gameId: string;
        mode: string;
        publicState: any;
        privateState: any;
      }>(`/games/sessions/${sessionId}/rematch`, {
        method: 'POST',
      }),
    getCatalog: () =>
      request<{ success: boolean; data: Array<{ gameId: string; isEnabled: boolean; coupleEnabled: boolean; friendEnabled: boolean; maintenanceMessage: string | null }> }>('/games/catalog'),
  },

  // Match History (Phase 4)
  matches: {
    getHistory: (params: { gameId?: string; mode?: string; cursor?: string; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.gameId && params.gameId !== 'all') q.set('gameId', params.gameId);
      if (params.mode && params.mode !== 'all') q.set('mode', params.mode);
      if (params.cursor) q.set('cursor', params.cursor);
      if (params.limit) q.set('limit', params.limit.toString());
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<{ success: boolean; data: { matches: any[]; nextCursor: string | null; hasMore: boolean } }>(`/matches/history${queryStr}`);
    },
    getMatch: (matchId: string) =>
      request<{ success: boolean; data: any }>(`/matches/${matchId}`),
  },

  // Player Stats (Phase 4)
  stats: {
    getMyStats: () => request<{ success: boolean; data: any }>('/stats/me'),
    getMyGames: () => request<{ success: boolean; data: any[] }>('/stats/me/games'),
    getMyRecent: () => request<{ success: boolean; data: any[] }>('/stats/me/recent'),
    getUserStats: (userId: string) => request<{ success: boolean; data: any }>(`/stats/users/${userId}`),
    getUserGames: (userId: string) => request<{ success: boolean; data: any[] }>(`/stats/users/${userId}/games`),
  },

  // Rivalry System (Phase 4)
  rivalry: {
    getRivalries: () => request<{ success: boolean; data: any[] }>('/rivalry'),
    getRivalryWithUser: (rivalUserId: string) =>
      request<{ success: boolean; data: any }>(`/rivalry/${rivalUserId}`),
    getRivalryHistory: (rivalUserId: string, limit = 10) =>
      request<{ success: boolean; data: any[] }>(`/rivalry/${rivalUserId}/history?limit=${limit}`),
  },

  // Admin Services (Phase 4)
  admin: {
    getOverview: () => request<{ success: boolean; data: any }>('/admin/overview'),
    getUsers: (params: { search?: string; status?: string; role?: string; limit?: number; offset?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.search) q.set('search', params.search);
      if (params.status && params.status !== 'ALL') q.set('status', params.status);
      if (params.role && params.role !== 'ALL') q.set('role', params.role);
      if (params.limit) q.set('limit', params.limit.toString());
      if (params.offset) q.set('offset', params.offset.toString());
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<{ success: boolean; data: { users: any[]; totalCount: number; limit: number; offset: number } }>(`/admin/users${queryStr}`);
    },
    getUser: (userId: string) => request<{ success: boolean; data: any }>(`/admin/users/${userId}`),
    updateUserStatus: (userId: string, status: 'ACTIVE' | 'SUSPENDED', reason?: string) =>
      request<{ success: boolean; data: any }>(`/admin/users/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      }),
    assignRole: (userId: string, role: 'ADMIN' | 'MODERATOR') =>
      request<{ success: boolean; data: any }>(`/admin/users/${userId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    revokeRole: (userId: string, role: 'ADMIN' | 'MODERATOR') =>
      request<{ success: boolean; data: any }>(`/admin/users/${userId}/roles/${role}`, {
        method: 'DELETE',
      }),
    getGames: () => request<{ success: boolean; data: any[] }>('/admin/games'),
    updateGame: (gameId: string, data: { isEnabled?: boolean; coupleEnabled?: boolean; friendEnabled?: boolean; maintenanceMessage?: string | null }) =>
      request<{ success: boolean; data: any }>(`/admin/games/${gameId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    getQuestions: (params: { gameId?: string; category?: string; intensity?: number; isActive?: boolean; cursor?: string; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.gameId && params.gameId !== 'all') q.set('gameId', params.gameId);
      if (params.category && params.category !== 'all') q.set('category', params.category);
      if (params.intensity) q.set('intensity', params.intensity.toString());
      if (params.isActive !== undefined) q.set('isActive', params.isActive.toString());
      if (params.cursor) q.set('cursor', params.cursor);
      if (params.limit) q.set('limit', params.limit.toString());
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<{ success: boolean; data: { questions: any[]; totalCount: number; nextCursor: string | null; hasMore: boolean } }>(`/admin/questions${queryStr}`);
    },
    createQuestion: (data: any) =>
      request<{ success: boolean; data: any }>('/admin/questions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateQuestion: (questionId: string, data: any) =>
      request<{ success: boolean; data: any }>(`/admin/questions/${questionId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteQuestion: (questionId: string) =>
      request<{ success: boolean; data: any }>(`/admin/questions/${questionId}`, {
        method: 'DELETE',
      }),
    getAuditLogs: (params: { action?: string; actorUserId?: string; targetType?: string; cursor?: string; limit?: number } = {}) => {
      const q = new URLSearchParams();
      if (params.action) q.set('action', params.action);
      if (params.actorUserId) q.set('actorUserId', params.actorUserId);
      if (params.targetType) q.set('targetType', params.targetType);
      if (params.cursor) q.set('cursor', params.cursor);
      if (params.limit) q.set('limit', params.limit.toString());
      const queryStr = q.toString() ? `?${q.toString()}` : '';
      return request<{ success: boolean; data: { logs: any[]; nextCursor: string | null; hasMore: boolean } }>(`/admin/audit-logs${queryStr}`);
    },
    reconcileStats: (userId: string) =>
      request<{ success: boolean; data: any }>(`/admin/reconcile/${userId}`, {
        method: 'POST',
      }),
  },
};


