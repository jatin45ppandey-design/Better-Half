import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import type { User, AuthState } from '../types/auth';

interface AuthContextType extends AuthState {
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  // Backward compatibility signatures for existing consumers during transition
  login: (email?: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name?: string, email?: string, password?: string) => Promise<{ success: boolean; error?: string }>;
}

type SupabaseUserLike = {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function createSessionFallbackUser(supabaseUser: SupabaseUserLike): User {
  const metadata = supabaseUser.user_metadata || {};
  const rawName =
    metadata.full_name ||
    metadata.name ||
    supabaseUser.email?.split('@')[0] ||
    'PlaySpace Player';
  const name = String(rawName).trim() || 'PlaySpace Player';
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'PL';

  return {
    id: supabaseUser.id,
    name,
    email: supabaseUser.email || '',
    username: String(metadata.preferred_username || supabaseUser.email?.split('@')[0] || 'player'),
    avatarInitials: initials,
    avatarColor: '#9670E8',
    bio: '',
    preferredMode: 'couple',
    isDevMock: false,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(false);
  const authEpochRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);
  const pendingProfileTimeoutRef = useRef<number | null>(null);

  const fetchUserProfile = useCallback(async (supabaseUser: SupabaseUserLike): Promise<User> => {
    const fallbackUser = createSessionFallbackUser(supabaseUser);

    try {
      const profile = await api.profiles.getMe();

      // Never attach a profile belonging to a different authenticated user.
      if (profile.id !== supabaseUser.id) {
        console.error('[Auth] Backend returned a profile for a different user.');
        return fallbackUser;
      }

      return {
        ...fallbackUser,
        id: profile.id,
        name: profile.displayName || fallbackUser.name,
        username: profile.username || fallbackUser.username,
        avatarInitials: profile.avatarInitials || fallbackUser.avatarInitials,
        avatarColor: profile.avatarColor || fallbackUser.avatarColor,
        bio: profile.bio || '',
      };
    } catch (err) {
      // Profile hydration is not authentication. Keep the verified Supabase session
      // active and allow the user into the app while the backend issue is visible.
      console.warn('[Auth] Profile hydration failed; retaining Supabase session user.', err);
      return fallbackUser;
    }
  }, []);

  useEffect(() => {
    // Keep the active flag local to this effect instance. React StrictMode mounts,
    // cleans up, and mounts effects again in development; a shared mounted ref alone
    // cannot distinguish async work left over from the first effect instance.
    let effectActive = true;
    mountedRef.current = true;

    const clearPendingProfileTimeout = () => {
      if (pendingProfileTimeoutRef.current !== null) {
        window.clearTimeout(pendingProfileTimeoutRef.current);
        pendingProfileTimeoutRef.current = null;
      }
    };

    const clearSession = () => {
      clearPendingProfileTimeout();
      authEpochRef.current += 1;
      activeUserIdRef.current = null;
      if (effectActive && mountedRef.current) {
        setUser(null);
        setError(null);
        setIsLoading(false);
      }
    };

    const applySession = (supabaseUser: SupabaseUserLike, forceProfileRefresh = false) => {
      if (!supabaseUser?.id || !effectActive || !mountedRef.current) return;

      const isSameUser = activeUserIdRef.current === supabaseUser.id;
      if (isSameUser && !forceProfileRefresh) {
        // The session is already established. Do not let token refreshes restart
        // profile hydration or put a visible page back into its loading state.
        setIsLoading(false);
        return;
      }

      clearPendingProfileTimeout();
      authEpochRef.current += 1;
      const requestEpoch = authEpochRef.current;
      activeUserIdRef.current = supabaseUser.id;

      // Establish authentication immediately from the verified Supabase session.
      // Do not make route access depend on a separate profile API request.
      setUser(createSessionFallbackUser(supabaseUser));
      setError(null);
      setIsLoading(false);

      // Supabase's auth callback must return synchronously. Profile hydration runs
      // after it has returned, and can only enrich the same still-active session.
      pendingProfileTimeoutRef.current = window.setTimeout(() => {
        pendingProfileTimeoutRef.current = null;

        void fetchUserProfile(supabaseUser)
          .then((profileUser) => {
            if (
              !effectActive ||
              !mountedRef.current ||
              authEpochRef.current !== requestEpoch ||
              activeUserIdRef.current !== supabaseUser.id
            ) {
              return;
            }

            setUser(profileUser);
            setError(null);
          })
          .catch((err: unknown) => {
            if (
              effectActive &&
              mountedRef.current &&
              authEpochRef.current === requestEpoch &&
              activeUserIdRef.current === supabaseUser.id
            ) {
              console.error('[Auth] Unexpected profile hydration failure:', err);
              setError('Your account is signed in, but your player profile could not be refreshed.');
            }
          });
      }, 0);
    };

    // The listener handles SDK auth events, while getSession below provides
    // an explicit recovery path for an already-persisted session. Whichever
    // resolves first wins; an older startup read must never override an auth event.
    let authEventHandled = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // This callback intentionally stays synchronous. Do not await Supabase calls
      // or API requests from inside onAuthStateChange.
      if (!effectActive || !mountedRef.current) return;

      if (event === 'INITIAL_SESSION') {
        authEventHandled = true;
        if (session?.user) {
          applySession(session.user as SupabaseUserLike);
        } else {
          clearSession();
        }
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY') {
        authEventHandled = true;
        if (session?.user) {
          applySession(session.user as SupabaseUserLike, event === 'USER_UPDATED');
        }
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        authEventHandled = true;
        if (session?.user) {
          // Only re-establish state if the identity actually changed. Normal token
          // refreshes must not cause profile-fetch loops.
          applySession(session.user as SupabaseUserLike);
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        authEventHandled = true;
        clearSession();
      }
    });

    // Explicit startup session restoration. Supabase also emits INITIAL_SESSION,
    // but this protects against a missed/late initial notification and retains
    // the session that was persisted before the OAuth redirect.
    void supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!effectActive || !mountedRef.current || authEventHandled) return;
        if (sessionError) throw sessionError;

        if (data.session?.user) {
          applySession(data.session.user as SupabaseUserLike);
        } else {
          clearSession();
        }
      })
      .catch((err: unknown) => {
        if (!effectActive || !mountedRef.current || authEventHandled) return;
        console.error('[Auth] Initial session restoration failed:', err);
        setError(err instanceof Error ? err.message : 'Failed to restore authentication session');
        setIsLoading(false);
      });

    return () => {
      effectActive = false;
      mountedRef.current = false;
      authEpochRef.current += 1;
      activeUserIdRef.current = null;
      clearPendingProfileTimeout();
      subscription.unsubscribe();
    };
  }, [fetchUserProfile]);

  const refreshProfile = useCallback(async () => {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.user || !mountedRef.current) return;
      if (activeUserIdRef.current !== session.user.id) return;

      const requestEpoch = authEpochRef.current;
      const updatedUser = await fetchUserProfile(session.user as SupabaseUserLike);

      if (
        updatedUser &&
        mountedRef.current &&
        authEpochRef.current === requestEpoch &&
        activeUserIdRef.current === session.user.id
      ) {
        setUser(updatedUser);
      }
    } catch (err) {
      console.error('[Auth] Error refreshing profile:', err);
    }
  }, [fetchUserProfile]);

  const loginWithGoogle = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const redirectUrl = new URL('/auth/callback', window.location.origin).toString();
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

      if (oauthError) throw oauthError;
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || 'Failed to sign in with Google');
        setIsLoading(false);
      }
      throw err;
    }
  };

  const logout = async () => {
    if (pendingProfileTimeoutRef.current !== null) {
      window.clearTimeout(pendingProfileTimeoutRef.current);
      pendingProfileTimeoutRef.current = null;
    }
    authEpochRef.current += 1;
    activeUserIdRef.current = null;

    if (mountedRef.current) {
      setUser(null);
      setIsLoading(false);
      setError(null);
    }

    try {
      socketService.disconnect();
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
    } catch (err) {
      console.error('[Auth] Logout error:', err);
      if (mountedRef.current) {
        setError('Could not complete sign out. Please try again.');
      }
    }
  };

  // Backward-compatible fallback for components still invoking login / signup.
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
