import type { Request, Response, NextFunction } from 'express';

export interface RequestTimeoutOptions {
  timeoutMs?: number;
  message?: string;
  skipInTest?: boolean;
}

/**
 * Request timeout middleware.
 * Aborts hanging requests and returns 504 Gateway Timeout if the response
 * is not completed within the bounded duration.
 */
export function requestTimeout(options: RequestTimeoutOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 15000;
  const message = options.message ?? 'Request timeout: The server took too long to respond.';
  const skipInTest = options.skipInTest ?? (process.env.NODE_ENV === 'test');

  return (req: Request, res: Response, next: NextFunction): void => {
    if (skipInTest) {
      return next();
    }

    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: message,
          code: 'REQUEST_TIMEOUT',
        });
      }
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timer);
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);

    // Attach timeout flag to request for downstream checks
    (req as any).isTimedOut = () => timedOut;

    next();
  };
}
