export interface User {
  id: string;
  name: string;
  email: string;
  username: string;
  avatarInitials: string;
  avatarColor: string;
  bio?: string;
  preferredMode?: 'couple' | 'friend';
  isDevMock?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error?: string | null;
}
