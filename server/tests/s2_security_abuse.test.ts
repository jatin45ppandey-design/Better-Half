import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import {
  rateLimiter,
  recordFailedRoomLookup,
  isRoomLookupBlocked,
  resetRoomLookupTracker,
} from '../src/middleware/rateLimiter.js';

const app = createApp();

describe('PlaySpace Wave 2 — S2 Authentication, Realtime Security & Abuse Prevention', () => {
  beforeEach(() => {
    resetRoomLookupTracker();
    vi.restoreAllMocks();
  });

  describe('HTTP Authentication & Privilege Boundaries', () => {
    it('rejects requests missing Bearer token with 401', async () => {
      const res = await request(app).get('/api/v1/profiles/me');
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('Missing or malformed Authorization header');
    });

    it('rejects empty or malformed Bearer tokens with 401', async () => {
      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', 'Bearer');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('blocks suspended user accounts with 403 and ACCOUNT_SUSPENDED code', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue({
        id: 'suspended-user-s2',
        accountStatus: 'SUSPENDED',
      } as any);

      const res = await request(app)
        .patch('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-suspended-user-s2')
        .send({ displayName: 'Hacker' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_SUSPENDED');
      expect(res.body.error).toContain('Your account has been suspended');
    });
  });

  describe('Rate Limiting & Abuse Prevention', () => {
    it('sets standard rate limit headers on throttled endpoints', async () => {
      const testLimiter = rateLimiter({
        windowMs: 60000,
        max: 2,
        skipInTest: false,
      });

      const mockReq: any = { ip: '127.0.0.1', socket: {} };
      const headers: Record<string, any> = {};
      const mockRes: any = {
        setHeader: (key: string, val: any) => {
          headers[key] = val;
        },
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      // First request
      testLimiter(mockReq, mockRes, next);
      expect(headers['X-RateLimit-Limit']).toBe(2);
      expect(headers['X-RateLimit-Remaining']).toBe(1);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request
      testLimiter(mockReq, mockRes, next);
      expect(headers['X-RateLimit-Remaining']).toBe(0);
      expect(next).toHaveBeenCalledTimes(2);

      // Third request -> 429
      testLimiter(mockReq, mockRes, next);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too Many Requests',
          retryAfter: expect.any(Number),
        })
      );
      expect(headers['Retry-After']).toBeDefined();
    });

    it('enforces progressive cooldown on repeated room code lookup failures', () => {
      const targetKey = 'attacker-ip-1';

      expect(isRoomLookupBlocked(targetKey).blocked).toBe(false);

      // Record 4 failed attempts -> still not blocked
      for (let i = 0; i < 4; i++) {
        recordFailedRoomLookup(targetKey);
      }
      expect(isRoomLookupBlocked(targetKey).blocked).toBe(false);

      // 5th failure -> triggers first cooldown tier (1 minute)
      recordFailedRoomLookup(targetKey);
      const status5 = isRoomLookupBlocked(targetKey);
      expect(status5.blocked).toBe(true);
      expect(status5.retryAfterSeconds).toBeGreaterThan(0);
      expect(status5.retryAfterSeconds).toBeLessThanOrEqual(60);

      // Simulate 10 failures -> 5 minute tier
      for (let i = 0; i < 5; i++) {
        recordFailedRoomLookup(targetKey);
      }
      const status10 = isRoomLookupBlocked(targetKey);
      expect(status10.blocked).toBe(true);
      expect(status10.retryAfterSeconds).toBeGreaterThan(60);
      expect(status10.retryAfterSeconds).toBeLessThanOrEqual(300);
    });
  });
});
