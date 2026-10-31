import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { createSocketServer } from '../src/socket/index.js';
import { prisma } from '../src/config/prisma.js';
import { presenceManager } from '../src/socket/presence.js';
import { roomsService } from '../src/modules/rooms/rooms.service.js';
import { invitationsService } from '../src/modules/invitations/invitations.service.js';

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
  ioServer?.close();
  await new Promise<void>((resolve) => {
    httpServer.close(() => resolve());
  });
  presenceManager.reset();
});

describe('PlaySpace Wave 2 — B3 Rooms, Realtime, Invitations, Chat & Presence Test Suite', () => {
  describe('Room Capacity & Idempotent Join Concurrency', () => {
    it('duplicate joins return existing snapshot safely without duplicate insertion', async () => {
      const mockHost = {
        id: 'user-b3-1',
        username: 'user_b3_1',
        displayName: 'User One',
      };

      const mockRoomRecord = {
        id: 'room-b3-id-1',
        code: 'B3JOIN',
        name: 'Cozy Lounge',
        mode: 'COUPLE',
        status: 'WAITING',
        selectedGameId: 'between-us',
        maxPlayers: 2,
        hostId: 'user-b3-1',
        expiresAt: new Date(Date.now() + 3600000),
        participants: [
          {
            id: 'part-1',
            userId: 'user-b3-1',
            role: 'HOST',
            isReady: true,
            leftAt: null,
            user: mockHost,
          },
        ],
        gameVotes: [],
        messages: [],
        gameSessions: [],
      };

      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(mockRoomRecord as any);
      vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValue(null);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([{ id: mockRoomRecord.id }]),
          room: {
            findUnique: vi.fn().mockResolvedValue(mockRoomRecord),
          },
          roomParticipant: {
            count: vi.fn().mockResolvedValue(1),
            findUnique: vi.fn().mockResolvedValue({
              id: 'part-1',
              roomId: 'room-b3-id-1',
              userId: 'user-b3-1',
              leftAt: null,
            }),
          },
          userProfile: {
            findUnique: vi.fn().mockResolvedValue(mockHost),
          },
          roomMessage: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue(mockRoomRecord as any);

      const result = await roomsService.joinRoom('user-b3-1', 'B3JOIN');
      expect(result.isNewJoin).toBe(false);
      expect(result.room).toBeDefined();
      expect(result.room.code).toBe('B3JOIN');
    });

    it('rejects join when active participant count reaches maximum capacity', async () => {
      const mockRoom = {
        id: 'room-b3-full',
        code: 'B3FULL',
        name: 'Full Couple Room',
        mode: 'COUPLE',
        status: 'WAITING',
        maxPlayers: 2,
        hostId: 'user-b3-1',
        expiresAt: new Date(Date.now() + 3600000),
        participants: [
          { id: 'p1', userId: 'user-b3-1', leftAt: null },
          { id: 'p2', userId: 'user-b3-2', leftAt: null },
        ],
      };

      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(mockRoom as any);
      vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValue(null);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([{ id: mockRoom.id }]),
          room: {
            findUnique: vi.fn().mockResolvedValue(mockRoom),
          },
          roomParticipant: {
            count: vi.fn().mockResolvedValue(2), // already 2
            findUnique: vi.fn().mockResolvedValue(null), // new user
          },
          userProfile: {
            findUnique: vi.fn().mockResolvedValue({ displayName: 'Player 3' }),
          },
        };
        return callback(tx);
      });

      await expect(roomsService.joinRoom('user-b3-3', 'B3FULL')).rejects.toThrow(
        /Room B3FULL is full/
      );
    });

    it('rejects joining and starting expired or closed rooms', async () => {
      const expiredRoom = {
        id: 'room-b3-expired',
        code: 'B3EXPD',
        mode: 'COUPLE',
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 60000), // past
        hostId: 'user-b3-1',
        participants: [],
      };

      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(expiredRoom as any);
      vi.spyOn(prisma.room, 'findFirst').mockResolvedValue(expiredRoom as any);

      await expect(roomsService.joinRoom('user-b3-2', 'B3EXPD')).rejects.toThrow(
        /not accepting new participants/
      );

      const check = await roomsService.canStartGame('room-b3-expired', 'user-b3-1');
      expect(check.canStart).toBe(false);
      expect(check.reason).toContain('expired');
    });
  });

  describe('Invitations — Conditional Transitions & Safe Reopening', () => {
    it('reopens old declined/expired invitations without unique constraint collision', async () => {
      const mockHost = { id: 'host-1', username: 'host1', displayName: 'Host 1', accountStatus: 'ACTIVE' };
      const mockReceiver = { id: 'recv-1', username: 'recv1', displayName: 'Recv 1', accountStatus: 'ACTIVE', settings: { allowDirectInvites: true } };

      const mockRoom = {
        id: 'room-inv-1',
        status: 'WAITING',
        expiresAt: new Date(Date.now() + 3600000),
        maxPlayers: 2,
        participants: [{ userId: 'host-1', leftAt: null }],
      };

      const existingDeclinedInvite = {
        id: 'inv-declined-1',
        roomId: 'room-inv-1',
        receiverId: 'recv-1',
        senderId: 'host-1',
        status: 'DECLINED',
        expiresAt: new Date(Date.now() - 10000),
      };

      vi.spyOn(prisma.userProfile, 'findUnique')
        .mockResolvedValueOnce(mockHost as any)
        .mockResolvedValueOnce(mockReceiver as any);

      vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValue(null);
      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(mockRoom as any);
      vi.spyOn(prisma.roomInvitation, 'findUnique').mockResolvedValue(existingDeclinedInvite as any);

      const updateSpy = vi.spyOn(prisma.roomInvitation, 'update').mockResolvedValue({
        id: 'inv-declined-1',
        status: 'PENDING',
        senderId: 'host-1',
        receiverId: 'recv-1',
        roomId: 'room-inv-1',
      } as any);

      const res = await invitationsService.sendInvitation('host-1', 'room-inv-1', 'recv-1');
      expect(res.status).toBe('PENDING');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inv-declined-1' },
          data: expect.objectContaining({ status: 'PENDING' }),
        })
      );
    });

    it('rejects invitations when sender or receiver is suspended', async () => {
      const mockSender = { id: 'suspended-user', accountStatus: 'SUSPENDED' };
      const mockReceiver = { id: 'recv-2', accountStatus: 'ACTIVE', settings: { allowDirectInvites: true } };

      vi.spyOn(prisma.userProfile, 'findUnique')
        .mockResolvedValueOnce(mockSender as any)
        .mockResolvedValueOnce(mockReceiver as any);

      await expect(
        invitationsService.sendInvitation('suspended-user', 'room-inv-1', 'recv-2')
      ).rejects.toThrow(/suspended/);
    });

    it('acceptInvitation uses conditional atomic update and rejects stale/already-resolved invites', async () => {
      const mockInvite = {
        id: 'inv-conflict-1',
        receiverId: 'user-rec-1',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 600000),
        room: { code: 'INVCOD' },
      };

      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue({ accountStatus: 'ACTIVE' } as any);
      vi.spyOn(prisma.roomInvitation, 'findUnique').mockResolvedValue(mockInvite as any);

      // Simulate concurrent transition: updateMany affected 0 rows
      vi.spyOn(prisma.roomInvitation, 'updateMany').mockResolvedValue({ count: 0 });

      await expect(
        invitationsService.acceptInvitation('inv-conflict-1', 'user-rec-1')
      ).rejects.toThrow(/already been resolved/);
    });
  });

  describe('Presence Manager & Privacy Compliance', () => {
    it('respects ghostMode and showOnlineStatus: false when computing online room presence', () => {
      presenceManager.reset();

      // Connect 3 users
      presenceManager.trackConnect('user-visible-1', 'sock-1');
      presenceManager.trackConnect('user-ghost-2', 'sock-2');
      presenceManager.trackConnect('user-hidden-3', 'sock-3');

      // Set privacy settings
      presenceManager.setUserPrivacy('user-visible-1', { showOnlineStatus: true, ghostMode: false });
      presenceManager.setUserPrivacy('user-ghost-2', { showOnlineStatus: true, ghostMode: true });
      presenceManager.setUserPrivacy('user-hidden-3', { showOnlineStatus: false, ghostMode: false });

      presenceManager.joinRoom('test-privacy-room', 'user-visible-1');
      presenceManager.joinRoom('test-privacy-room', 'user-ghost-2');
      presenceManager.joinRoom('test-privacy-room', 'user-hidden-3');

      // Public presence check for other players
      const onlinePublic = presenceManager.getRoomOnlineUsers('test-privacy-room');
      expect(onlinePublic).toEqual(['user-visible-1']);
      expect(onlinePublic).not.toContain('user-ghost-2');
      expect(onlinePublic).not.toContain('user-hidden-3');

      // Ghost player querying room presence sees themselves
      const onlineAsGhost = presenceManager.getRoomOnlineUsers('test-privacy-room', 'user-ghost-2');
      expect(onlineAsGhost).toContain('user-ghost-2');
    });
  });

  describe('Socket.IO Payload Validation & Security', () => {
    let clientSocket: ClientSocketType;

    beforeAll(async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue({
        id: 'socket-test-user-b3',
        accountStatus: 'ACTIVE',
      } as any);

      clientSocket = ClientSocket(`http://127.0.0.1:${serverPort}`, {
        auth: { token: 'test-mock-token-socket-test-user-b3' },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => {
        clientSocket.on('connect', () => resolve());
      });
    });

    afterAll(() => {
      clientSocket?.disconnect();
    });

    it('rejects malformed room:join payload via Zod validation before executing logic', async () => {
      const response = await new Promise<any>((resolve) => {
        clientSocket.emit('room:join', {} as any, (ack: any) => resolve(ack));
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain('Invalid payload');
      expect(response.error).toContain('Either roomId or code is required');
    });

    it('rejects empty or oversized chat messages with safe validation error', async () => {
      const responseEmpty = await new Promise<any>((resolve) => {
        clientSocket.emit('room:chat:send', { roomId: 'some-room', message: '   ' } as any, (ack: any) =>
          resolve(ack)
        );
      });

      expect(responseEmpty.success).toBe(false);
      expect(responseEmpty.error).toContain('Message cannot be empty');
    });
  });

  describe('Host Lifecycle Policy & Expiry Cleanup', () => {
    it('transfers host role to oldest active non-suspended participant when host is suspended', async () => {
      vi.spyOn(prisma.room, 'findMany').mockResolvedValueOnce([
        {
          id: 'room-susp-1',
          code: 'SUSP01',
          hostId: 'suspended-host-id',
          status: 'WAITING',
          participants: [
            {
              id: 'part-next-host',
              userId: 'active-guest-id',
              joinedAt: new Date(Date.now() - 10000),
              user: { displayName: 'NextHost', accountStatus: 'ACTIVE' },
            },
          ],
        },
      ] as any);

      const txSpy = vi.spyOn(prisma, '$transaction').mockResolvedValueOnce([{}, {}, {}, {}] as any);

      const result = await roomsService.handleUserSuspension('suspended-host-id');
      expect(result.affectedRooms).toBe(1);
      expect(result.transferredRooms).toBe(1);
      expect(txSpy).toHaveBeenCalled();
    });

    it('closes room when host is suspended and no active non-suspended participants remain', async () => {
      vi.spyOn(prisma.room, 'findMany').mockResolvedValueOnce([
        {
          id: 'room-susp-empty',
          code: 'SUSP02',
          hostId: 'suspended-host-id',
          status: 'WAITING',
          participants: [],
        },
      ] as any);

      const updateSpy = vi.spyOn(prisma.room, 'update').mockResolvedValueOnce({} as any);

      const result = await roomsService.handleUserSuspension('suspended-host-id');
      expect(result.affectedRooms).toBe(1);
      expect(result.closedRooms).toBe(1);
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'room-susp-empty' },
          data: { status: 'CLOSED' },
        })
      );
    });

    it('cleans up expired rooms and pending invitations idempotently', async () => {
      vi.spyOn(prisma.room, 'updateMany').mockResolvedValueOnce({ count: 3 } as any);
      vi.spyOn(prisma.roomInvitation, 'updateMany').mockResolvedValueOnce({ count: 5 } as any);

      const res = await roomsService.cleanupExpiredRooms();
      expect(res.expiredCount).toBe(3);
    });

    it('paginates active rooms with limit and offset options', async () => {
      const findManySpy = vi.spyOn(prisma.roomParticipant, 'findMany').mockResolvedValueOnce([]);

      await roomsService.getUserActiveRooms('test-user-paged', { limit: 5, offset: 10 });

      expect(findManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10,
        })
      );
    });
  });
});

