import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { checkAccountStatus } from './rbac.js';

async function authenticateRequest(
  req: Request,
  res: Response,
  next: NextFunction,
  allowProfileBootstrap = false
): Promise<void> {
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

  const verifyAccount = () =>
    checkAccountStatus(req, res, next, {
      allowMissingProfile: allowProfileBootstrap,
    });

  // Support test mocking when running tests with test-mock-token-* tokens.
  if (process.env.NODE_ENV === 'test' && token.startsWith('test-mock-token-')) {
    const testUserId = token.replace('test-mock-token-', '');
    req.user = {
      id: testUserId,
      email: `${testUserId}@example.com`,
      user_metadata: { name: 'Test User' },
    };

    await verifyAccount();
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

    // The profile bootstrap exception is used only by GET /profiles/me.
    // Suspended existing accounts and database verification failures still fail closed.
    await verifyAccount();
  } catch (err) {
    console.error('Error during token verification:', err instanceof Error ? err.message : err);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Failed to verify token credentials',
    });
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  await authenticateRequest(req, res, next, false);
}

export async function requireAuthForProfileBootstrap(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  await authenticateRequest(req, res, next, true);
}
