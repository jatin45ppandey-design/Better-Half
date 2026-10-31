import { describe, it, expect, vi, beforeEach } from 'vitest';
import { roomsService } from '../src/modules/rooms/rooms.service.js';
import { prisma } from '../src/config/prisma.js';
import { ROOM_STATUS, ROOM_PARTICIPANT_ROLES } from '../src/modules/rooms/rooms.constants.js';

describe('PlaySpace — Room Creation Transaction & P2028 Timeout Remediation Suite', () => {
  const mockHostProfile = {
    id: 'user-host-123',
    username: 'cosmic_host',
    displayName: 'Cosmic Host',
    avatarUrl: 'https://cdn.playspace.com/avatars/host.png',
    avatarInitials: 'CH',
    avatarColor: '#9670E8',
    accountStatus: 'ACTIVE',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully creates a Couple room with correct capacity and default game', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHostProfile as any);
    vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);

    const createdRoomRecord = {
      id: 'room-couple-uuid-1',
      code: 'CPL123',
      name: 'Cozy Couple Lounge',
      mode: 'COUPLE',
      status: ROOM_STATUS.WAITING,
      selectedGameId: 'between-us',
      maxPlayers: 2,
      hostId: mockHostProfile.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7200000),
    };

    const createdParticipantRecord = {
      id: 'part-cpl-1',
      roomId: createdRoomRecord.id,
      userId: mockHostProfile.id,
      role: ROOM_PARTICIPANT_ROLES.HOST,
      isReady: true,
      leftAt: null,
      joinedAt: new Date(),
    };

    const createdVoteRecord = {
      id: 'vote-cpl-1',
      roomId: createdRoomRecord.id,
      userId: mockHostProfile.id,
      gameId: 'between-us',
    };

    const createdMessageRecord = {
      id: 'msg-cpl-1',
      roomId: createdRoomRecord.id,
      senderId: mockHostProfile.id,
      message: 'Room CPL123 created in Couple Mode.',
      createdAt: new Date(),
    };

    const txMock = {
      room: {
        create: vi.fn().mockResolvedValue(createdRoomRecord),
      },
      roomParticipant: {
        create: vi.fn().mockResolvedValue(createdParticipantRecord),
      },
      gameVote: {
        create: vi.fn().mockResolvedValue(createdVoteRecord),
      },
      roomMessage: {
        create: vi.fn().mockResolvedValue(createdMessageRecord),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, options?: any) => {
      expect(options).toEqual({ maxWait: 5000, timeout: 10000 });
      return callback(txMock);
    });

    const snapshot = await roomsService.createRoom(mockHostProfile.id, {
      mode: 'couple',
    });

    expect(snapshot).toBeDefined();
    expect(snapshot!.id).toBe('room-couple-uuid-1');
    expect(snapshot!.mode).toBe('couple');
    expect(snapshot!.maxPlayers).toBe(2);
    expect(snapshot!.status).toBe(ROOM_STATUS.WAITING);
    expect(snapshot!.selectedGameId).toBe('between-us');
    expect(snapshot!.hostId).toBe(mockHostProfile.id);
    expect(snapshot!.hostName).toBe('Cosmic Host');
  });

  it('successfully creates a Friend room with capacity of 4 and default game', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHostProfile as any);
    vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);

    const createdRoomRecord = {
      id: 'room-friend-uuid-2',
      code: 'FRND88',
      name: 'Game Night Squad',
      mode: 'FRIEND',
      status: ROOM_STATUS.WAITING,
      selectedGameId: 'uno-style',
      maxPlayers: 4,
      hostId: mockHostProfile.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7200000),
    };

    const createdParticipantRecord = {
      id: 'part-frnd-1',
      roomId: createdRoomRecord.id,
      userId: mockHostProfile.id,
      role: ROOM_PARTICIPANT_ROLES.HOST,
      isReady: true,
      leftAt: null,
      joinedAt: new Date(),
    };

    const createdVoteRecord = {
      id: 'vote-frnd-1',
      roomId: createdRoomRecord.id,
      userId: mockHostProfile.id,
      gameId: 'uno-style',
    };

    const createdMessageRecord = {
      id: 'msg-frnd-1',
      roomId: createdRoomRecord.id,
      senderId: mockHostProfile.id,
      message: 'Room FRND88 created in Friend Mode.',
      createdAt: new Date(),
    };

    const txMock = {
      room: {
        create: vi.fn().mockResolvedValue(createdRoomRecord),
      },
      roomParticipant: {
        create: vi.fn().mockResolvedValue(createdParticipantRecord),
      },
      gameVote: {
        create: vi.fn().mockResolvedValue(createdVoteRecord),
      },
      roomMessage: {
        create: vi.fn().mockResolvedValue(createdMessageRecord),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, options?: any) => {
      expect(options).toEqual({ maxWait: 5000, timeout: 10000 });
      return callback(txMock);
    });

    const snapshot = await roomsService.createRoom(mockHostProfile.id, {
      mode: 'friend',
      name: 'Custom Squad Lounge',
    });

    expect(snapshot).toBeDefined();
    expect(snapshot!.id).toBe('room-friend-uuid-2');
    expect(snapshot!.name).toBe('Game Night Squad');
    expect(snapshot!.mode).toBe('friend');
    expect(snapshot!.maxPlayers).toBe(4);
    expect(snapshot!.selectedGameId).toBe('uno-style');
  });

  it('correctly creates host participant with role HOST and ready state', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHostProfile as any);
    vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);

    const participantCreateSpy = vi.fn().mockResolvedValue({
      id: 'part-host-01',
      roomId: 'room-part-check',
      userId: mockHostProfile.id,
      role: ROOM_PARTICIPANT_ROLES.HOST,
      isReady: true,
      leftAt: null,
      joinedAt: new Date('2026-10-31T12:00:00Z'),
    });

    const txMock = {
      room: {
        create: vi.fn().mockResolvedValue({
          id: 'room-part-check',
          code: 'HOST01',
          name: 'Host Room',
          mode: 'COUPLE',
          status: ROOM_STATUS.WAITING,
          selectedGameId: 'between-us',
          maxPlayers: 2,
          hostId: mockHostProfile.id,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7200000),
        }),
      },
      roomParticipant: {
        create: participantCreateSpy,
      },
      gameVote: {
        create: vi.fn().mockResolvedValue({ id: 'v1', gameId: 'between-us', userId: mockHostProfile.id }),
      },
      roomMessage: {
        create: vi.fn().mockResolvedValue({ id: 'm1', senderId: mockHostProfile.id, message: 'hi', createdAt: new Date() }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback(txMock));

    const snapshot = await roomsService.createRoom(mockHostProfile.id, { mode: 'couple' });

    expect(participantCreateSpy).toHaveBeenCalledWith({
      data: {
        roomId: 'room-part-check',
        userId: mockHostProfile.id,
        role: ROOM_PARTICIPANT_ROLES.HOST,
        isReady: true,
      },
    });

    expect(snapshot!.participants).toHaveLength(1);
    const hostParticipant = snapshot!.participants[0];
    expect(hostParticipant.userId).toBe(mockHostProfile.id);
    expect(hostParticipant.isHost).toBe(true);
    expect(hostParticipant.isReady).toBe(true);
    expect(hostParticipant.role).toBe('HOST');
    expect(hostParticipant.displayName).toBe('Cosmic Host');
    expect(hostParticipant.avatarUrl).toBe('https://cdn.playspace.com/avatars/host.png');
  });

  it('correctly creates initial game vote by host for selected game', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHostProfile as any);
    vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);

    const gameVoteCreateSpy = vi.fn().mockResolvedValue({
      id: 'vote-check-01',
      roomId: 'room-vote-check',
      userId: mockHostProfile.id,
      gameId: 'tic-tac-toe',
    });

    const txMock = {
      room: {
        create: vi.fn().mockResolvedValue({
          id: 'room-vote-check',
          code: 'VOTE01',
          name: 'Vote Room',
          mode: 'FRIEND',
          status: ROOM_STATUS.WAITING,
          selectedGameId: 'tic-tac-toe',
          maxPlayers: 4,
          hostId: mockHostProfile.id,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7200000),
        }),
      },
      roomParticipant: {
        create: vi.fn().mockResolvedValue({
          id: 'part-v',
          roomId: 'room-vote-check',
          userId: mockHostProfile.id,
          role: ROOM_PARTICIPANT_ROLES.HOST,
          isReady: true,
          joinedAt: new Date(),
        }),
      },
      gameVote: {
        create: gameVoteCreateSpy,
      },
      roomMessage: {
        create: vi.fn().mockResolvedValue({ id: 'm1', senderId: mockHostProfile.id, message: 'hi', createdAt: new Date() }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback(txMock));

    const snapshot = await roomsService.createRoom(mockHostProfile.id, {
      mode: 'friend',
      selectedGameId: 'tic-tac-toe',
    });

    expect(gameVoteCreateSpy).toHaveBeenCalledWith({
      data: {
        roomId: 'room-vote-check',
        userId: mockHostProfile.id,
        gameId: 'tic-tac-toe',
      },
    });

    expect(snapshot!.gameVotes).toHaveProperty('tic-tac-toe');
    expect(snapshot!.gameVotes['tic-tac-toe']).toContain(mockHostProfile.id);
  });

  it('correctly creates welcome message from host', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHostProfile as any);
    vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);

    const messageCreateSpy = vi.fn().mockResolvedValue({
      id: 'msg-welcome-01',
      roomId: 'room-msg-check',
      senderId: mockHostProfile.id,
      message: 'Room WELC01 created in Couple Mode.',
      createdAt: new Date('2026-10-31T12:00:00Z'),
    });

    const txMock = {
      room: {
        create: vi.fn().mockResolvedValue({
          id: 'room-msg-check',
          code: 'WELC01',
          name: 'Welcome Room',
          mode: 'COUPLE',
          status: ROOM_STATUS.WAITING,
          selectedGameId: 'between-us',
          maxPlayers: 2,
          hostId: mockHostProfile.id,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7200000),
        }),
      },
      roomParticipant: {
        create: vi.fn().mockResolvedValue({
          id: 'part-w',
          roomId: 'room-msg-check',
          userId: mockHostProfile.id,
          role: ROOM_PARTICIPANT_ROLES.HOST,
          isReady: true,
          joinedAt: new Date(),
        }),
      },
      gameVote: {
        create: vi.fn().mockResolvedValue({ id: 'v1', gameId: 'between-us', userId: mockHostProfile.id }),
      },
      roomMessage: {
        create: messageCreateSpy,
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback(txMock));

    const snapshot = await roomsService.createRoom(mockHostProfile.id, { mode: 'couple' });

    expect(messageCreateSpy).toHaveBeenCalledWith({
      data: {
        roomId: 'room-msg-check',
        senderId: mockHostProfile.id,
        message: expect.stringContaining('created in Couple Mode.'),
      },
    });

    expect(snapshot!.chatMessages).toHaveLength(1);
    expect(snapshot!.chatMessages[0].id).toBe('msg-welcome-01');
    expect(snapshot!.chatMessages[0].senderId).toBe(mockHostProfile.id);
    expect(snapshot!.chatMessages[0].senderName).toBe('Cosmic Host');
    expect(snapshot!.chatMessages[0].text).toContain('created in Couple Mode.');
  });

  it('returns complete, correctly formatted RoomSnapshot response', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHostProfile as any);
    vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);

    const now = new Date();
    const expiresAt = new Date(Date.now() + 7200000);

    const txMock = {
      room: {
        create: vi.fn().mockResolvedValue({
          id: 'room-snapshot-test',
          code: 'SNAP99',
          name: 'Snapshot Test Room',
          mode: 'COUPLE',
          status: ROOM_STATUS.WAITING,
          selectedGameId: 'between-us',
          maxPlayers: 2,
          hostId: mockHostProfile.id,
          createdAt: now,
          expiresAt,
        }),
      },
      roomParticipant: {
        create: vi.fn().mockResolvedValue({
          id: 'part-snap',
          roomId: 'room-snapshot-test',
          userId: mockHostProfile.id,
          role: ROOM_PARTICIPANT_ROLES.HOST,
          isReady: true,
          joinedAt: now,
        }),
      },
      gameVote: {
        create: vi.fn().mockResolvedValue({
          id: 'vote-snap',
          roomId: 'room-snapshot-test',
          userId: mockHostProfile.id,
          gameId: 'between-us',
        }),
      },
      roomMessage: {
        create: vi.fn().mockResolvedValue({
          id: 'msg-snap',
          roomId: 'room-snapshot-test',
          senderId: mockHostProfile.id,
          message: 'Room SNAP99 created in Couple Mode.',
          createdAt: now,
        }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => callback(txMock));

    const snapshot = await roomsService.createRoom(mockHostProfile.id, { mode: 'couple' });

    expect(snapshot).toEqual({
      id: 'room-snapshot-test',
      code: 'SNAP99',
      name: 'Snapshot Test Room',
      mode: 'couple',
      status: ROOM_STATUS.WAITING,
      maxPlayers: 2,
      selectedGameId: 'between-us',
      activeSessionId: null,
      activeSessionStatus: null,
      hostId: mockHostProfile.id,
      hostName: 'Cosmic Host',
      participants: [
        {
          id: mockHostProfile.id,
          userId: mockHostProfile.id,
          name: 'Cosmic Host',
          displayName: 'Cosmic Host',
          username: 'cosmic_host',
          avatarInitials: 'CH',
          avatarColor: '#9670E8',
          avatarUrl: 'https://cdn.playspace.com/avatars/host.png',
          isHost: true,
          isReady: true,
          role: 'HOST',
          joinedAt: now,
        },
      ],
      gameVotes: {
        'between-us': [mockHostProfile.id],
      },
      chatMessages: [
        {
          id: 'msg-snap',
          senderId: mockHostProfile.id,
          senderName: 'Cosmic Host',
          text: 'Room SNAP99 created in Couple Mode.',
          timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isSystem: false,
          createdAt: now,
        },
      ],
      createdAt: now,
      expiresAt,
    });
  });

  it('transaction failure rolls back all room writes and rejects', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHostProfile as any);
    vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);

    const txMock = {
      room: {
        create: vi.fn().mockResolvedValue({
          id: 'room-fail-test',
          code: 'FAIL99',
        }),
      },
      roomParticipant: {
        create: vi.fn().mockResolvedValue({ id: 'p1' }),
      },
      gameVote: {
        create: vi.fn().mockRejectedValue(new Error('DB transaction constraint violation')),
      },
      roomMessage: {
        create: vi.fn(),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
      return callback(txMock);
    });

    await expect(
      roomsService.createRoom(mockHostProfile.id, { mode: 'couple' })
    ).rejects.toThrow('DB transaction constraint violation');

    // Message creation was never reached due to earlier failure in transaction
    expect(txMock.roomMessage.create).not.toHaveBeenCalled();
  });

  it('the final room snapshot does not issue a heavy relation read inside the interactive transaction', async () => {
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue(mockHostProfile as any);
    vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(null);

    const txRoomFindFirstSpy = vi.fn();
    const globalRoomFindFirstSpy = vi.spyOn(prisma.room, 'findFirst');

    const txMock = {
      room: {
        create: vi.fn().mockResolvedValue({
          id: 'room-no-query-check',
          code: 'NOQRY1',
          name: 'No Query Room',
          mode: 'COUPLE',
          status: ROOM_STATUS.WAITING,
          selectedGameId: 'between-us',
          maxPlayers: 2,
          hostId: mockHostProfile.id,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 7200000),
        }),
        findFirst: txRoomFindFirstSpy,
      },
      roomParticipant: {
        create: vi.fn().mockResolvedValue({
          id: 'p1',
          userId: mockHostProfile.id,
          role: ROOM_PARTICIPANT_ROLES.HOST,
          isReady: true,
          joinedAt: new Date(),
        }),
      },
      gameVote: {
        create: vi.fn().mockResolvedValue({ id: 'v1', gameId: 'between-us', userId: mockHostProfile.id }),
      },
      roomMessage: {
        create: vi.fn().mockResolvedValue({ id: 'm1', senderId: mockHostProfile.id, message: 'hi', createdAt: new Date() }),
      },
    };

    vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, options?: any) => {
      // Assert explicit transaction timeout options were passed
      expect(options).toEqual({ maxWait: 5000, timeout: 10000 });
      return callback(txMock);
    });

    await roomsService.createRoom(mockHostProfile.id, { mode: 'couple' });

    // Assert that findRoomWithRelations was NOT called on the transaction client
    expect(txRoomFindFirstSpy).not.toHaveBeenCalled();
    // Assert that findRoomWithRelations was NOT called on the global prisma client either
    expect(globalRoomFindFirstSpy).not.toHaveBeenCalled();
  });
});
