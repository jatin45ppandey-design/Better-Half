import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { createSocketServer } from '../src/socket/index.js';
import { prisma } from '../src/config/prisma.js';
import { presenceManager } from '../src/socket/presence.js';
import { roomsService } from '../src/modules/rooms/rooms.service.js';

const app = createApp();
let httpServer: http.Server;
let ioServer: any;
let serverPort: number;

beforeAll(async () => {
  httpServer = http.createServer(app);
  ioServer = createSocketServer(httpServer);
  await new Promise<void>((resolve) => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address() as any;
      serverPort = addr.port;
      resolve();
    });
  });
});

afterAll(async () => {
  ioServer.close();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
  presenceManager.reset();
});

describe('PlaySpace Phase 2 — Real Multiplayer Rooms & Socket.IO Test Suite', () => {
  describe('Room REST API — Creation, Validation & Capacity', () => {
    it('creates a Couple Mode room with 6-character code and capacity of 2', async () => {
      const mockHost = {
        id: 'host-user-1',
        username: 'alex_host',
        displayName: 'Alex Host',
        avatarColor: 'bg-[#9670E8]',
        avatarInitials: 'AH',
      };

      const mockRoomRecord = {
        id: 'test-room-uuid-1',
        code: 'LOVE99',
        name: 'Cozy Couple Lounge',
        mode: 'couple',
        status: 'WAITING',
        selectedGameId: 'between-us',
        maxPlayers: 2,
        hostId: 'host-user-1',
        host: mockHost,
        participants: [
          {
            id: 'part-1',
            userId: 'host-user-1',
            role: 'HOST',
            isReady: true,
            user: mockHost,
          },
        ],
        gameVotes: [{ id: 'gv-1', userId: 'host-user-1', gameId: 'between-us' }],
        messages: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7200000),
      };

      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHost as any);
      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue(mockRoomRecord as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          room: {
            create: vi.fn().mockResolvedValue(mockRoomRecord),
          },
          roomParticipant: {
            create: vi.fn().mockResolvedValue(mockRoomRecord.participants[0]),
          },
          gameVote: {
            create: vi.fn().mockResolvedValue({}),
          },
          roomMessage: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        await callback(tx);
        return mockRoomRecord;
      });

      const res = await request(app)
        .post('/api/v1/rooms')
        .set('Authorization', 'Bearer test-mock-token-host-user-1')
        .send({
          name: 'Cozy Couple Lounge',
          mode: 'couple',
          selectedGameId: 'between-us',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('code');
      expect(res.body.code.length).toBe(6);
      expect(res.body.mode).toBe('couple');
      expect(res.body.maxPlayers).toBe(2);
      expect(res.body.hostId).toBe('host-user-1');
    });

    it('rejects invalid game selection for room mode', async () => {
      const res = await request(app)
        .post('/api/v1/rooms')
        .set('Authorization', 'Bearer test-mock-token-host-user-1')
        .send({
          name: 'Friend Squad',
          mode: 'friend',
          selectedGameId: 'between-us', // Couple mode only!
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not allowed in friend mode');
    });

    it('validates room creation payload with Zod schema', async () => {
      const res = await request(app)
        .post('/api/v1/rooms')
        .set('Authorization', 'Bearer test-mock-token-host-user-1')
        .send({
          mode: 'invalid-mode',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('allows permitted multiplayer games in Friend Mode', async () => {
      const mockHost = {
        id: 'host-user-friend',
        username: 'sam_host',
        displayName: 'Sam Host',
      };

      const mockRoomRecord = {
        id: 'test-room-uuid-2',
        code: 'FRND99',
        name: 'Party Squad',
        mode: 'friend',
        status: 'WAITING',
        selectedGameId: 'uno-style',
        maxPlayers: 4,
        hostId: 'host-user-friend',
        host: mockHost,
        participants: [
          {
            id: 'part-2',
            userId: 'host-user-friend',
            role: 'HOST',
            isReady: true,
            user: mockHost,
          },
        ],
        gameVotes: [{ id: 'gv-2', userId: 'host-user-friend', gameId: 'uno-style' }],
        messages: [],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7200000),
      };

      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHost as any);
      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue(mockRoomRecord as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          room: {
            create: vi.fn().mockResolvedValue(mockRoomRecord),
          },
          roomParticipant: {
            create: vi.fn().mockResolvedValue(mockRoomRecord.participants[0]),
          },
          gameVote: {
            create: vi.fn().mockResolvedValue({}),
          },
          roomMessage: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        await callback(tx);
        return mockRoomRecord;
      });

      const res = await request(app)
        .post('/api/v1/rooms')
        .set('Authorization', 'Bearer test-mock-token-host-user-friend')
        .send({
          name: 'Party Squad',
          mode: 'friend',
          selectedGameId: 'uno-style',
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.mode).toBe('friend');
      expect(res.body.maxPlayers).toBe(4);
    });
  });

  describe('Room Invitations — Social Graph & Protection', () => {
    it('prevents inviting oneself to a room', async () => {
      const res = await request(app)
        .post('/api/v1/invitations/rooms')
        .set('Authorization', 'Bearer test-mock-token-00000000-0000-0000-0000-000000000001')
        .send({
          roomId: '00000000-0000-0000-0000-000000000002',
          receiverId: '00000000-0000-0000-0000-000000000001',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot invite yourself');
    });

    it('prevents inviting a blocked user', async () => {
      vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValueOnce({
        id: 'block-1',
        blockerId: '00000000-0000-0000-0000-000000000001',
        blockedUserId: '00000000-0000-0000-0000-000000000002',
        createdAt: new Date(),
      } as any);

      const res = await request(app)
        .post('/api/v1/invitations/rooms')
        .set('Authorization', 'Bearer test-mock-token-00000000-0000-0000-0000-000000000001')
        .send({
          roomId: '00000000-0000-0000-0000-000000000003',
          receiverId: '00000000-0000-0000-0000-000000000002',
        });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Cannot invite this user');
    });
  });

  describe('Socket.IO Real-Time Infrastructure — Two Authenticated Clients', () => {
    let clientA: ClientSocketType;
    let clientB: ClientSocketType;

    const testRoomSnapshot = {
      id: 'room-realtime-1',
      code: 'LIVE77',
      name: 'Realtime Arena',
      mode: 'couple' as const,
      status: 'WAITING',
      maxPlayers: 2,
      selectedGameId: 'between-us',
      hostId: 'socket-user-a',
      hostName: 'User A',
      participants: [
        {
          id: 'p-user-a',
          userId: 'socket-user-a',
          username: 'user_a',
          displayName: 'User A',
          avatarColor: 'bg-[#9670E8]',
          avatarInitials: 'UA',
          role: 'HOST' as const,
          isReady: true,
          joinedAt: new Date().toISOString(),
        },
      ],
      gameVotes: { 'between-us': ['socket-user-a'] },
      chatMessages: [],
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7200000).toISOString(),
    };

    beforeAll(async () => {
      const clientUrl = `http://127.0.0.1:${serverPort}`;

      clientA = ClientSocket(clientUrl, {
        auth: { token: 'test-mock-token-socket-user-a' },
        transports: ['websocket'],
      });

      clientB = ClientSocket(clientUrl, {
        auth: { token: 'test-mock-token-socket-user-b' },
        transports: ['websocket'],
      });

      await Promise.all([
        new Promise<void>((resolve) => clientA.on('connect', () => resolve())),
        new Promise<void>((resolve) => clientB.on('connect', () => resolve())),
      ]);
    });

    afterAll(() => {
      if (clientA?.connected) clientA.disconnect();
      if (clientB?.connected) clientB.disconnect();
    });

    it('verifies both clients connected and authenticated', () => {
      expect(clientA.connected).toBe(true);
      expect(clientB.connected).toBe(true);
    });

    it('rejects connection without token or with invalid credentials', async () => {
      const clientUrl = `http://127.0.0.1:${serverPort}`;
      const unauthClient = ClientSocket(clientUrl, {
        auth: {},
        transports: ['websocket'],
      });

      const err = await new Promise<string>((resolve) => {
        unauthClient.on('connect_error', (e) => resolve(e.message));
      });

      expect(err).toContain('Authentication failed');
      unauthClient.disconnect();
    });

    it('rejects room join for nonexistent room code', async () => {
      vi.spyOn(roomsService, 'getRoomByCode').mockRejectedValueOnce(new Error('Room not found'));

      const response = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        clientA.emit('room:join', { code: 'NOCODE' }, (res) => resolve(res));
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Room not found');
    });

    it('allows Client A (host) to join room and receives room:state', async () => {
      vi.spyOn(roomsService, 'getRoomByCode').mockResolvedValue(testRoomSnapshot as any);
      vi.spyOn(roomsService, 'getRoomById').mockResolvedValue(testRoomSnapshot as any);

      const statePromise = new Promise<any>((resolve) => {
        clientA.once('room:state', (state) => resolve(state));
      });

      const ack = await new Promise<any>((resolve) => {
        clientA.emit('room:join', { code: 'LIVE77' }, (res) => resolve(res));
      });

      expect(ack.success).toBe(true);
      expect(ack.room.code).toBe('LIVE77');

      const state = await statePromise;
      expect(state.code).toBe('LIVE77');
      expect(state.hostId).toBe('socket-user-a');
    });

    it('allows Client B to join, broadcasts room:player:joined to Client A, and syncs state', async () => {
      const updatedSnapshotWithB = {
        ...testRoomSnapshot,
        participants: [
          ...testRoomSnapshot.participants,
          {
            id: 'p-user-b',
            userId: 'socket-user-b',
            username: 'user_b',
            displayName: 'User B',
            avatarColor: 'bg-[#3B82F6]',
            avatarInitials: 'UB',
            role: 'PLAYER' as const,
            isReady: false,
            joinedAt: new Date().toISOString(),
          },
        ],
      };

      vi.spyOn(roomsService, 'getRoomByCode').mockResolvedValue({ isJoinPreview: true, canJoin: true, code: 'LIVE77' } as any);
      vi.spyOn(roomsService, 'getRoomById').mockResolvedValue({ isJoinPreview: true, canJoin: true, code: 'LIVE77' } as any);
      vi.spyOn(roomsService, 'joinRoom').mockResolvedValue({
        room: updatedSnapshotWithB,
        isNewJoin: true,
      } as any);

      // Client A should receive player:joined
      const playerJoinedPromise = new Promise<any>((resolve) => {
        clientA.once('room:player:joined', (data) => resolve(data));
      });

      const ackB = await new Promise<any>((resolve) => {
        clientB.emit('room:join', { code: 'LIVE77' }, (res) => resolve(res));
      });

      expect(ackB.success).toBe(true);
      expect(ackB.room.participants.length).toBe(2);

      const joinedEvent = await playerJoinedPromise;
      expect(joinedEvent.participant.userId).toBe('socket-user-b');
      expect(joinedEvent.participant.displayName).toBe('User B');
    });

    it('synchronizes ready state: Client B toggles ready and Client A receives room:player:ready', async () => {
      const readySnapshot = {
        ...testRoomSnapshot,
        status: 'READY_TO_START',
        participants: [
          testRoomSnapshot.participants[0],
          {
            id: 'p-user-b',
            userId: 'socket-user-b',
            username: 'user_b',
            displayName: 'User B',
            avatarColor: 'bg-[#3B82F6]',
            avatarInitials: 'UB',
            role: 'PLAYER' as const,
            isReady: true,
            joinedAt: new Date().toISOString(),
          },
        ],
      };

      vi.spyOn(roomsService, 'toggleReady').mockResolvedValue(readySnapshot as any);

      const readyEventPromise = new Promise<any>((resolve) => {
        clientA.once('room:player:ready', (data) => resolve(data));
      });

      const ack = await new Promise<any>((resolve) => {
        clientB.emit('room:ready:update', { roomId: 'room-realtime-1', isReady: true }, (res) =>
          resolve(res)
        );
      });

      expect(ack.success).toBe(true);
      expect(ack.isReady).toBe(true);

      const readyEvent = await readyEventPromise;
      expect(readyEvent.userId).toBe('socket-user-b');
      expect(readyEvent.isReady).toBe(true);
      expect(readyEvent.roomStatus).toBe('READY_TO_START');
    });

    it('synchronizes game votes: Client B votes for a game and Client A receives room:game:voted', async () => {
      const votedSnapshot = {
        ...testRoomSnapshot,
        gameVotes: {
          'between-us': ['socket-user-a', 'socket-user-b'],
        },
      };

      vi.spyOn(roomsService, 'voteGame').mockResolvedValue(votedSnapshot as any);

      const voteEventPromise = new Promise<any>((resolve) => {
        clientA.once('room:game:voted', (data) => resolve(data));
      });

      const ack = await new Promise<any>((resolve) => {
        clientB.emit('room:game:vote', { roomId: 'room-realtime-1', gameId: 'between-us' }, (res) =>
          resolve(res)
        );
      });

      expect(ack.success).toBe(true);

      const voteEvent = await voteEventPromise;
      expect(voteEvent.userId).toBe('socket-user-b');
      expect(voteEvent.gameId).toBe('between-us');
      expect(voteEvent.votes['between-us']).toContain('socket-user-b');
    });

    it('delivers chat messages in real time between clients', async () => {
      const mockMessage = {
        id: 'msg-realtime-1',
        roomId: 'room-realtime-1',
        senderId: 'socket-user-b',
        senderName: 'User B',
        text: 'Ready for deep questions!',
        timestamp: '10:30 AM',
        isSystem: false,
        createdAt: new Date().toISOString(),
      };

      vi.spyOn(roomsService, 'postMessage').mockResolvedValue(mockMessage as any);

      const chatEventPromise = new Promise<any>((resolve) => {
        clientA.once('room:chat:new', (msg) => resolve(msg));
      });

      const ack = await new Promise<any>((resolve) => {
        clientB.emit(
          'room:chat:send',
          { roomId: 'room-realtime-1', message: 'Ready for deep questions!' },
          (res) => resolve(res)
        );
      });

      expect(ack.success).toBe(true);
      expect(ack.message.text).toBe('Ready for deep questions!');

      const deliveredMsg = await chatEventPromise;
      expect(deliveredMsg.text).toBe('Ready for deep questions!');
      expect(deliveredMsg.senderId).toBe('socket-user-b');
    });

    it('rejects unauthorized host operations from non-host client', async () => {
      vi.spyOn(roomsService, 'canStartGame').mockResolvedValue({
        canStart: false,
        reason: 'Only the room host can launch the game.',
      });

      const ack = await new Promise<any>((resolve) => {
        clientB.emit('room:start:prepare', { roomId: 'room-realtime-1' }, (res) => resolve(res));
      });

      expect(ack.success).toBe(false);
      expect(ack.error).toContain('Only the room host can launch');
    });

    it('tracks presence and disconnect grace period without immediate host transfer', () => {
      presenceManager.trackConnect('test-host-grace', 'socket-h1');
      presenceManager.joinRoom('room-grace', 'test-host-grace');

      expect(presenceManager.isUserOnline('test-host-grace')).toBe(true);
      expect(presenceManager.getRoomOnlineUsers('room-grace')).toContain('test-host-grace');

      // Socket disconnects -> starts grace period
      const graceStarted = presenceManager.trackDisconnect('test-host-grace', 'socket-h1', () => {});
      expect(graceStarted).toBe(true);

      // User is STILL considered online during grace period
      expect(presenceManager.isUserOnline('test-host-grace')).toBe(true);

      // Reconnect with new socket during grace period
      const { reconnected } = presenceManager.trackConnect('test-host-grace', 'socket-h2');
      expect(reconnected).toBe(true);
      expect(presenceManager.isUserOnline('test-host-grace')).toBe(true);
    });
  });
});
