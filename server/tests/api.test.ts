import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { supabase } from '../src/config/supabase.js';
import { gameStateService } from '../src/modules/games/core/gameState.service.js';

const app = createApp();

describe('PlaySpace Backend API — Phase 1 Test Suite', () => {
  beforeEach(() => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockImplementation(async (args: any) => {
      if (args?.where?.username === 'taken_name') {
        return { id: 'other-user-uuid', username: 'taken_name' } as any;
      }
      return {
        id: args?.where?.id || 'user-test-uuid',
        username: 'test_player',
        displayName: 'Test Player',
        avatarColor: '#9670E8',
        avatarInitials: 'TP',
        bio: 'Hello PlaySpace',
        accountStatus: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          publicMatchHistory: true,
          stealthMode: false,
          ghostMode: false,
          soundMuted: false,
          volume: 0.8,
          reducedMotion: false,
        },
      } as any;
    });
  });

  describe('Health & Readiness', () => {
    it('GET /api/v1/health returns 200 OK with service info', async () => {
      const res = await request(app).get('/api/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('playspace-api');
      expect(typeof res.body.uptime).toBe('number');
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('GET /api/v1/ready returns status without leaking DB credentials', async () => {
      const res = await request(app).get('/api/v1/ready');
      // Status will be 200 if connected or 503 if disconnected, but should never leak DB credentials
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('database');
      expect(JSON.stringify(res.body)).not.toContain('postgres:');
      expect(JSON.stringify(res.body)).not.toContain('password');
    }, 10000);
  });

  describe('Authentication Middleware', () => {
    it('rejects protected endpoints when Authorization header is missing', async () => {
      const res = await request(app).get('/api/v1/profiles/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toContain('Missing or malformed Authorization header');
    });

    it('rejects protected endpoints when Bearer token is malformed', async () => {
      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', 'Basic 123456');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('rejects protected endpoints when token is invalid or unverified', async () => {
      vi.spyOn(supabase.auth, 'getUser').mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid token' } as any,
      });

      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', 'Bearer fake-invalid-jwt-token');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('derives identity from verified token and permits test token', async () => {
      // Mock prisma.userProfile.findUnique
      const mockProfile = {
        id: 'user-test-uuid',
        username: 'test_player',
        displayName: 'Test Player',
        avatarColor: '#9670E8',
        avatarInitials: 'TP',
        bio: 'Hello PlaySpace',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          showOnlineStatus: true,
          allowDirectInvites: true,
          publicMatchHistory: true,
          ghostMode: false,
          soundMuted: false,
          volume: 0.8,
          reducedMotion: false,
        },
      };

      // /profiles/me checks authorization and then reloads the full canonical
      // profile. Keep the fixture available for both legitimate database reads.
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockProfile as any);

      const res = await request(app)
        .get('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('user-test-uuid');
      expect(res.body.username).toBe('test_player');
    });
  });

  describe('Profile Validation & Ownership', () => {
    it('validates PATCH /api/v1/profiles/me body format', async () => {
      const res = await request(app)
        .patch('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid')
        .send({
          username: 'invalid user with spaces!!',
          avatarColor: 'not-a-color',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeInstanceOf(Array);
      expect(res.body.details.length).toBeGreaterThanOrEqual(1);
    });

    it('enforces username uniqueness on profile update', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockImplementation(async (args: any) => {
        if (args?.where?.username) {
          return { id: 'other-user-uuid', username: 'taken_name' } as any;
        }
        return { id: 'user-test-uuid', username: 'test_player', accountStatus: 'ACTIVE' } as any;
      });

      const res = await request(app)
        .patch('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid')
        .send({
          username: 'taken_name',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('ConflictError');
      expect(res.body.message).toContain('already taken');
    });

    it('requires query parameter for profile search', async () => {
      const res = await request(app)
        .get('/api/v1/profiles/search')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('Friends & Social Authorization Rules', () => {
    it('prevents sending a friend request to oneself', async () => {
      const res = await request(app)
        .post('/api/v1/friends/requests')
        .set('Authorization', 'Bearer test-mock-token-00000000-0000-0000-0000-000000000001')
        .send({
          receiverId: '00000000-0000-0000-0000-000000000001',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot send a friend request to yourself');
    });

    it('rejects accept request if the user is not the receiver', async () => {
      vi.spyOn(prisma.friendRequest, 'findUnique').mockResolvedValueOnce({
        id: '11111111-1111-1111-1111-111111111111',
        senderId: 'user-a',
        receiverId: 'user-b',
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/friends/requests/11111111-1111-1111-1111-111111111111/accept')
        .set('Authorization', 'Bearer test-mock-token-user-impostor');

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('only accept requests addressed to you');
    });

    it('prevents blocking oneself', async () => {
      const res = await request(app)
        .post('/api/v1/blocks/00000000-0000-0000-0000-000000000001')
        .set('Authorization', 'Bearer test-mock-token-00000000-0000-0000-0000-000000000001');

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Cannot block yourself');
    });
  });
  describe('Wave 1 — Object-level authorization and input allowlists', () => {
    it('denies non-participants before reading game session projections', async () => {
      vi.spyOn(gameStateService, 'getSession').mockReturnValue({ participants: [{ userId: 'another-player' }] } as any);
      const publicProjection = vi.spyOn(gameStateService, 'getPublicProjection').mockReturnValue({ sessionId: 'private-session' });
      const res = await request(app).get('/api/v1/games/sessions/private-session/state')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid');
      expect(res.status).toBe(403);
      expect(publicProjection).not.toHaveBeenCalled();
    });

    it('rejects protected profile properties', async () => {
      const res = await request(app).patch('/api/v1/profiles/me')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid')
        .send({ displayName: 'Updated Name', roles: ['ADMIN'], accountStatus: 'SUSPENDED' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('rejects protected settings properties', async () => {
      const res = await request(app).patch('/api/v1/settings')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid')
        .send({ ghostMode: true, accountStatus: 'SUSPENDED', userId: 'another-user' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('returns a safe room preview to non-members without internal IDs or private data', async () => {
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValueOnce({
        id: 'internal-room-id', code: 'SAFE22', name: 'Private Game Night', mode: 'friend',
        status: 'WAITING', maxPlayers: 4, selectedGameId: 'uno-style', hostId: 'host-user',
        expiresAt: new Date(Date.now() + 60_000), host: { displayName: 'Room Host' },
        participants: [{ userId: 'host-user', role: 'HOST', isReady: true, user: {
          displayName: 'Room Host', avatarUrl: null, avatarInitials: 'RH', avatarColor: '#9670E8',
        }}],
      } as any);
      vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValueOnce(null);
      const res = await request(app).get('/api/v1/rooms/code/SAFE22')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid');
      expect(res.status).toBe(200);
      expect(res.body.isJoinPreview).toBe(true);
      expect(res.body.canJoin).toBe(true);
      expect(res.body.participantCount).toBe(1);
      expect(res.body).not.toHaveProperty('id');
      expect(res.body).not.toHaveProperty('hostId');
      expect(res.body).not.toHaveProperty('gameVotes');
      expect(res.body).not.toHaveProperty('chatMessages');
      expect(res.body.participants[0]).not.toHaveProperty('userId');
    });

    it('blocks non-members from reading or posting room chat', async () => {
      vi.spyOn(prisma.room, 'findFirst')
        .mockResolvedValueOnce({ id: 'chat-room', status: 'WAITING', code: 'CHAT22' } as any)
        .mockResolvedValueOnce({ id: 'chat-room', status: 'WAITING', code: 'CHAT22' } as any);
      vi.spyOn(prisma.roomParticipant, 'findUnique').mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) =>
        callback({
          $queryRaw: vi.fn().mockResolvedValue([{ id: 'chat-room' }]),
          room: {
            findUnique: vi.fn().mockResolvedValue({ id: 'chat-room', status: 'WAITING' }),
          },
          roomParticipant: {
            findUnique: vi.fn().mockResolvedValue(null),
          },
        })
      );
      const read = await request(app).get('/api/v1/rooms/chat-room/messages')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid');
      const post = await request(app).post('/api/v1/rooms/chat-room/messages')
        .set('Authorization', 'Bearer test-mock-token-user-test-uuid').send({ message: 'Not a member' });
      expect(read.status).toBe(403);
      expect(post.status).toBe(403);
    });
  });

});
