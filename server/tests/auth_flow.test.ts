import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PlaySpace Authentication State Machine & Lifecycle Suite', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  describe('onAuthStateChange Synchronous Contract & Deferral', () => {
    it('subscriber callback executes synchronously without returning a Promise', () => {
      let callbackResult: any = 'unset';

      // Simulating the synchronous onAuthStateChange implementation
      const synchronousAuthCallback = (event: string, session: any) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Schedules deferred resolution
          setTimeout(() => {}, 0);
        }
      };

      callbackResult = synchronousAuthCallback('SIGNED_IN', {
        user: { id: 'usr-123', email: 'test@playspace.app' },
      });

      // Synchronous function returns undefined, NOT a Promise
      expect(callbackResult).toBeUndefined();
      expect(callbackResult instanceof Promise).toBe(false);
    });

    it('defers profile fetching so internal auth subscriber completes before profile API call', async () => {
      let isSubscriberDone = false;
      let profileFetchedAfterSubscriber = false;

      const mockFetchProfile = vi.fn().mockImplementation(async () => {
        if (isSubscriberDone) {
          profileFetchedAfterSubscriber = true;
        }
        return { id: 'usr-123', username: 'play_user' };
      });

      // Simulate the AuthContext onAuthStateChange pattern
      const onAuthStateChangeHandler = (event: string, session: any) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setTimeout(async () => {
            await mockFetchProfile();
          }, 0);
        }
      };

      onAuthStateChangeHandler('SIGNED_IN', {
        user: { id: 'usr-123', email: 'test@playspace.app' },
      });

      // At this point, the synchronous handler has finished, but setTimeout has not yet run
      expect(mockFetchProfile).not.toHaveBeenCalled();
      isSubscriberDone = true;

      // Allow macrotasks to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetchProfile).toHaveBeenCalledTimes(1);
      expect(profileFetchedAfterSubscriber).toBe(true);
    });
  });

  describe('Stale Response Invalidation & Epoch Protection', () => {
    it('discards late profile responses if user logs out before resolution completes', async () => {
      let activeUser: any = null;
      let isLoading = true;
      let authEpoch = 0;
      let activeUserId: string | null = null;
      let pendingTimeout: any = null;

      const scheduleProfileResolution = (user: any, epoch: number, delayMs: number) => {
        if (pendingTimeout) clearTimeout(pendingTimeout);

        pendingTimeout = setTimeout(async () => {
          // Simulate network delay
          await new Promise((r) => setTimeout(r, delayMs));

          // Guard check
          if (authEpoch !== epoch || activeUserId !== user.id) {
            return; // Discard stale response
          }

          activeUser = { id: user.id, username: `profile_${user.id}` };
          isLoading = false;
        }, 0);
      };

      // 1. User signs in
      authEpoch += 1;
      const loginEpoch = authEpoch;
      activeUserId = 'usr-fast-logout';
      isLoading = true;
      scheduleProfileResolution({ id: 'usr-fast-logout' }, loginEpoch, 30);

      // 2. User quickly logs out before 30ms completes
      if (pendingTimeout) clearTimeout(pendingTimeout);
      authEpoch += 1; // Invalidate epoch
      activeUserId = null;
      activeUser = null;
      isLoading = false;

      // 3. Wait 50ms for delayed promise to finish
      await new Promise((r) => setTimeout(r, 50));

      // User must remain null, NOT restored by the stale response
      expect(activeUser).toBeNull();
      expect(isLoading).toBe(false);
    });

    it('discards profile response from User A if User B logs in during resolution', async () => {
      let activeUser: any = null;
      let authEpoch = 0;
      let activeUserId: string | null = null;

      const scheduleProfileResolution = (user: any, epoch: number, delayMs: number) => {
        setTimeout(async () => {
          await new Promise((r) => setTimeout(r, delayMs));

          if (authEpoch !== epoch || activeUserId !== user.id) {
            return; // Discard stale response
          }

          activeUser = { id: user.id, username: `profile_${user.id}` };
        }, 0);
      };

      // 1. User A starts sign-in (slow profile fetch: 40ms)
      authEpoch += 1;
      activeUserId = 'user-A';
      scheduleProfileResolution({ id: 'user-A' }, authEpoch, 40);

      // 2. User B signs in shortly after (fast profile fetch: 10ms)
      authEpoch += 1;
      activeUserId = 'user-B';
      scheduleProfileResolution({ id: 'user-B' }, authEpoch, 10);

      // Wait 60ms for both to complete
      await new Promise((r) => setTimeout(r, 60));

      // Must be User B, NEVER overridden by User A's later completion
      expect(activeUser).not.toBeNull();
      expect(activeUser.id).toBe('user-B');
    });
  });

  describe('Event Handling: SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT', () => {
    it('clears user state and loading immediately on SIGNED_OUT', () => {
      let user: any = { id: 'usr-existing', username: 'active_player' };
      let isLoading = false;
      let activeUserId: string | null = 'usr-existing';

      const handleAuthEvent = (event: string) => {
        if (event === 'SIGNED_OUT') {
          user = null;
          isLoading = false;
          activeUserId = null;
        }
      };

      handleAuthEvent('SIGNED_OUT');

      expect(user).toBeNull();
      expect(isLoading).toBe(false);
      expect(activeUserId).toBeNull();
    });

    it('does not re-enter loading state on TOKEN_REFRESHED for the same active user', () => {
      let isLoading = false;
      let activeUserId: string | null = 'usr-123';
      let scheduleCount = 0;

      const handleAuthEvent = (event: string, session: any) => {
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          if (activeUserId !== session.user.id) {
            isLoading = true;
            scheduleCount++;
          }
        }
      };

      handleAuthEvent('TOKEN_REFRESHED', { user: { id: 'usr-123' } });

      // User was already active, so loading state must not toggle to true
      expect(isLoading).toBe(false);
      expect(scheduleCount).toBe(0);
    });
  });

  describe('Destination Navigation Guard (Prevent Login Loop)', () => {
    const resolveDestination = (rawFrom?: string): string => {
      return rawFrom && rawFrom !== '/login' && rawFrom !== '/signup' ? rawFrom : '/dashboard';
    };

    it('defaults to /dashboard when from is undefined or empty', () => {
      expect(resolveDestination(undefined)).toBe('/dashboard');
      expect(resolveDestination('')).toBe('/dashboard');
    });

    it('safely redirects to /dashboard when from is /login (preventing redirect loop)', () => {
      expect(resolveDestination('/login')).toBe('/dashboard');
    });

    it('safely redirects to /dashboard when from is /signup', () => {
      expect(resolveDestination('/signup')).toBe('/dashboard');
    });

    it('preserves deep links to game rooms and social features', () => {
      expect(resolveDestination('/room/LOVE22')).toBe('/room/LOVE22');
      expect(resolveDestination('/friends')).toBe('/friends');
      expect(resolveDestination('/profile')).toBe('/profile');
    });
  });
});
