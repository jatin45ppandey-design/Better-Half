import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../src/config/prisma.js';
import {
  requireAuth,
  requireAuthForProfileBootstrap,
} from '../src/middleware/auth.js';

function createRequest(): Request {
  return {
    headers: {
      authorization: 'Bearer test-mock-token-new-google-user',
    },
  } as unknown as Request;
}

function createResponse(): Response {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('First Google sign-in profile bootstrap', () => {
  it('allows an authenticated user with no profile through the dedicated bootstrap middleware', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(null);

    const req = createRequest();
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await requireAuthForProfileBootstrap(req, res, next);

    expect(req.user?.id).toBe('new-google-user');
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('continues to reject a missing profile on ordinary authenticated endpoints', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(null);

    const req = createRequest();
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'PROFILE_NOT_FOUND',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('does not let the bootstrap exception bypass suspension checks', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue({
      id: 'new-google-user',
      username: 'blocked_player',
      displayName: 'Blocked Player',
      accountStatus: 'SUSPENDED',
    } as any);

    const req = createRequest();
    const res = createResponse();
    const next = vi.fn() as unknown as NextFunction;

    await requireAuthForProfileBootstrap(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'ACCOUNT_SUSPENDED',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
