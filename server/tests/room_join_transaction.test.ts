import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { roomsService } from '../src/modules/rooms/rooms.service.js';
import { ROOM_STATUS, ROOM_PARTICIPANT_ROLES } from '../src/modules/rooms/rooms.constants.js';

const app = createApp();

const now = new Date();
const future = new Date(Date.now() + 60 * 60 * 1000);

function makeExistingRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-join-1',
    code: 'QDZLR2',
    name: 'Test Room',
    mode: 'COUPLE',
    status: ROOM_STATUS.WAITING,
    maxPlayers: 2,
    selectedGameId: 'between-us',
    hostId: 'host-user',
    expiresAt: future,
    participants: [{ userId: 'host-user', leftAt: null }],
    ...overrides,
  };
}

function makeCurrentRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-join-1',
    code: 'QDZLR2',
    name: 'Test Room',
    mode: 'COUPLE',
    status: ROOM_STATUS.WAITING,
    maxPlayers: 2,
    selectedGameId: 'between-us',
    hostId: 'host-user',
    expiresAt: future,
    ...overrides,
  };
}

function makeRoomSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-join-1',
    code: 'QDZLR2',
    name: 'Test Room',
    mode: 'COUPLE',
    status: ROOM_STATUS.WAITING,
    maxPlayers: 2,
    selectedGameId: 'between-us',
    hostId: 'host-user',
    createdAt: now,
    expiresAt: future,
    host: { displayName: 'Host A' },
    participants: [
      {
        userId: 'host-user',
        role: ROOM_PARTICIPANT_ROLES.HOST,
        isReady: true,
        leftAt: null,
        joinedAt: now,
        user: { displayName: 'Host A', username: 'host_a' },
      },
      {
        userId: 'joining-user',
        role: ROOM_PARTICIPANT_ROLES.PLAYER,
        isReady: false,
        leftAt: null,
        joinedAt: now,
        user: { displayName: 'Player B', username: 'player_b' },
      },
    ],
    gameVotes: [],
    messages: [],
    gameSessions: [],
    ...overrides,
  };
}

