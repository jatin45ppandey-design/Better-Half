import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../services/api';
import type { User, AuthState } from '../types/auth';

interface AuthContextType extends AuthState {
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setDevUser: (mode?: 'couple' | 'friend') => void;
  // Backward compatibility signatures for existing consumers during transition
  login: (email?: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name?: string, email?: string, password?: string) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserProfile = useCallback(async (supabaseUser: any): Promise<User | null> => {
    try {
      const profile = await api.profiles.getMe();
      return {
        id: profile.id,
        name: profile.displayName || supabaseUser.user_metadata?.full_name || 'PlaySpace Player',
        email: supabaseUser.email || '',
        username: profile.username,
        avatarInitials: profile.avatarInitials || 'PL',
        avatarColor: profile.avatarColor || '#9670E8',
        bio: profile.bio || '',
        preferredMode: 'couple',
        isDevMock: false,
      };
    } catch (err) {
      console.warn('Backend profile fetch failed, using Supabase session data:', err);
      // Fallback to Supabase metadata if backend database is cold or bootstrapping
      const name =
        supabaseUser.user_metadata?.full_name ||
        supabaseUser.user_metadata?.name ||
        supabaseUser.email?.split('@')[0] ||
        'PlaySpace Player';

      const initials =
        name
          .split(' ')
          .map((n: string) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase() || 'PL';

      return {
        id: supabaseUser.id,
        name,
        email: supabaseUser.email || '',
        username: supabaseUser.user_metadata?.preferred_username || supabaseUser.email?.split('@')[0] || 'player',
        avatarInitials: initials,
        avatarColor: '#9670E8',
        bio: '',
        preferredMode: 'couple',
        isDevMock: false,
      };
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const updatedUser = await fetchUserProfile(session.user);
      if (updatedUser) {
        setUser(updatedUser);
      }
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }

        if (session?.user && isMounted) {
          const profileUser = await fetchUserProfile(session.user);
          if (isMounted) {
            setUser(profileUser);
          }
        }
      } catch (err: any) {
        console.error('Error restoring Supabase session:', err);
        if (isMounted) {
          setError(err.message || 'Failed to restore authentication session');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const profileUser = await fetchUserProfile(session.user);
          if (isMounted) {
            setUser(profileUser);
            setIsLoading(false);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const loginWithGoogle = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/dashboard`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
      setIsLoading(false);
      throw err;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Backward-compatible fallback for components still invoking login / signup
  const login = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await loginWithGoogle();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const signup = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      await loginWithGoogle();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const setDevUser = (mode?: 'couple' | 'friend') => {
    if (user) {
      setUser({ ...user, preferredMode: mode || user.preferredMode || 'couple' });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        loginWithGoogle,
        logout,
        refreshProfile,
        setDevUser,
        login,
        signup,
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
