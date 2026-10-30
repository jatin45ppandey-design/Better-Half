import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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

  // Lifecycles & concurrency guards
  const isMountedRef = useRef<boolean>(true);
  const authEpochRef = useRef<number>(0);
  const pendingProfileTimeoutRef = useRef<number | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  const clearPendingProfileTimeout = () => {
    if (pendingProfileTimeoutRef.current !== null) {
      window.clearTimeout(pendingProfileTimeoutRef.current);
      pendingProfileTimeoutRef.current = null;
    }
  };

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

  const scheduleProfileResolution = useCallback(
    (supabaseUser: any, epoch: number) => {
      clearPendingProfileTimeout();

      // Defer profile fetching using window.setTimeout(..., 0) so onAuthStateChange returns synchronously
      pendingProfileTimeoutRef.current = window.setTimeout(async () => {
        try {
          const profileUser = await fetchUserProfile(supabaseUser);

          // Guard against component unmount, expired auth epoch, or switched user
          if (
            !isMountedRef.current ||
            authEpochRef.current !== epoch ||
            activeUserIdRef.current !== supabaseUser.id
          ) {
            return;
          }

          if (profileUser) {
            setUser(profileUser);
            setError(null);
          }
        } catch (err: any) {
          console.error('Error in deferred profile resolution:', err);
          if (isMountedRef.current && authEpochRef.current === epoch) {
            setError(err.message || 'Failed to load user profile');
          }
        } finally {
          if (isMountedRef.current && authEpochRef.current === epoch) {
            setIsLoading(false);
            pendingProfileTimeoutRef.current = null;
          }
        }
      }, 0);
    },
    [fetchUserProfile]
  );

  const refreshProfile = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user && isMountedRef.current) {
        const updatedUser = await fetchUserProfile(session.user);
        if (
          updatedUser &&
          isMountedRef.current &&
          activeUserIdRef.current === session.user.id
        ) {
          setUser(updatedUser);
        }
      }
    } catch (err: any) {
      console.error('Error refreshing profile:', err);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
    isMountedRef.current = true;

    // Preserved initial session restoration flow
    async function initAuth() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (session?.user && isMountedRef.current) {
          if (activeUserIdRef.current !== session.user.id) {
            authEpochRef.current += 1;
            const currentEpoch = authEpochRef.current;
            activeUserIdRef.current = session.user.id;

            const profileUser = await fetchUserProfile(session.user);
            if (
              isMountedRef.current &&
              authEpochRef.current === currentEpoch &&
              activeUserIdRef.current === session.user.id
            ) {
              setUser(profileUser);
              setError(null);
            }
          }
        }
      } catch (err: any) {
        console.error('Error restoring Supabase session:', err);
        if (isMountedRef.current) {
          setError(err.message || 'Failed to restore authentication session');
        }
      } finally {
        // Only set loading false if no deferred profile resolution is queued
        if (isMountedRef.current && pendingProfileTimeoutRef.current === null) {
          setIsLoading(false);
        }
      }
    }

    initAuth();

    // 1. Synchronous callback for onAuthStateChange.
    // 2. Never await fetchUserProfile, getSession, or any other Supabase operation inside this callback.
    // 3. Defer profile resolution using window.setTimeout(..., 0).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMountedRef.current) return;

      if (event === 'SIGNED_IN') {
        if (session?.user) {
          authEpochRef.current += 1;
          const currentEpoch = authEpochRef.current;
          activeUserIdRef.current = session.user.id;
          if (isMountedRef.current) {
            setIsLoading(true);
          }
          scheduleProfileResolution(session.user, currentEpoch);
        }
      } else if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          if (activeUserIdRef.current !== session.user.id) {
            authEpochRef.current += 1;
            const currentEpoch = authEpochRef.current;
            activeUserIdRef.current = session.user.id;
            scheduleProfileResolution(session.user, currentEpoch);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        clearPendingProfileTimeout();
        authEpochRef.current += 1;
        activeUserIdRef.current = null;
        if (isMountedRef.current) {
          setUser(null);
          setIsLoading(false);
        }
      }
    });

    return () => {
      isMountedRef.current = false;
      clearPendingProfileTimeout();
      subscription.unsubscribe();
    };
  }, [fetchUserProfile, scheduleProfileResolution]);

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
      if (isMountedRef.current) {
        setError(err.message || 'Failed to sign in with Google');
        setIsLoading(false);
      }
      throw err;
    }
  };

  const logout = async () => {
    setIsLoading(true);
    clearPendingProfileTimeout();
    authEpochRef.current += 1;
    activeUserIdRef.current = null;
    try {
      await supabase.auth.signOut();
      if (isMountedRef.current) {
        setUser(null);
      }
    } catch (err: any) {
      console.error('Logout error:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
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
