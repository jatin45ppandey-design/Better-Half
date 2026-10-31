import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase.js';
import { checkAccountStatus } from './rbac.js';

export interface MockUserIdentity {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
}

export type MockAuthVerifier = (token: string) => MockUserIdentity | null;

let injectedMockVerifier: MockAuthVerifier | null = null;

/**
 * Registers an isolated mock authentication verifier dependency.
 * STRICT SECURITY INVARIANT:
 * - Forbidden in production (throws Error if NODE_ENV === 'production').
 * - Only available when explicitly injected in-memory by an active test harness.
 * - If no verifier is injected, mock tokens are unconditionally rejected (fail-closed),
 *   even if NODE_ENV is set to 'test' on a misconfigured deployed server.
 */
export function setInjectedMockAuthVerifier(verifier: MockAuthVerifier | null): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Security violation: Cannot inject mock authentication verifiers in a production environment.');
  }
  injectedMockVerifier = verifier;
}

export function getInjectedMockAuthVerifier(): MockAuthVerifier | null {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  return injectedMockVerifier;
}

/**
 * Default mock token verifier for automated test environments.
 * Extracts userId from test-mock-token-<id> pattern.
 */
export function defaultTestMockVerifier(token: string): MockUserIdentity | null {
  if (!token.startsWith('test-mock-token-')) {
    return null;
  }
  const id = token.replace('test-mock-token-', '').trim();
  if (!id) {
    return null;
  }
  return {
    id,
    email: `${id}@example.com`,
    user_metadata: { name: 'Test User' },
  };
}

export function enableTestAuth(verifier: MockAuthVerifier = defaultTestMockVerifier): void {
  setInjectedMockAuthVerifier(verifier);
}

export function disableTestAuth(): void {
  setInjectedMockAuthVerifier(null);
}

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

  // Support test mocking ONLY when an explicit test mock verifier dependency has been injected
  if (token.startsWith('test-mock-token-')) {
    const mockVerifier = getInjectedMockAuthVerifier();
    if (!mockVerifier) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Mock authentication tokens are strictly forbidden: no test authentication provider is injected in this runtime',
      });
      return;
    }

    const mockUser = mockVerifier(token);
    if (!mockUser) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Mock authentication token was rejected by the injected test verifier',
      });
      return;
    }

    req.user = mockUser;
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
