import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header with Bearer token',
    });
    return;
  }

  const token = authHeader.split(' ')[1]?.trim();

  if (!token) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Bearer token is empty',
    });
    return;
  }

  // Support test mocking when running tests with TEST_AUTH_USER_ID
  if (process.env.NODE_ENV === 'test' && token.startsWith('test-mock-token-')) {
    const testUserId = token.replace('test-mock-token-', '');
    req.user = {
      id: testUserId,
      email: `${testUserId}@example.com`,
      user_metadata: { name: 'Test User' },
    };
    next();
    return;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid, expired, or revoked access token',
      });
      return;
    }

    req.user = {
      id: data.user.id,
      email: data.user.email,
      user_metadata: data.user.user_metadata,
    };

    next();
  } catch (err) {
    console.error('Error during token verification:', err instanceof Error ? err.message : err);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Failed to verify token credentials',
    });
  }
}

