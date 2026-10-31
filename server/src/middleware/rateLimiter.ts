import { Request, Response, NextFunction } from 'express';

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

/**
 * Interface for distributed rate limit stores (e.g. Redis, Postgres, or In-Memory).
 * In single-instance Render deployments, MemoryRateLimitStore provides zero-latency in-memory tracking.
 * For horizontally-scaled clusters, an adapter implementing IRateLimitStore (e.g. RedisRateLimitStore)
 * can be plugged in without changing middleware semantics.
 */
export interface IRateLimitStore {
  get(key: string): Promise<RateLimitRecord | undefined> | RateLimitRecord | undefined;
  set(key: string, record: RateLimitRecord): Promise<void> | void;
  delete(key: string): Promise<void> | void;
}

export class MemoryRateLimitStore implements IRateLimitStore {
  private map = new Map<string, RateLimitRecord>();

  constructor(cleanupIntervalMs = 120000) {
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.map.entries()) {
        if (now > record.resetAt) {
          this.map.delete(key);
        }
      }
    }, cleanupIntervalMs).unref();
  }

  get(key: string): RateLimitRecord | undefined {
    return this.map.get(key);
  }

  set(key: string, record: RateLimitRecord): void {
    this.map.set(key, record);
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export function getClientIp(req: Request): string {
  // When 'trust proxy' is configured in Express, req.ip authoritatively resolves
  // the client IP through the trusted reverse proxy without trusting spoofed headers.
  if (req.ip) {
    return req.ip;
  }
  const forwarded = req.headers ? req.headers['x-forwarded-for'] : undefined;
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export interface RateLimiterOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skipInTest?: boolean;
  store?: IRateLimitStore;
}

/**
 * Standard rate limiter with Render reverse-proxy IP handling,
 * pluggable store adapter, and standard RateLimit response headers.
 */
export function rateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const max = options.max || 120; // 120 requests per window default
  const message = options.message || 'Too many requests, please try again later.';
  const skipInTest = options.skipInTest ?? true;
  const store = options.store || new MemoryRateLimitStore(windowMs * 2);

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, skip throttling unless explicitly enabled
    if (skipInTest && process.env.NODE_ENV === 'test') {
      next();
      return;
    }

    const key = options.keyGenerator
      ? options.keyGenerator(req)
      : (req.user?.id || getClientIp(req));

    const now = Date.now();
    const handleRecord = (record: RateLimitRecord | undefined): void => {
      if (!record || now > record.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', max - 1);
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + windowMs) / 1000));
        next();
        return;
      }

      record.count += 1;
      store.set(key, record);
      const remaining = Math.max(0, max - record.count);
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);

      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetAt / 1000));

      if (record.count > max) {
        res.setHeader('Retry-After', retryAfter);
        res.status(429).json({
          error: 'Too Many Requests',
          message,
          retryAfter,
        });
        return;
      }

      next();
    };

    const maybePromise = store.get(key);
    if (maybePromise && typeof (maybePromise as any).then === 'function') {
      (maybePromise as Promise<RateLimitRecord | undefined>)
        .then(handleRecord)
        .catch(next);
    } else {
      handleRecord(maybePromise as RateLimitRecord | undefined);
    }
  };
}

// -------------------------------------------------------------
// Progressive Room-Code Brute-Force Tracker
// -------------------------------------------------------------
interface ProgressiveCooldown {
  failureCount: number;
  blockedUntil: number;
}
const bruteForceMap = new Map<string, ProgressiveCooldown>();

export function recordFailedRoomLookup(key: string): void {
  const now = Date.now();
  const entry = bruteForceMap.get(key) || { failureCount: 0, blockedUntil: 0 };
  entry.failureCount += 1;

  if (entry.failureCount >= 15) {
    entry.blockedUntil = now + 15 * 60 * 1000; // 15 minutes
  } else if (entry.failureCount >= 10) {
    entry.blockedUntil = now + 5 * 60 * 1000; // 5 minutes
  } else if (entry.failureCount >= 5) {
    entry.blockedUntil = now + 60 * 1000; // 1 minute cooldown
  }
  bruteForceMap.set(key, entry);
}

export function isRoomLookupBlocked(key: string): { blocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = bruteForceMap.get(key);
  if (!entry || now > entry.blockedUntil) {
    if (entry && now > entry.blockedUntil && entry.failureCount >= 5) {
      // Cooldown expired; decay failures
      entry.failureCount = Math.max(0, entry.failureCount - 5);
      entry.blockedUntil = 0;
    }
    return { blocked: false, retryAfterSeconds: 0 };
  }
  const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
  return { blocked: true, retryAfterSeconds };
}

export function resetRoomLookupTracker(): void {
  bruteForceMap.clear();
}

// -------------------------------------------------------------
// Specialized Rate Limiters for Attack Surfaces
// -------------------------------------------------------------
export const roomCreateLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Room creation rate limit exceeded. Please wait a minute before creating more rooms.',
});

export const roomJoinLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Too many room join attempts. Please slow down.',
});

export const invitationsLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Invitation rate limit exceeded. Please wait a moment before sending more invites.',
});

export const friendRequestsLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Friend request rate limit exceeded. Please wait a moment.',
});

export const chatLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Chat rate limit exceeded. Please wait before sending more messages.',
});

export const adminLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Admin action rate limit exceeded.',
});
