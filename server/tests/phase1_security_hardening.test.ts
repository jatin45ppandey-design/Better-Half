import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { gameSessionService } from '../src/modules/games/core/gameSession.service.js';
import { gameStateService } from '../src/modules/games/core/gameState.service.js';
import { generateRoomCode } from '../src/modules/rooms/rooms.constants.js';
import { roomsService } from '../src/modules/rooms/rooms.service.js';
import {
  recordFailedRoomLookup,
  isRoomLookupBlocked,
  resetRoomLookupTracker,
  MemoryRateLimitStore,
} from '../src/middleware/rateLimiter.js';
import { socketAuthMiddleware } from '../src/socket/authMiddleware.js';
import {
  requireAuth,
  enableTestAuth,
  disableTestAuth,
  setInjectedMockAuthVerifier,
} from '../src/middleware/auth.js';

describe('Phase 1 — Critical Security, Authentication & Socket Protection', () => {
  const userA = { id: 'usr-p1-a', username: 'player_a', displayName: 'Player A' };
  const userB = { id: 'usr-p1-b', username: 'player_b', displayName: 'Player B' };

  beforeEach(() => {
    vi.restoreAllMocks();
    resetRoomLookupTracker();
    enableTestAuth();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetRoomLookupTracker();
    enableTestAuth();
  });

  describe('1. Atomic, Status-Conditional Game Session Pause/Resume Lifecycle', () => {
    const sessionId = 'session-pause-resume-test-1';

    function setupMockSession(status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED') {
      const context = {
        sessionId,
        gameId: 'tic-tac-toe',
        mode: 'COUPLE' as const,
        participants: [
          { userId: userA.id, seatIndex: 0, isHost: true, isConnected: true },
          { userId: userB.id, seatIndex: 1, isHost: false, isConnected: true },
        ],
        state: { board: [null, null, null, null, null, null, null, null, null] },
        privateStates: {},
        version: 5,
        isPaused: status === 'PAUSED',
        status,
        scores: { [userA.id]: 0, [userB.id]: 0 },
        roomId: 'room-test-1',
        startedAt: new Date(),
      };
      gameStateService.setSession(sessionId, context as any);
      return context;
    }

    it('successfully pauses an ACTIVE session and increments version', async () => {
      setupMockSession('ACTIVE');

      const updateManySpy = vi.spyOn(prisma.gameSession, 'updateMany').mockResolvedValueOnce({ count: 1 });

      const updated = await gameSessionService.pauseSession(sessionId, userA.id);

      expect(updateManySpy).toHaveBeenCalledWith({
        where: { id: sessionId, status: 'ACTIVE', stateVersion: 5 },
        data: {
          status: 'PAUSED',
          stateVersion: 6,
        },
      });
      expect(updated.status).toBe('PAUSED');
      expect(updated.isPaused).toBe(true);
      expect(updated.version).toBe(6);
    });

    it('rejects pausing an already PAUSED session with 409 Conflict', async () => {
      setupMockSession('PAUSED');

      const updateManySpy = vi.spyOn(prisma.gameSession, 'updateMany');

      await expect(gameSessionService.pauseSession(sessionId, userA.id)).rejects.toThrow(
        /Cannot pause session in 'PAUSED' state/
      );
      expect(updateManySpy).not.toHaveBeenCalled();
    });

    it('rejects pausing a COMPLETED or ABANDONED session with 409 Conflict', async () => {
      setupMockSession('COMPLETED');
      await expect(gameSessionService.pauseSession(sessionId, userA.id)).rejects.toThrow(
        /Cannot pause session in 'COMPLETED' state/
      );

      setupMockSession('ABANDONED');
      await expect(gameSessionService.pauseSession(sessionId, userA.id)).rejects.toThrow(
        /Cannot pause session in 'ABANDONED' state/
      );
    });

    it('successfully resumes a PAUSED session and increments version', async () => {
      setupMockSession('PAUSED');

      const updateManySpy = vi.spyOn(prisma.gameSession, 'updateMany').mockResolvedValueOnce({ count: 1 });

      const updated = await gameSessionService.resumeSession(sessionId, userA.id);

      expect(updateManySpy).toHaveBeenCalledWith({
        where: { id: sessionId, status: 'PAUSED', stateVersion: 5 },
        data: {
          status: 'ACTIVE',
          stateVersion: 6,
        },
      });
      expect(updated.status).toBe('ACTIVE');
      expect(updated.isPaused).toBe(false);
      expect(updated.version).toBe(6);
    });

    it('rejects resuming an already ACTIVE session with 409 Conflict', async () => {
      setupMockSession('ACTIVE');

      const updateManySpy = vi.spyOn(prisma.gameSession, 'updateMany');

      await expect(gameSessionService.resumeSession(sessionId, userA.id)).rejects.toThrow(
        /Cannot resume session in 'ACTIVE' state/
      );
      expect(updateManySpy).not.toHaveBeenCalled();
    });

    it('throws 409 Conflict when concurrent database modification conflicts during pause or resume', async () => {
      setupMockSession('ACTIVE');
      vi.spyOn(prisma.gameSession, 'updateMany').mockResolvedValueOnce({ count: 0 });

      await expect(gameSessionService.pauseSession(sessionId, userA.id)).rejects.toThrow(
        /Conflict: Session.*state version changed concurrently/
      );

      setupMockSession('PAUSED');
      vi.spyOn(prisma.gameSession, 'updateMany').mockResolvedValueOnce({ count: 0 });

      await expect(gameSessionService.resumeSession(sessionId, userA.id)).rejects.toThrow(
        /Conflict: Session.*state version changed concurrently/
      );
    });
  });

  describe('2. Test/Mock Token Isolation & Explicit Injected Dependency', () => {
    it('socketAuthMiddleware strictly rejects test-mock-token-* when no test provider is injected even if NODE_ENV is test', async () => {
      expect(process.env.NODE_ENV).toBe('test');
      disableTestAuth(); // remove injected provider

      const mockSocket: any = {
        handshake: {
          auth: { token: 'test-mock-token-adversary-uuid' },
          headers: {},
        },
        data: {},
      };

      let capturedError: Error | undefined;
      await socketAuthMiddleware(mockSocket, (err) => {
        capturedError = err;
      });

      expect(capturedError).toBeDefined();
      expect(capturedError?.message).toContain('Mock tokens are strictly forbidden (no test provider injected)');
    });

    it('requireAuth HTTP middleware strictly rejects test-mock-token-* when no test provider is injected', async () => {
      disableTestAuth();

      const mockReq: any = {
        headers: { authorization: 'Bearer test-mock-token-adversary-uuid' },
      };
      let responseStatus = 0;
      let responseBody: any = null;
      const mockRes: any = {
        status: (s: number) => {
          responseStatus = s;
          return {
            json: (b: any) => {
              responseBody = b;
            },
          };
        },
      };
      const mockNext = vi.fn();

      await requireAuth(mockReq, mockRes, mockNext);

      expect(responseStatus).toBe(401);
      expect(responseBody?.message).toContain('no test authentication provider is injected in this runtime');
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('strictly forbids injecting mock auth verifiers when NODE_ENV is production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        expect(() => {
          setInjectedMockAuthVerifier(() => ({ id: 'hacked', email: 'hacked@example.com' }));
        }).toThrow(/Cannot inject mock authentication verifiers in a production environment/);
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('socketAuthMiddleware strictly rejects test-mock-token-* in production environment', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const mockSocket: any = {
          handshake: {
            auth: { token: 'test-mock-token-adversary-uuid' },
            headers: {},
          },
          data: {},
        };

        let capturedError: Error | undefined;
        await socketAuthMiddleware(mockSocket, (err) => {
          capturedError = err;
        });

        expect(capturedError).toBeDefined();
        expect(capturedError?.message).toContain('Mock tokens are strictly forbidden');
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it('socketAuthMiddleware allows test-mock-token-* when test auth provider is explicitly injected', async () => {
      enableTestAuth();

      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValueOnce({
        id: 'user-test-valid',
        accountStatus: 'ACTIVE',
      } as any);

      vi.spyOn(prisma.userSettings, 'findUnique').mockResolvedValueOnce({
        showOnlineStatus: true,
        ghostMode: false,
      } as any);

      const mockSocket: any = {
        handshake: {
          auth: { token: 'test-mock-token-user-test-valid' },
          headers: {},
        },
        data: {},
      };

      let capturedError: Error | undefined;
      await socketAuthMiddleware(mockSocket, (err) => {
        capturedError = err;
      });

      expect(capturedError).toBeUndefined();
      expect(mockSocket.data.userId).toBe('user-test-valid');
      expect(mockSocket.data.accountStatus).toBe('ACTIVE');
    });
  });

  describe('3. Cryptographically Secure Room Code Generation & Collision Retries', () => {
    it('generates 6-character room codes from the safe alphanumeric alphabet', () => {
      const code = generateRoomCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
      expect(code).not.toMatch(/[01IO]/);
    });

    it('throws 503 instead of falling back to a predictable timestamp when collisions exceed retry limit', async () => {
      vi.spyOn(roomsService as any, 'assertGameEnabledForMode').mockResolvedValue(undefined);
      // Simulate persistent collision on every attempt
      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue({ id: 'existing-room' } as any);

      await expect(
        roomsService.createRoom(
          'host-user-id',
          { mode: 'couple', selectedGameId: 'tic-tac-toe' }
        )
      ).rejects.toThrow(/Unable to generate unique room code due to collision limit/);
    });
  });

  describe('4. Room-Code Brute-Force Protection & Rate Limiting Bounded Stores', () => {
    it('progressively blocks an actor key after repeated room lookup failures', () => {
      const actorKey = 'test-attacker-ip-1';

      expect(isRoomLookupBlocked(actorKey).blocked).toBe(false);

      // Record 5 failures -> 1 minute block
      for (let i = 0; i < 5; i++) {
        recordFailedRoomLookup(actorKey);
      }

      const check1 = isRoomLookupBlocked(actorKey);
      expect(check1.blocked).toBe(true);
      expect(check1.retryAfterSeconds).toBeGreaterThan(0);
      expect(check1.retryAfterSeconds).toBeLessThanOrEqual(60);
    });

    it('MemoryRateLimitStore limits map size and evicts oldest keys when maxEntries exceeded', () => {
      const store = new MemoryRateLimitStore(60000, 3);

      store.set('key1', { count: 1, resetAt: Date.now() + 60000 });
      store.set('key2', { count: 1, resetAt: Date.now() + 60000 });
      store.set('key3', { count: 1, resetAt: Date.now() + 60000 });

      expect(store.get('key1')).toBeDefined();

      // Adding 4th key should evict oldest (key1)
      store.set('key4', { count: 1, resetAt: Date.now() + 60000 });

      expect(store.get('key1')).toBeUndefined();
      expect(store.get('key4')).toBeDefined();
    });
  });
});
