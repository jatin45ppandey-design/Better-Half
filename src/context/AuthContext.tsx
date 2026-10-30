import React, { createContext, useContext, useState } from 'react';
import type { User, AuthState } from '../types/auth';

interface AuthContextType extends AuthState {
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setDevUser: (mode?: 'couple' | 'friend') => void;
}

const DEFAULT_MOCK_USER: User = {
  id: 'dev-user-01',
  name: 'Alex Rivera',
  email: 'alex.rivera@example.com',
  avatarInitials: 'AR',
  avatarColor: 'bg-[#9670E8]',
  preferredMode: 'couple',
  isDevMock: true,
};

const DEV_STORAGE_KEY = 'playspace_dev_mock_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(DEV_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const login = async (email: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    // Simulate brief network delay
    await new Promise((r) => setTimeout(r, 400));

    if (!email || !email.includes('@')) {
      setIsLoading(false);
      return { success: false, error: 'Please enter a valid email address.' };
    }

    // Extract display name from email
    const namePart = email.split('@')[0];
    const formattedName = namePart
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

    const initials = formattedName
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'PL';

    const newUser: User = {
      id: `dev-user-${Date.now()}`,
      name: formattedName || 'PlaySpace Player',
      email,
      avatarInitials: initials,
      avatarColor: 'bg-[#9670E8]',
      preferredMode: 'couple',
      isDevMock: true,
    };

    setUser(newUser);
    try {
      localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(newUser));
    } catch {
      // ignore storage failure in dev
    }
    setIsLoading(false);
    return { success: true };
  };

  const signup = async (
    name: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    await new Promise((r) => setTimeout(r, 450));

    if (!name.trim()) {
      setIsLoading(false);
      return { success: false, error: 'Name is required.' };
    }
    if (!email || !email.includes('@')) {
      setIsLoading(false);
      return { success: false, error: 'Valid email is required.' };
    }

    const initials = name
      .trim()
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'PL';

    const newUser: User = {
      id: `dev-user-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      avatarInitials: initials,
      avatarColor: 'bg-[#865CE3]',
      preferredMode: 'couple',
      isDevMock: true,
    };

    setUser(newUser);
    try {
      localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(newUser));
    } catch {
      // ignore storage failure
    }
    setIsLoading(false);
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem(DEV_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const setDevUser = (mode?: 'couple' | 'friend') => {
    const updatedUser: User = {
      ...DEFAULT_MOCK_USER,
      preferredMode: mode || DEFAULT_MOCK_USER.preferredMode,
    };
    setUser(updatedUser);
    try {
      localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(updatedUser));
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        setDevUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// oxlint-disable-next-line react/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
