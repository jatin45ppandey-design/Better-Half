import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { getMyProfile } from '../src/modules/profiles/profiles.controller.js';
import { profilesService } from '../src/modules/profiles/profiles.service.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /profiles/me response contract', () => {
  it('returns the complete canonical profile instead of the authorization-only profile snapshot', async () => {
    const canonicalProfile = {
      id: 'profile-contract-user',
      username: 'profile_user',
      displayName: 'Profile User',
      avatarUrl: 'https://cdn.example.test/avatar.png',
      avatarInitials: 'PU',
      avatarColor: '#9670E8',
      bio: 'A complete profile response.',
      accountStatus: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      settings: {
        id: 'settings-1',
        userId: 'profile-contract-user',
        showOnlineStatus: true,
      },
    };

    const getOrCreate = vi
      .spyOn(profilesService, 'getOrCreateProfile')
      .mockResolvedValue(canonicalProfile as any);

    const req = {
      user: {
        id: 'profile-contract-user',
        email: 'profile@example.test',
        user_metadata: { name: 'Profile User' },
      },
      // This is the intentionally minimal snapshot populated by checkAccountStatus.
      userProfile: {
        id: 'profile-contract-user',
        username: 'profile_user',
        displayName: 'Profile User',
        accountStatus: 'ACTIVE',
      },
    } as unknown as Request;

    const responseBody: unknown[] = [];
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn((body: unknown) => {
        responseBody.push(body);
        return res;
      }),
    } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;

    await getMyProfile(req, res, next);

    expect(getOrCreate).toHaveBeenCalledWith(
      'profile-contract-user',
      'profile@example.test',
      { name: 'Profile User' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(responseBody[0]).toEqual(canonicalProfile);
    expect(next).not.toHaveBeenCalled();
  });
});