function configureJoinScenario(options: {
  existingRoom?: Record<string, unknown>;
  currentRoom?: Record<string, unknown>;
  activeCount?: number;
  existingParticipant?: Record<string, unknown> | null;
  blocked?: Record<string, unknown> | null;
} = {}) {
  const existingRoom = makeExistingRoom(options.existingRoom);
  const currentRoom = makeCurrentRoom(options.currentRoom);

  vi.spyOn(prisma.room, 'findUnique').mockResolvedValue(existingRoom as any);
  vi.spyOn(prisma.blockedUser, 'findFirst').mockResolvedValue((options.blocked ?? null) as any);

  let transactionCommitted = false;

  const tx = {
    room: {
      findUnique: vi.fn().mockResolvedValue(currentRoom),
      update: vi.fn().mockResolvedValue(currentRoom),
      findFirst: vi.fn(),
    },
    roomParticipant: {
      count: vi.fn().mockResolvedValue(options.activeCount ?? 1),
      findUnique: vi.fn().mockResolvedValue(options.existingParticipant ?? null),
      create: vi.fn().mockResolvedValue({
        id: 'participant-player-b',
        roomId: 'room-join-1',
        userId: 'joining-user',
        role: ROOM_PARTICIPANT_ROLES.PLAYER,
        isReady: false,
      }),
      update: vi.fn().mockResolvedValue({
        id: 'participant-player-b',
        roomId: 'room-join-1',
        userId: 'joining-user',
        role: ROOM_PARTICIPANT_ROLES.PLAYER,
        isReady: false,
        leftAt: null,
      }),
    },
    userProfile: {
      findUnique: vi.fn().mockResolvedValue({ id: 'joining-user', displayName: 'Player B' }),
    },
    roomMessage: {
      create: vi.fn().mockResolvedValue({ id: 'message-1' }),
    },
  };

  const transactionSpy = vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any, transactionOptions?: any) => {
    expect(transactionOptions).toEqual({ maxWait: 5000, timeout: 10000 });
    const result = await callback(tx);
    transactionCommitted = true;
    return result;
  });

  const snapshotSpy = vi.spyOn(prisma.room, 'findFirst').mockImplementation(async () => {
    expect(transactionCommitted).toBe(true);
    return makeRoomSnapshot() as any;
  });

  return { tx, transactionSpy, snapshotSpy };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Join Room transaction P2028 regression suite', () => {
  it('joins a new participant and loads the room snapshot after commit', async () => {
    const { tx, transactionSpy, snapshotSpy } = configureJoinScenario();

    const result = await roomsService.joinRoom('joining-user', ' qdzlr2 ');

    expect(transactionSpy).toHaveBeenCalledOnce();
    expect(tx.roomParticipant.create).toHaveBeenCalledWith({
      data: {
        roomId: 'room-join-1',
        userId: 'joining-user',
        role: ROOM_PARTICIPANT_ROLES.PLAYER,
        isReady: false,
      },
    });
    expect(tx.roomMessage.create).toHaveBeenCalledOnce();
    expect(tx.room.findFirst).not.toHaveBeenCalled();
    expect(snapshotSpy).toHaveBeenCalledOnce();
    expect(result.isNewJoin).toBe(true);
    expect(result.room.code).toBe('QDZLR2');
    expect(result.room.participants).toHaveLength(2);
  });

  it('returns an active participant idempotently without duplicate writes', async () => {
    const { tx, snapshotSpy } = configureJoinScenario({
      activeCount: 2,
      existingParticipant: {
        id: 'participant-player-b',
        roomId: 'room-join-1',
        userId: 'joining-user',
        leftAt: null,
      },
    });

    const result = await roomsService.joinRoom('joining-user', 'QDZLR2');

    expect(result.isNewJoin).toBe(false);
    expect(tx.roomParticipant.create).not.toHaveBeenCalled();
    expect(tx.roomParticipant.update).not.toHaveBeenCalled();
    expect(tx.roomMessage.create).not.toHaveBeenCalled();
    expect(tx.userProfile.findUnique).not.toHaveBeenCalled();
    expect(tx.room.findFirst).not.toHaveBeenCalled();
    expect(snapshotSpy).toHaveBeenCalledOnce();
  });

  it('reactivates a departed participant and resets a ready room to waiting', async () => {
    const departedAt = new Date(Date.now() - 60_000);
    const { tx } = configureJoinScenario({
      currentRoom: { status: ROOM_STATUS.READY_TO_START },
      existingRoom: { status: ROOM_STATUS.READY_TO_START },
      activeCount: 1,
      existingParticipant: {
        id: 'participant-player-b',
        roomId: 'room-join-1',
        userId: 'joining-user',
        leftAt: departedAt,
      },
    });

    const result = await roomsService.joinRoom('joining-user', 'QDZLR2');

    expect(tx.roomParticipant.update).toHaveBeenCalledWith({
      where: { id: 'participant-player-b' },
      data: expect.objectContaining({
        leftAt: null,
        isReady: false,
      }),
    });
    expect(tx.roomParticipant.create).not.toHaveBeenCalled();
    expect(tx.roomMessage.create).toHaveBeenCalledOnce();
    expect(tx.room.update).toHaveBeenCalledWith({
      where: { id: 'room-join-1' },
      data: { status: ROOM_STATUS.WAITING },
    });
    expect(result.isNewJoin).toBe(true);
  });

  it('rejects a join when the room is already at capacity', async () => {
    const { tx, snapshotSpy } = configureJoinScenario({ activeCount: 2 });

    await expect(roomsService.joinRoom('joining-user', 'QDZLR2')).rejects.toThrow(/is full/);

    expect(tx.roomParticipant.create).not.toHaveBeenCalled();
    expect(tx.roomMessage.create).not.toHaveBeenCalled();
    expect(snapshotSpy).not.toHaveBeenCalled();
  });

  it.each([ROOM_STATUS.CLOSED, ROOM_STATUS.EXPIRED])('rejects a %s room before starting a transaction', async (status) => {
    configureJoinScenario({
      existingRoom: { status },
      currentRoom: { status },
    });

    await expect(roomsService.joinRoom('joining-user', 'QDZLR2')).rejects.toThrow(/no longer active/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an expired room and marks it expired without opening a transaction', async () => {
    configureJoinScenario({
      existingRoom: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const updateSpy = vi.spyOn(prisma.room, 'update').mockResolvedValue({} as any);

    await expect(roomsService.joinRoom('joining-user', 'QDZLR2')).rejects.toThrow(/has expired/);

    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'room-join-1' },
      data: { status: ROOM_STATUS.EXPIRED },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a blocked user before starting a transaction', async () => {
    configureJoinScenario({
      blocked: { id: 'block-1', blockerId: 'host-user', blockedUserId: 'joining-user' },
    });

    await expect(roomsService.joinRoom('joining-user', 'QDZLR2')).rejects.toThrow(/blocked from entering/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('fails safely if the committed room snapshot cannot be loaded', async () => {
    const { snapshotSpy } = configureJoinScenario();
    snapshotSpy.mockResolvedValue(null as any);

    await expect(roomsService.joinRoom('joining-user', 'QDZLR2')).rejects.toThrow(/latest details could not be loaded/);
  });

  it('exposes the existing HTTP join response contract', async () => {
    const authUserId = 'http-join-user';
    vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue({
      id: authUserId,
      username: 'http_join_user',
      displayName: 'HTTP Join User',
      accountStatus: 'ACTIVE',
    } as any);

    const room = roomsService.formatRoomSnapshot(makeRoomSnapshot() as any)!;
    vi.spyOn(roomsService, 'joinRoom').mockResolvedValue({
      room,
      isNewJoin: true,
    });

    const response = await request(app)
      .post('/api/v1/rooms/join')
      .set('Authorization', 'Bearer test-mock-token-' + authUserId)
      .send({ code: 'QDZLR2' });

    expect(response.status).toBe(200);
    expect(response.body.isNewJoin).toBe(true);
    expect(response.body.room.code).toBe('QDZLR2');
    expect(roomsService.joinRoom).toHaveBeenCalledWith(authUserId, 'QDZLR2');
  });
});
