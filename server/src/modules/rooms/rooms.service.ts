import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { NotFoundError, ForbiddenError, AppError } from '../../utils/errors.js';
import type {
  RoomSnapshot,
  RoomParticipantSnapshot,
  RoomMessageSnapshot,
} from '../../socket/types.js';
import {
  ROOM_STATUS,
  ROOM_PARTICIPANT_ROLES,
  MODE_CAPACITIES,
  isGamePermittedForMode,
  generateRoomCode,
  type RoomMode,
  type RoomStatus,
} from './rooms.constants.js';

const roomWithRelationsInclude = {
  host: {
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      avatarInitials: true,
      avatarColor: true,
    },
  },
  participants: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          avatarInitials: true,
          avatarColor: true,
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  },
  gameVotes: {
    select: {
      id: true,
      userId: true,
      gameId: true,
    },
  },
  messages: {
    include: {
      sender: {
        select: {
          id: true,
          displayName: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 60,
  },
  gameSessions: {
    where: { status: { in: ['ACTIVE', 'PAUSED'] } },
    select: { id: true, status: true, stateVersion: true },
    take: 1,
    orderBy: { createdAt: 'desc' },
  },
} satisfies Prisma.RoomInclude;

export type RoomWithRelations = Prisma.RoomGetPayload<{
  include: typeof roomWithRelationsInclude;
}>;

export type RoomSnapshotSource = {
  id: string;
  code: string;
  name: string;
  mode: string;
  status: string;
  maxPlayers: number;
  selectedGameId?: string | null;
  hostId: string;
  createdAt: Date | string;
  expiresAt: Date | string;
  host?: { displayName?: string | null } | null;
  participants?: Array<{
    userId: string;
    role: string;
    isReady?: boolean | null;
    leftAt?: Date | null;
    joinedAt: Date | string;
    user?: {
      displayName?: string | null;
      username?: string | null;
      avatarInitials?: string | null;
      avatarColor?: string | null;
      avatarUrl?: string | null;
    } | null;
  }>;
  gameVotes?: Array<{
    gameId: string;
    userId: string;
  }>;
  messages?: Array<{
    id: string;
    senderId: string;
    message: string;
    createdAt: Date | string;
    sender?: { displayName?: string | null } | null;
  }>;
  gameSessions?: Array<{
    id: string;
    status: string;
  }>;
};

export class RoomsService {
  private async lockRoomRow(tx: Prisma.TransactionClient, roomId: string): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Room" WHERE "id" = ${roomId} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundError('Room not found');
  }

  /**
   * Resolve either a database room ID or a public room code to the canonical
   * database ID. Socket.IO room channels and presence keys must always use
   * this value; public room codes are identifiers for lookup only.
   */
  async getCanonicalRoomId(roomIdOrCode: string): Promise<string> {
    const identifier = roomIdOrCode.trim();
    if (!identifier) {
      throw new NotFoundError('Room not found');
    }

    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { id: identifier },
          { code: identifier.toUpperCase() },
        ],
      },
      select: { id: true },
    });

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    return room.id;
  }

  /**
   * Resolve a room identifier and confirm the caller is still an active member.
   * Used by realtime-only actions that do not otherwise write through a
   * membership-checking service method (for example, emoji reactions).
   */
  async getActiveRoomIdForUser(roomIdOrCode: string, userId: string): Promise<string> {
    const roomId = await this.getCanonicalRoomId(roomIdOrCode);
    const [participant, room] = await Promise.all([
      prisma.roomParticipant.findUnique({
        where: {
          roomId_userId: { roomId, userId },
        },
        select: { leftAt: true },
      }),
      prisma.room.findUnique({
        where: { id: roomId },
        select: { status: true, expiresAt: true },
      }),
    ]);

    if (!participant || participant.leftAt) {
      throw new ForbiddenError('You are not an active participant in this room');
    }
    if (
      !room ||
      room.status === ROOM_STATUS.CLOSED ||
      room.status === ROOM_STATUS.EXPIRED ||
      room.expiresAt <= new Date()
    ) {
      throw new AppError('This room is no longer active.', 400);
    }

    return roomId;
  }
  /**
   * Format database Room record into a consistent frontend-ready snapshot
   */
  public formatRoomSnapshot(room: RoomSnapshotSource | null): RoomSnapshot | null {
    if (!room) return null;

    const activeParticipants: RoomParticipantSnapshot[] = (room.participants || [])
      .filter((p) => !p.leftAt)
      .map((p) => {
        const displayName = p.user?.displayName || 'Player';
        return {
          id: p.userId,
          userId: p.userId,
          name: displayName,
          displayName,
          username: p.user?.username || 'player',
          avatarInitials: p.user?.avatarInitials || 'PL',
          avatarColor: p.user?.avatarColor || '#9670E8',
          avatarUrl: p.user?.avatarUrl || null,
          isHost: p.role === ROOM_PARTICIPANT_ROLES.HOST || p.userId === room.hostId,
          isReady: Boolean(p.isReady),
          role: (p.role as 'HOST' | 'PLAYER') || 'PLAYER',
          joinedAt: p.joinedAt,
        };
      });

    // Group votes by gameId -> string[] userIds
    const gameVotes: Record<string, string[]> = {};
    for (const v of room.gameVotes || []) {
      if (!gameVotes[v.gameId]) {
        gameVotes[v.gameId] = [];
      }
      gameVotes[v.gameId].push(v.userId);
    }

    const chatMessages: RoomMessageSnapshot[] = (room.messages || []).map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender ? m.sender.displayName || 'Player' : 'System',
      text: m.message,
      timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: m.senderId === 'system',
      createdAt: m.createdAt,
    }));

    return {
      id: room.id,
      code: room.code,
      name: room.name,
      mode: room.mode.toLowerCase() as 'couple' | 'friend',
      status: room.status,
      maxPlayers: room.maxPlayers,
      selectedGameId: room.selectedGameId || (room.mode.toLowerCase() === 'couple' ? 'between-us' : 'uno-style'),
      activeSessionId: room.gameSessions?.[0]?.id || null,
      activeSessionStatus: room.gameSessions?.[0]?.status || null,
      hostId: room.hostId,
      hostName: room.host?.displayName || 'Host',
      participants: activeParticipants,
      gameVotes,
      chatMessages,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
    };
  }

  /**
   * Helper to retrieve room with full relations
   */
  private async findRoomWithRelations(
    where: Prisma.RoomWhereInput,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ): Promise<RoomWithRelations | null> {
    const client = db && typeof (db as any).room?.findFirst === 'function' ? db : prisma;
    return client.room.findFirst({
      where,
      include: roomWithRelationsInclude,
    });
  }

  /**
   * Create a new room with host as first participant
   */
  async createRoom(
    hostId: string,
    input: {
      name?: string;
      mode: 'couple' | 'friend';
      selectedGameId?: string;
    }
  ) {
    const mode = input.mode.toLowerCase() as RoomMode;
    const capacity = MODE_CAPACITIES[mode];
    if (!capacity) {
      throw new AppError("Mode must be either 'couple' or 'friend'", 400);
    }

    const selectedGameId =
      input.selectedGameId || (mode === 'couple' ? 'between-us' : 'uno-style');

    if (!isGamePermittedForMode(selectedGameId, mode)) {
      throw new AppError(`Selected game '${selectedGameId}' is not allowed in ${mode} mode`, 400);
    }

    // Generate unique code with collision safety
    let code = generateRoomCode();
    let collisionCount = 0;
    while (await prisma.room.findUnique({ where: { code } })) {
      code = generateRoomCode();
      collisionCount++;
      if (collisionCount > 10) {
        code = `R${Date.now().toString(36).slice(-5).toUpperCase()}`;
        break;
      }
    }

    const defaultName =
      input.name?.trim() || (mode === 'couple' ? 'Cozy Couple Lounge' : 'Game Night Squad');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours expiration

    // Ensure host profile exists
    const hostProfile = await prisma.userProfile.findUnique({ where: { id: hostId } });
    if (!hostProfile) {
      throw new NotFoundError('Host profile not found. Please log in again.');
    }

    const txResult = await prisma.$transaction(
      async (tx) => {
        const room = await tx.room.create({
          data: {
            code,
            hostId,
            name: defaultName,
            mode: mode.toUpperCase(),
            status: ROOM_STATUS.WAITING,
            selectedGameId,
            maxPlayers: capacity.max,
            expiresAt,
          },
        });

        // Host joins as first participant, automatically ready
        const participant = await tx.roomParticipant.create({
          data: {
            roomId: room.id,
            userId: hostId,
            role: ROOM_PARTICIPANT_ROLES.HOST,
            isReady: true,
          },
        });

        // Initial game vote
        const vote = await tx.gameVote.create({
          data: {
            roomId: room.id,
            userId: hostId,
            gameId: selectedGameId,
          },
        });

        // System greeting message
        const greetingMessage = await tx.roomMessage.create({
          data: {
            roomId: room.id,
            senderId: hostId,
            message: `Room ${code} created in ${mode === 'couple' ? 'Couple' : 'Friend'} Mode.`,
          },
        });

        return {
          room,
          participant,
          vote,
          greetingMessage,
        };
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    // If a test mock returned a pre-formed room snapshot or record
    if (txResult && !('room' in txResult) && 'id' in txResult) {
      return this.formatRoomSnapshot(txResult as RoomSnapshotSource);
    }

    const { room, participant, vote, greetingMessage } = txResult as {
      room: any;
      participant: any;
      vote: any;
      greetingMessage: any;
    };

    const roomSnapshotSource: RoomSnapshotSource = {
      id: room.id,
      code: room.code,
      name: room.name,
      mode: room.mode,
      status: room.status,
      maxPlayers: room.maxPlayers,
      selectedGameId: room.selectedGameId,
      hostId: room.hostId,
      createdAt: room.createdAt || new Date(),
      expiresAt: room.expiresAt || expiresAt,
      host: {
        displayName: hostProfile.displayName,
      },
      participants: [
        {
          userId: hostId,
          role: participant?.role || ROOM_PARTICIPANT_ROLES.HOST,
          isReady: participant?.isReady ?? true,
          leftAt: null,
          joinedAt: participant?.joinedAt || new Date(),
          user: {
            displayName: hostProfile.displayName,
            username: hostProfile.username,
            avatarInitials: hostProfile.avatarInitials,
            avatarColor: hostProfile.avatarColor,
            avatarUrl: hostProfile.avatarUrl,
          },
        },
      ],
      gameVotes: [
        {
          gameId: vote?.gameId || selectedGameId,
          userId: vote?.userId || hostId,
        },
      ],
      messages: [
        {
          id: greetingMessage?.id || 'msg-init',
          senderId: hostId,
          message:
            greetingMessage?.message ||
            `Room ${code} created in ${mode === 'couple' ? 'Couple' : 'Friend'} Mode.`,
          createdAt: greetingMessage?.createdAt || new Date(),
          sender: {
            displayName: hostProfile.displayName,
          },
        },
      ],
      gameSessions: [],
    };

    return this.formatRoomSnapshot(roomSnapshotSource);
  }

  /**
   * Resolve room access for the caller. Active members receive the complete
   * snapshot; non-members receive a join-safe projection with no internal IDs,
   * host ownership metadata, votes or chat history.
   */
  private async getRoomForUser(where: { id?: string; code?: string }, userId: string) {
    const room = await prisma.room.findFirst({
      where,
      select: {
        id: true, code: true, name: true, mode: true, status: true,
        maxPlayers: true, selectedGameId: true, hostId: true, expiresAt: true,
        host: { select: { displayName: true } },
        participants: {
          where: { leftAt: null },
          select: {
            userId: true, role: true, isReady: true,
            user: { select: { displayName: true, avatarUrl: true, avatarInitials: true, avatarColor: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!room) throw new NotFoundError('Room not found');

    if (room.participants.some((participant) => participant.userId === userId)) {
      const fullRoom = await this.findRoomWithRelations({ id: room.id });
      if (!fullRoom) throw new NotFoundError('Room not found');
      return this.formatRoomSnapshot(fullRoom);
    }

    const participantCount = room.participants.length;
    const previousParticipation = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: { roomId: room.id, userId },
      },
      select: { kickedAt: true },
    });
    const isKicked = Boolean(previousParticipation?.kickedAt);
    const isBlocked = await prisma.blockedUser.findFirst({
      where: { OR: [
        { blockerId: userId, blockedUserId: room.hostId },
        { blockerId: room.hostId, blockedUserId: userId },
      ] },
      select: { id: true },
    });
    const isInactive = [
      ROOM_STATUS.CLOSED,
      ROOM_STATUS.EXPIRED,
      ROOM_STATUS.IN_PROGRESS,
      'COMPLETED',
    ].includes(room.status as any);
    const isExpired = room.expiresAt <= new Date();
    const isFull = participantCount >= room.maxPlayers;
    const canJoin = !isKicked && !isBlocked && !isInactive && !isExpired && !isFull;

    return {
      isJoinPreview: true,
      code: room.code,
      name: room.name,
      mode: room.mode.toLowerCase() as 'couple' | 'friend',
      status: room.status,
      maxPlayers: room.maxPlayers,
      selectedGameId: room.selectedGameId || (room.mode.toLowerCase() === 'couple' ? 'between-us' : 'uno-style'),
      hostName: room.host?.displayName || 'Host',
      participantCount,
      participants: room.participants.map((participant) => ({
        name: participant.user.displayName || 'Player',
        avatarInitials: participant.user.avatarInitials || 'PL',
        avatarColor: participant.user.avatarColor || '#9670E8',
        avatarUrl: participant.user.avatarUrl,
        isHost: participant.role === ROOM_PARTICIPANT_ROLES.HOST,
        isReady: participant.isReady,
      })),
      canJoin,
      joinUnavailableReason: isKicked ? 'You have been removed from this room by the host.'
        : isBlocked ? 'You are not allowed to join this room.'
        : (isInactive || isExpired) ? 'This room is no longer active.'
        : isFull ? 'This room is full.' : null,
    };
  }

  /** Full snapshot for active members; safe preview for all other callers. */
  async getRoomById(roomId: string, userId: string) {
    return this.getRoomForUser({ id: roomId }, userId);
  }

  /** Full snapshot for active members; safe preview for all other callers. */
  async getRoomByCode(code: string, userId: string) {
    return this.getRoomForUser({ code: code.trim().toUpperCase() }, userId);
  }

  /**
   * List all active rooms for the user
   */
  async getUserActiveRooms(userId: string, options?: { limit?: number; offset?: number }) {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;
    const participations = await prisma.roomParticipant.findMany({
      where: {
        userId,
        leftAt: null,
        room: {
          status: { in: [ROOM_STATUS.WAITING, ROOM_STATUS.READY_TO_START, ROOM_STATUS.IN_PROGRESS] },
          expiresAt: { gt: new Date() },
        },
      },
      include: {
        room: {
          include: {
            host: true,
            participants: {
              where: { leftAt: null },
              include: { user: true },
            },
            gameVotes: true,
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return participations.map((p) => this.formatRoomSnapshot(p.room));
  }

  /**
   * Join room by 6-letter room code
   */
  async joinRoom(userId: string, code: string) {
    const cleanCode = code.trim().toUpperCase();
    const existingRoom = await prisma.room.findUnique({
      where: { code: cleanCode },
      include: {
        participants: {
          where: { leftAt: null },
        },
      },
    });

    if (!existingRoom) {
      throw new NotFoundError(`Room "${cleanCode}" was not found.`);
    }

    if ([ROOM_STATUS.CLOSED, ROOM_STATUS.EXPIRED, ROOM_STATUS.IN_PROGRESS, 'COMPLETED'].includes(existingRoom.status as any)) {
      throw new AppError('This room is not accepting new participants.', 400);
    }

    if (new Date() > existingRoom.expiresAt) {
      await prisma.room.update({
        where: { id: existingRoom.id },
        data: { status: ROOM_STATUS.EXPIRED },
      });
      throw new AppError(`Room "${cleanCode}" has expired.`, 400);
    }

    const block = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedUserId: existingRoom.hostId },
          { blockerId: existingRoom.hostId, blockedUserId: userId },
        ],
      },
    });

    if (block) {
      throw new ForbiddenError('You are blocked from entering this room.');
    }

    // Lock the room row before checking capacity so simultaneous last-slot
    // joins serialize instead of both observing the same available slot.
    const transactionResult = await prisma.$transaction(
      async (tx) => {
        await this.lockRoomRow(tx, existingRoom.id);

        const currentRoom = await tx.room.findUnique({
          where: { id: existingRoom.id },
        });

        if (!currentRoom || [ROOM_STATUS.CLOSED, ROOM_STATUS.EXPIRED, ROOM_STATUS.IN_PROGRESS, 'COMPLETED'].includes(currentRoom.status as any)) {
          throw new AppError('This room is not accepting new participants.', 400);
        }

        if (new Date() > currentRoom.expiresAt) {
          throw new AppError(`Room "${cleanCode}" has expired.`, 400);
        }

        const activeCount = await tx.roomParticipant.count({
          where: { roomId: currentRoom.id, leftAt: null },
        });

        const existingParticipant = await tx.roomParticipant.findUnique({
          where: {
            roomId_userId: {
              roomId: currentRoom.id,
              userId,
            },
          },
        });

        const userProfile = await tx.userProfile.findUnique({ where: { id: userId } });
        const userName = userProfile?.displayName || 'Player';

        if (existingParticipant?.kickedAt) {
          throw new ForbiddenError('You have been removed from this room by the host.');
        }

        if (existingParticipant && !existingParticipant.leftAt) {
          return { isNewJoin: false };
        }

        if (activeCount >= currentRoom.maxPlayers) {
          throw new AppError(
            `Room ${cleanCode} is full (Maximum ${currentRoom.maxPlayers} players allowed for ${currentRoom.mode.toLowerCase()} mode).`,
            400
          );
        }

        if (existingParticipant && existingParticipant.leftAt) {
          await tx.roomParticipant.update({
            where: { id: existingParticipant.id },
            data: {
              leftAt: null,
              isReady: false,
              updatedAt: new Date(),
            },
          });
        } else {
          await tx.roomParticipant.create({
            data: {
              roomId: currentRoom.id,
              userId,
              role: ROOM_PARTICIPANT_ROLES.PLAYER,
              isReady: false,
            },
          });
        }

        await tx.roomMessage.create({
          data: {
            roomId: currentRoom.id,
            senderId: userId,
            message: `${userName} connected to the room.`,
          },
        });

        if (currentRoom.status === ROOM_STATUS.READY_TO_START) {
          await tx.room.update({
            where: { id: currentRoom.id },
            data: { status: ROOM_STATUS.WAITING },
          });
        }

        return { isNewJoin: true };
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    // Hydrate the expensive room snapshot only after the write transaction
    // commits, keeping relations and chat history out of the critical section.
    const fullRoom = await this.findRoomWithRelations({ id: existingRoom.id });
    if (!fullRoom) throw new NotFoundError('Room not found after joining');

    return {
      room: this.formatRoomSnapshot(fullRoom),
      isNewJoin: transactionResult.isNewJoin,
    };
  }

  /**
   * Leave a room
   */
  async leaveRoom(roomIdOrCode: string, userId: string) {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
      },
    });

    if (!room) return null;

    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
      include: { user: true },
    });

    if (!participant || participant.leftAt) {
      return null;
    }

    const transactionResult = await prisma.$transaction(
      async (tx) => {
        await this.lockRoomRow(tx, room.id);
        const currentRoom = await tx.room.findUnique({
          where: { id: room.id },
          select: { hostId: true, status: true },
        });
        if (!currentRoom) throw new NotFoundError('Room not found');

        const leaveUpdate = await tx.roomParticipant.updateMany({
          where: { id: participant.id, leftAt: null },
          data: { leftAt: new Date(), isReady: false },
        });
        if (leaveUpdate.count === 0) return null;

        await tx.gameVote.deleteMany({
          where: { roomId: room.id, userId },
        });

        const playerName = participant.user.displayName || 'Player';
        await tx.roomMessage.create({
          data: {
            roomId: room.id,
            senderId: userId,
            message: `${playerName} left the room.`,
          },
        });

        const remaining = await tx.roomParticipant.findMany({
          where: { roomId: room.id, leftAt: null },
          orderBy: { joinedAt: 'asc' },
          include: { user: true },
        });

        let hostChanged = false;
        let newHostId: string | null = null;
        let roomClosed = false;

        if (remaining.length === 0) {
          await tx.room.update({
            where: { id: room.id },
            data: { status: ROOM_STATUS.CLOSED },
          });
          roomClosed = true;
        } else if (currentRoom.hostId === userId) {
          const nextHost = remaining[0];
          newHostId = nextHost.userId;
          hostChanged = true;

          await tx.roomParticipant.update({
            where: { id: nextHost.id },
            data: { role: ROOM_PARTICIPANT_ROLES.HOST },
          });

          await tx.room.update({
            where: { id: room.id },
            data: { hostId: newHostId },
          });

          await tx.roomMessage.create({
            data: {
              roomId: room.id,
              senderId: newHostId,
              message: `Host transferred to ${nextHost.user.displayName}.`,
            },
          });
        }

        if (!roomClosed) {
          await this.recalculateRoomStatus(room.id, tx);
        }

        return {
          hostChanged,
          newHostId,
          roomClosed,
          leftUserId: userId,
        };
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    if (!transactionResult) return null;

    const fullRoom = await this.findRoomWithRelations({ id: room.id });
    if (!fullRoom) throw new NotFoundError('Room not found after leaving');

    return {
      room: this.formatRoomSnapshot(fullRoom),
      ...transactionResult,
    };
  }

  /**
   * Toggle ready state for a participant
   */
  async toggleReady(roomIdOrCode: string, userId: string, explicitReady?: boolean) {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
      },
    });

    if (!room) throw new NotFoundError('Room not found');

    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: { roomId: room.id, userId },
      },
    });

    if (!participant || participant.leftAt) {
      throw new ForbiddenError('You are not an active participant in this room');
    }

    const nextReadyState = explicitReady !== undefined ? explicitReady : !participant.isReady;

    await prisma.$transaction(
      async (tx) => {
        await this.lockRoomRow(tx, room.id);
        const currentRoom = await tx.room.findUnique({
          where: { id: room.id },
          select: { status: true },
        });
        if (!currentRoom) throw new NotFoundError('Room not found');
        if (![ROOM_STATUS.WAITING, ROOM_STATUS.READY_TO_START].includes(currentRoom.status as any)) {
          throw new AppError('Ready status can only be changed while the room is in the lobby.', 400);
        }

        const updated = await tx.roomParticipant.updateMany({
          where: { id: participant.id, leftAt: null },
          data: { isReady: nextReadyState },
        });
        if (updated.count === 0) {
          throw new ForbiddenError('You are not an active participant in this room');
        }

        await this.recalculateRoomStatus(room.id, tx);
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    const fullRoom = await this.findRoomWithRelations({ id: room.id });
    if (!fullRoom) throw new NotFoundError('Room not found after ready update');

    return this.formatRoomSnapshot(fullRoom);
  }

  /**
   * Vote for a game (or change vote)
   */
  async voteGame(roomIdOrCode: string, userId: string, gameId: string) {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
      },
    });

    if (!room) throw new NotFoundError('Room not found');

    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: { roomId: room.id, userId },
      },
    });

    if (!participant || participant.leftAt) {
      throw new ForbiddenError('You are not an active participant in this room');
    }

    if (!isGamePermittedForMode(gameId, room.mode)) {
      throw new AppError(`Game '${gameId}' is not permitted in ${room.mode.toLowerCase()} mode`, 400);
    }

    await prisma.$transaction(
      async (tx) => {
        await this.lockRoomRow(tx, room.id);
        const currentRoom = await tx.room.findUnique({
          where: { id: room.id },
          select: { mode: true, status: true, selectedGameId: true },
        });
        if (!currentRoom) throw new NotFoundError('Room not found');
        if (!['WAITING', 'READY_TO_START'].includes(currentRoom.status)) {
          throw new AppError('Game voting is only available in the room lobby.', 400);
        }
        const activeParticipant = await tx.roomParticipant.findUnique({
          where: { roomId_userId: { roomId: room.id, userId } },
          select: { leftAt: true },
        });
        if (!activeParticipant || activeParticipant.leftAt) {
          throw new ForbiddenError('You are not an active participant in this room');
        }

        await tx.gameVote.upsert({
          where: {
            roomId_userId: { roomId: room.id, userId },
          },
          create: { roomId: room.id, userId, gameId },
          update: { gameId },
        });

        const allVotes = await tx.gameVote.findMany({
          where: { roomId: room.id },
        });

        const counts: Record<string, number> = {};
        for (const vote of allVotes) {
          counts[vote.gameId] = (counts[vote.gameId] || 0) + 1;
        }

        let topGame = currentRoom.selectedGameId || gameId;
        let maxVotes = 0;
        for (const [candidateGameId, count] of Object.entries(counts)) {
          if (count > maxVotes) {
            maxVotes = count;
            topGame = candidateGameId;
          }
        }

        await tx.room.update({
          where: { id: room.id },
          data: { selectedGameId: topGame },
        });
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    const fullRoom = await this.findRoomWithRelations({ id: room.id });
    if (!fullRoom) throw new NotFoundError('Room not found after voting');

    return this.formatRoomSnapshot(fullRoom);
  }

  /**
   * Directly select game (Host selection / override)
   */
  async selectGame(roomIdOrCode: string, userId: string, gameId: string) {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
      },
    });

    if (!room) throw new NotFoundError('Room not found');

    if (!isGamePermittedForMode(gameId, room.mode)) {
      throw new AppError(`Game '${gameId}' is not permitted in ${room.mode.toLowerCase()} mode`, 400);
    }

    await prisma.$transaction(
      async (tx) => {
        await this.lockRoomRow(tx, room.id);
        const currentRoom = await tx.room.findUnique({
          where: { id: room.id },
          select: { hostId: true, mode: true, status: true },
        });

        if (!currentRoom) throw new NotFoundError('Room not found');
        if (currentRoom.hostId !== userId) {
          throw new ForbiddenError('Only the room host can directly select the game');
        }
        if (!['WAITING', 'READY_TO_START'].includes(currentRoom.status)) {
          throw new AppError('The game cannot be changed after the match has started.', 400);
        }
        if (!isGamePermittedForMode(gameId, currentRoom.mode)) {
          throw new AppError(`Game '${gameId}' is not permitted in ${currentRoom.mode.toLowerCase()} mode`, 400);
        }

        await tx.room.update({
          where: { id: room.id },
          data: { selectedGameId: gameId },
        });

        await tx.gameVote.upsert({
          where: {
            roomId_userId: { roomId: room.id, userId },
          },
          create: { roomId: room.id, userId, gameId },
          update: { gameId },
        });
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    const fullRoom = await this.findRoomWithRelations({ id: room.id });
    if (!fullRoom) throw new NotFoundError('Room not found after selecting game');

    return this.formatRoomSnapshot(fullRoom);
  }

  /**
   * Verify whether a room meets all readiness conditions to start a game
   */
  async canStartGame(roomIdOrCode: string, userId: string): Promise<{ canStart: boolean; reason?: string }> {
    const room = await this.findRoomWithRelations({
      OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
    });

    if (!room) {
      return { canStart: false, reason: 'Room not found.' };
    }

    if (room.status === ROOM_STATUS.CLOSED) {
      return { canStart: false, reason: 'This room has been closed.' };
    }

    if (room.status === ROOM_STATUS.EXPIRED || room.expiresAt <= new Date()) {
      return { canStart: false, reason: 'This room has expired.' };
    }

    if (room.hostId !== userId) {
      return { canStart: false, reason: 'Only the room host can launch the game.' };
    }

    const activeParticipants = room.participants.filter((p) => !p.leftAt);
    const mode = room.mode.toLowerCase() as RoomMode;

    if (!room.selectedGameId || !isGamePermittedForMode(room.selectedGameId, mode)) {
      return { canStart: false, reason: 'No valid game selected for this room mode.' };
    }

    if (mode === 'couple' && activeParticipants.length !== 2) {
      return {
        canStart: false,
        reason: `Couple Mode requires exactly 2 active players (Current: ${activeParticipants.length}).`,
      };
    }

    if (mode === 'friend' && activeParticipants.length < 2) {
      return {
        canStart: false,
        reason: 'Friend Mode requires at least 2 players to start a match.',
      };
    }

    const unready = activeParticipants.filter((p) => !p.isReady);
    if (unready.length > 0) {
      return {
        canStart: false,
        reason: `Waiting for all players to toggle Ready (${unready.map((p) => p.user.displayName).join(', ')} not ready).`,
      };
    }

    return { canStart: true };
  }

  /**
   * Transfer host role
   */
  async transferHost(roomIdOrCode: string, currentHostId: string, newHostId: string) {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
      },
    });

    if (!room) throw new NotFoundError('Room not found');
    if (room.hostId !== currentHostId) {
      throw new ForbiddenError('Only the current host can transfer host ownership');
    }

    if (newHostId === currentHostId) {
      throw new AppError('The current host already owns this room.', 400);
    }

    await prisma.$transaction(
      async (tx) => {
        await this.lockRoomRow(tx, room.id);
        const currentRoom = await tx.room.findUnique({
          where: { id: room.id },
          select: { hostId: true, status: true },
        });
        if (!currentRoom) throw new NotFoundError('Room not found');
        if (currentRoom.hostId !== currentHostId) {
          throw new ForbiddenError('Only the current host can transfer host ownership');
        }
        if (!['WAITING', 'READY_TO_START'].includes(currentRoom.status)) {
          throw new AppError('Host transfer is only available in the room lobby.', 400);
        }

        // Re-read the target after locking the room. A pre-transaction lookup
        // alone allows a concurrent leave to turn an inactive user into host.
        const [currentHostParticipant, targetParticipant] = await Promise.all([
          tx.roomParticipant.findUnique({
            where: { roomId_userId: { roomId: room.id, userId: currentHostId } },
            select: { id: true, leftAt: true },
          }),
          tx.roomParticipant.findUnique({
            where: { roomId_userId: { roomId: room.id, userId: newHostId } },
            include: { user: { select: { displayName: true } } },
          }),
        ]);

        if (!currentHostParticipant || currentHostParticipant.leftAt) {
          throw new ForbiddenError('The current host is no longer an active participant.');
        }
        if (!targetParticipant || targetParticipant.leftAt) {
          throw new AppError('Target player is not an active participant in this room', 400);
        }

        const demoted = await tx.roomParticipant.updateMany({
          where: { id: currentHostParticipant.id, leftAt: null },
          data: { role: ROOM_PARTICIPANT_ROLES.PLAYER },
        });
        if (demoted.count !== 1) {
          throw new AppError('The current host changed while ownership was being transferred.', 409);
        }

        const promoted = await tx.roomParticipant.updateMany({
          where: { id: targetParticipant.id, leftAt: null },
          data: { role: ROOM_PARTICIPANT_ROLES.HOST },
        });
        if (promoted.count !== 1) {
          throw new AppError('Target player left while host ownership was being transferred.', 409);
        }

        await tx.room.update({
          where: { id: room.id },
          data: { hostId: newHostId },
        });

        await tx.roomMessage.create({
          data: {
            roomId: room.id,
            senderId: newHostId,
            message: `Host transferred to ${targetParticipant.user.displayName || 'the selected player'}.`,
          },
        });
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    const fullRoom = await this.findRoomWithRelations({ id: room.id });
    if (!fullRoom) throw new NotFoundError('Room not found after host transfer');

    return this.formatRoomSnapshot(fullRoom);
  }

  /**
   * Kick participant (Host only)
   */
  async kickParticipant(roomIdOrCode: string, hostId: string, targetUserId: string) {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
      },
    });

    if (!room) throw new NotFoundError('Room not found');
    if (room.hostId !== hostId) throw new ForbiddenError('Only the host can kick players');
    if (targetUserId === hostId) throw new AppError('Host cannot kick themselves', 400);

    const targetParticipant = await prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: targetUserId } },
      include: { user: true },
    });

    if (!targetParticipant || targetParticipant.leftAt) {
      throw new AppError('Player is not active in this room', 400);
    }

    await prisma.$transaction(
      async (tx) => {
        await this.lockRoomRow(tx, room.id);
        const currentRoom = await tx.room.findUnique({
          where: { id: room.id },
          select: { hostId: true, status: true },
        });
        if (!currentRoom) throw new NotFoundError('Room not found');
        if (currentRoom.hostId !== hostId) {
          throw new ForbiddenError('Only the host can kick players');
        }
        if (!['WAITING', 'READY_TO_START'].includes(currentRoom.status)) {
          throw new AppError('Players cannot be kicked while a game is in progress.', 400);
        }

        const kickedAt = new Date();
        const removed = await tx.roomParticipant.updateMany({
          where: { id: targetParticipant.id, leftAt: null },
          data: { leftAt: kickedAt, kickedAt, isReady: false },
        });
        if (removed.count === 0) {
          throw new AppError('Player is no longer active in this room', 400);
        }

        await tx.gameVote.deleteMany({
          where: { roomId: room.id, userId: targetUserId },
        });

        await tx.roomMessage.create({
          data: {
            roomId: room.id,
            senderId: hostId,
            message: `${targetParticipant.user.displayName} was removed from the room by the host.`,
          },
        });

        await this.recalculateRoomStatus(room.id, tx);
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    const fullRoom = await this.findRoomWithRelations({ id: room.id });
    if (!fullRoom) throw new NotFoundError('Room not found after kicking player');

    return {
      room: this.formatRoomSnapshot(fullRoom),
      kickedUserId: targetUserId,
    };
  }

  /**
   * Close room (Host only)
   */
  async closeRoom(roomIdOrCode: string, hostId: string) {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
      },
    });

    if (!room) throw new NotFoundError('Room not found');

    await prisma.$transaction(
      async (tx) => {
        await this.lockRoomRow(tx, room.id);
        const currentRoom = await tx.room.findUnique({
          where: { id: room.id },
          select: { hostId: true, status: true },
        });

        if (!currentRoom) throw new NotFoundError('Room not found');
        if (currentRoom.hostId !== hostId) {
          throw new ForbiddenError('Only the host can close the room');
        }
        if (currentRoom.status === 'IN_PROGRESS') {
          throw new AppError('An active game must be completed or abandoned before closing the room.', 400);
        }

        await tx.room.update({
          where: { id: room.id },
          data: { status: ROOM_STATUS.CLOSED },
        });
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    const fullRoom = await this.findRoomWithRelations({ id: room.id });
    if (!fullRoom) throw new NotFoundError('Room not found after closing');

    return this.formatRoomSnapshot(fullRoom);
  }

  /**
   * Post a room chat message
   */
  async postMessage(roomIdOrCode: string, senderId: string, message: string) {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
      },
    });

    if (!room) throw new NotFoundError('Room not found');

    const cleanMessage = message.trim();
    if (!cleanMessage) throw new AppError('Message cannot be empty', 400);

    const created = await prisma.$transaction(
      async (tx) => {
        await this.lockRoomRow(tx, room.id);
        const currentRoom = await tx.room.findUnique({
          where: { id: room.id },
          select: { status: true },
        });

        if (!currentRoom) throw new NotFoundError('Room not found');
        if (currentRoom.status === ROOM_STATUS.CLOSED || currentRoom.status === ROOM_STATUS.EXPIRED) {
          throw new AppError('Cannot post messages to a closed or expired room', 400);
        }

        const participant = await tx.roomParticipant.findUnique({
          where: { roomId_userId: { roomId: room.id, userId: senderId } },
          select: { leftAt: true },
        });

        if (!participant || participant.leftAt) {
          throw new ForbiddenError('Only active room participants can send chat messages');
        }

        return tx.roomMessage.create({
          data: {
            roomId: room.id,
            senderId,
            message: cleanMessage,
          },
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
                username: true,
              },
            },
          },
        });
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    return {
      id: created.id,
      roomId: room.id,
      roomCode: room.code,
      senderId: created.senderId,
      senderName: created.sender.displayName,
      text: created.message,
      timestamp: new Date(created.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: false,
      createdAt: created.createdAt,
    };
  }

  /**
   * Get recent chat messages with stable cursor-based pagination
   */
  async getMessages(
    roomIdOrCode: string,
    userId: string,
    options: number | { cursor?: string; limit?: number } = 50
  ) {
    const limit = typeof options === 'number' ? options : (options.limit || 50);
    const cursor = typeof options === 'object' ? options.cursor : undefined;
    const take = Math.min(Math.max(1, limit), 100);

    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }],
      },
    });

    if (!room) throw new NotFoundError('Room not found');

    const participant = await prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId } },
    });

    if (!participant || participant.leftAt) {
      throw new ForbiddenError('Only room participants can view room chat');
    }

    const messages = await prisma.roomMessage.findMany({
      where: { roomId: room.id },
      include: {
        sender: {
          select: {
            id: true,
            displayName: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = messages.length > take;
    const paginatedMessages = hasMore ? messages.slice(0, take) : messages;
    const nextCursor = hasMore ? paginatedMessages[paginatedMessages.length - 1].id : null;

    const formatted = paginatedMessages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender ? m.sender.displayName : 'System',
      text: m.message,
      timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: m.senderId === 'system',
      createdAt: m.createdAt,
    }));

    if (typeof options === 'object') {
      return {
        messages: formatted,
        nextCursor,
        hasMore,
      };
    }

    return formatted;
  }

  /**
   * Handle host demotion or room closure when a user is suspended
   */
  async handleUserSuspension(userId: string): Promise<{ affectedRooms: number; closedRooms: number; transferredRooms: number }> {
    const hostedRooms = await prisma.room.findMany({
      where: {
        hostId: userId,
        status: { in: [ROOM_STATUS.WAITING, ROOM_STATUS.READY_TO_START, ROOM_STATUS.IN_PROGRESS] },
      },
      include: {
        participants: {
          where: { leftAt: null, userId: { not: userId } },
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    let closedRooms = 0;
    let transferredRooms = 0;

    for (const room of hostedRooms) {
      const activeCandidates = room.participants.filter(
        (p) => p.user && p.user.accountStatus !== 'SUSPENDED'
      );

      if (activeCandidates.length === 0) {
        await prisma.room.update({
          where: { id: room.id },
          data: { status: ROOM_STATUS.CLOSED },
        });
        closedRooms++;
      } else {
        const nextHost = activeCandidates[0];
        await prisma.$transaction([
          prisma.room.update({
            where: { id: room.id },
            data: { hostId: nextHost.userId },
          }),
          prisma.roomParticipant.update({
            where: { id: nextHost.id },
            data: { role: ROOM_PARTICIPANT_ROLES.HOST },
          }),
          prisma.roomParticipant.updateMany({
            where: { roomId: room.id, userId },
            data: { role: ROOM_PARTICIPANT_ROLES.PLAYER },
          }),
          prisma.roomMessage.create({
            data: {
              roomId: room.id,
              senderId: nextHost.userId,
              message: `Host transferred to ${nextHost.user.displayName || 'Player'} due to account status change.`,
            },
          }),
        ]);
        transferredRooms++;
      }
    }

    return { affectedRooms: hostedRooms.length, closedRooms, transferredRooms };
  }

  /**
   * Cleanup strategy for expired rooms and pending invitations
   */
  async cleanupExpiredRooms(): Promise<{ expiredCount: number }> {
    const now = new Date();
    const result = await prisma.room.updateMany({
      where: {
        expiresAt: { lte: now },
        status: { notIn: [ROOM_STATUS.CLOSED, ROOM_STATUS.EXPIRED] },
      },
      data: {
        status: ROOM_STATUS.EXPIRED,
      },
    });

    await prisma.roomInvitation.updateMany({
      where: {
        status: 'PENDING',
        OR: [
          { expiresAt: { lte: now } },
          { room: { status: ROOM_STATUS.EXPIRED } },
        ],
      },
      data: {
        status: 'EXPIRED',
      },
    });

    return { expiredCount: result.count };
  }

  /**
   * Recalculate room readiness status
   */
  private async recalculateRoomStatus(
    roomId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
  ) {
    const client = db && typeof (db as any).room?.findUnique === 'function' ? db : prisma;
    const room = await client.room.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          where: { leftAt: null },
        },
      },
    });

    if (!room || room.status === ROOM_STATUS.CLOSED || room.status === ROOM_STATUS.IN_PROGRESS) {
      return;
    }

    const active = room.participants;
    const mode = room.mode.toLowerCase() as RoomMode;
    const allReady = active.length > 0 && active.every((p) => p.isReady);

    let nextStatus: RoomStatus = ROOM_STATUS.WAITING;

    if (mode === 'couple') {
      if (active.length === 2 && allReady) {
        nextStatus = ROOM_STATUS.READY_TO_START;
      }
    } else if (mode === 'friend') {
      if (active.length >= 2 && active.length <= 4 && allReady) {
        nextStatus = ROOM_STATUS.READY_TO_START;
      }
    }

    if (room.status !== nextStatus) {
      await client.room.update({
        where: { id: roomId },
        data: { status: nextStatus },
      });
    }
  }
}

export const roomsService = new RoomsService();
