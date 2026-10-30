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

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
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
};

