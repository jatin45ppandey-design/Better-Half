import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function rateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
} = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute default
  const max = options.max || 120; // 120 requests per window default
  const message = options.message || 'Too many requests, please try again later.';

  const ipMap = new Map<string, RateLimitRecord>();

  // Periodically clean up expired entries
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of ipMap.entries()) {
      if (now > record.resetAt) {
        ipMap.delete(key);
      }
    }
  }, windowMs * 2).unref();

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, do not throttle
    if (process.env.NODE_ENV === 'test') {
      next();
      return;
    }

    const key = (req.user?.id || req.ip || req.socket.remoteAddress || 'unknown') as string;
    const now = Date.now();

    const record = ipMap.get(key);

    if (!record || now > record.resetAt) {
      ipMap.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', max - 1);
      next();
      return;
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);

    if (record.count > max) {
      res.status(429).json({
        error: 'Too Many Requests',
        message,
        retryAfter: Math.ceil((record.resetAt - now) / 1000),
      });
      return;
    }

    next();
  };
}

