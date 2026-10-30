import { prisma } from '../../config/prisma.js';
import { NotFoundError, ForbiddenError, AppError } from '../../utils/errors.js';
import {
  ROOM_STATUS,
  ROOM_PARTICIPANT_ROLES,
  MODE_CAPACITIES,
  isGamePermittedForMode,
  generateRoomCode,
  type RoomMode,
  type RoomStatus,
} from './rooms.constants.js';

export class RoomsService {
  /**
   * Format database Room record into a consistent frontend-ready snapshot
   */
  public formatRoomSnapshot(room: any) {
    const activeParticipants = (room.participants || [])
      .filter((p: any) => !p.leftAt)
      .map((p: any) => ({
        id: p.userId,
        name: p.user.displayName,
        username: p.user.username,
        avatarInitials: p.user.avatarInitials || 'PL',
        avatarColor: p.user.avatarColor || '#9670E8',
        avatarUrl: p.user.avatarUrl,
        isHost: p.role === ROOM_PARTICIPANT_ROLES.HOST || p.userId === room.hostId,
        isReady: p.isReady,
        role: p.role,
        joinedAt: p.joinedAt,
      }));

    // Group votes by gameId -> string[] userIds
    const gameVotes: Record<string, string[]> = {};
    for (const v of room.gameVotes || []) {
      if (!gameVotes[v.gameId]) {
        gameVotes[v.gameId] = [];
      }
      gameVotes[v.gameId].push(v.userId);
    }

    const chatMessages = (room.messages || []).map((m: any) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender ? m.sender.displayName : 'System',
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
  private async findRoomWithRelations(where: any) {
    return prisma.room.findFirst({
      where,
      include: {
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
      },
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

    return prisma.$transaction(async (tx) => {
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
      await tx.roomParticipant.create({
        data: {
          roomId: room.id,
          userId: hostId,
          role: ROOM_PARTICIPANT_ROLES.HOST,
          isReady: true,
        },
      });

      // Initial game vote
      await tx.gameVote.create({
        data: {
          roomId: room.id,
          userId: hostId,
          gameId: selectedGameId,
        },
      });

      // System greeting message
      await tx.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: hostId,
          message: `Room ${code} created in ${mode === 'couple' ? 'Couple' : 'Friend'} Mode.`,
        },
      });

      const fullRoom = await this.findRoomWithRelations({ id: room.id });
      return this.formatRoomSnapshot(fullRoom);
    });
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
    const isBlocked = await prisma.blockedUser.findFirst({
      where: { OR: [
        { blockerId: userId, blockedUserId: room.hostId },
        { blockerId: room.hostId, blockedUserId: userId },
      ] },
      select: { id: true },
    });
    const isInactive = room.status === ROOM_STATUS.CLOSED || room.status === ROOM_STATUS.EXPIRED;
    const isExpired = room.expiresAt <= new Date();
    const isFull = participantCount >= room.maxPlayers;
    const canJoin = !isBlocked && !isInactive && !isExpired && !isFull;

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
      joinUnavailableReason: isBlocked ? 'You are not allowed to join this room.'
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
  async getUserActiveRooms(userId: string) {
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

    if (existingRoom.status === ROOM_STATUS.CLOSED || existingRoom.status === ROOM_STATUS.EXPIRED) {
      throw new AppError(`Room "${cleanCode}" is no longer active.`, 400);
    }

    if (new Date() > existingRoom.expiresAt) {
      await prisma.room.update({
        where: { id: existingRoom.id },
        data: { status: ROOM_STATUS.EXPIRED },
      });
      throw new AppError(`Room "${cleanCode}" has expired.`, 400);
    }

    // Check block list between user and host
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

    // Atomic transaction for concurrency-safe join
    return prisma.$transaction(async (tx) => {
      // Re-fetch with row lock / active count
      const activeCount = await tx.roomParticipant.count({
        where: { roomId: existingRoom.id, leftAt: null },
      });

      const existingParticipant = await tx.roomParticipant.findUnique({
        where: {
          roomId_userId: {
            roomId: existingRoom.id,
            userId,
          },
        },
      });

      const userProfile = await tx.userProfile.findUnique({ where: { id: userId } });
      const userName = userProfile?.displayName || 'Player';

      if (existingParticipant && !existingParticipant.leftAt) {
        // User is already active in the room; idempotent return
        const full = await this.findRoomWithRelations({ id: existingRoom.id });
        return {
          room: this.formatRoomSnapshot(full),
          isNewJoin: false,
        };
      }

      // Check room capacity
      if (activeCount >= existingRoom.maxPlayers) {
        throw new AppError(
          `Room ${cleanCode} is full (Maximum ${existingRoom.maxPlayers} players allowed for ${existingRoom.mode.toLowerCase()} mode).`,
          400
        );
      }

      if (existingParticipant && existingParticipant.leftAt) {
        // Re-activating a player who previously left
        await tx.roomParticipant.update({
          where: { id: existingParticipant.id },
          data: {
            leftAt: null,
            isReady: false,
            updatedAt: new Date(),
          },
        });
      } else {
        // Brand new participant
        await tx.roomParticipant.create({
          data: {
            roomId: existingRoom.id,
            userId,
            role: ROOM_PARTICIPANT_ROLES.PLAYER,
            isReady: false,
          },
        });
      }

      // System announcement message
      await tx.roomMessage.create({
        data: {
          roomId: existingRoom.id,
          senderId: userId,
          message: `${userName} connected to the room.`,
        },
      });

      // Recalculate room status if it was READY_TO_START
      if (existingRoom.status === ROOM_STATUS.READY_TO_START) {
        await tx.room.update({
          where: { id: existingRoom.id },
          data: { status: ROOM_STATUS.WAITING },
        });
      }

      const full = await this.findRoomWithRelations({ id: existingRoom.id });
      return {
        room: this.formatRoomSnapshot(full),
        isNewJoin: true,
      };
    });
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

    return prisma.$transaction(async (tx) => {
      // 1. Mark participant as left
      await tx.roomParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date(), isReady: false },
      });

      // 2. Remove any active game votes from this user in this room
      await tx.gameVote.deleteMany({
        where: { roomId: room.id, userId },
      });

      // 3. System message
      const playerName = participant.user.displayName || 'Player';
      await tx.roomMessage.create({
        data: {
          roomId: room.id,
          senderId: userId,
          message: `${playerName} left the room.`,
        },
      });

      // 4. Check remaining active participants
      const remaining = await tx.roomParticipant.findMany({
        where: { roomId: room.id, leftAt: null },
        orderBy: { joinedAt: 'asc' },
        include: { user: true },
      });

      let hostChanged = false;
      let newHostId: string | null = null;
      let roomClosed = false;

      if (remaining.length === 0) {
        // Room is empty -> close it
        await tx.room.update({
          where: { id: room.id },
          data: { status: ROOM_STATUS.CLOSED },
        });
        roomClosed = true;
      } else if (room.hostId === userId) {
        // Host left -> transfer host responsibility to oldest remaining active player
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

      // 5. Update room readiness status if needed
      if (!roomClosed) {
        await this.recalculateRoomStatus(room.id, tx);
      }

      const full = await this.findRoomWithRelations({ id: room.id });
      return {
        room: this.formatRoomSnapshot(full),
        hostChanged,
        newHostId,
        roomClosed,
        leftUserId: userId,
      };
    });
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

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
    });

    if (!participant || participant.leftAt) {
      throw new ForbiddenError('You are not an active participant in this room');
    }

    const nextReadyState = explicitReady !== undefined ? explicitReady : !participant.isReady;

    return prisma.$transaction(async (tx) => {
      await tx.roomParticipant.update({
        where: { id: participant.id },
        data: { isReady: nextReadyState },
      });

      await this.recalculateRoomStatus(room.id, tx);

      const full = await this.findRoomWithRelations({ id: room.id });
      return this.formatRoomSnapshot(full);
    });
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

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    const participant = await prisma.roomParticipant.findUnique({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
    });

    if (!participant || participant.leftAt) {
      throw new ForbiddenError('You are not an active participant in this room');
    }

    if (!isGamePermittedForMode(gameId, room.mode)) {
      throw new AppError(`Game '${gameId}' is not permitted in ${room.mode.toLowerCase()} mode`, 400);
    }

    return prisma.$transaction(async (tx) => {
      // Upsert user's single vote for this room
      await tx.gameVote.upsert({
        where: {
          roomId_userId: {
            roomId: room.id,
            userId,
          },
        },
        create: {
          roomId: room.id,
          userId,
          gameId,
        },
        update: {
          gameId,
        },
      });

      // Tally all votes in this room to auto-select top candidate
      const allVotes = await tx.gameVote.findMany({
        where: { roomId: room.id },
      });

      const counts: Record<string, number> = {};
      for (const v of allVotes) {
        counts[v.gameId] = (counts[v.gameId] || 0) + 1;
      }

      let topGame = room.selectedGameId || gameId;
      let maxVotes = 0;
      for (const [gId, count] of Object.entries(counts)) {
        if (count > maxVotes) {
          maxVotes = count;
          topGame = gId;
        }
      }

      await tx.room.update({
        where: { id: room.id },
        data: { selectedGameId: topGame },
      });

      const full = await this.findRoomWithRelations({ id: room.id });
      return this.formatRoomSnapshot(full);
    });
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

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    if (room.hostId !== userId) {
      throw new ForbiddenError('Only the room host can directly select the game');
    }

    if (!isGamePermittedForMode(gameId, room.mode)) {
      throw new AppError(`Game '${gameId}' is not permitted in ${room.mode.toLowerCase()} mode`, 400);
    }

    await prisma.room.update({
      where: { id: room.id },
      data: { selectedGameId: gameId },
    });

    // Also update host's vote
    await prisma.gameVote.upsert({
      where: {
        roomId_userId: {
          roomId: room.id,
          userId,
        },
      },
      create: { roomId: room.id, userId, gameId },
      update: { gameId },
    });

    const full = await this.findRoomWithRelations({ id: room.id });
    return this.formatRoomSnapshot(full);
  }

  /**
   * Verify whether a room meets all readiness conditions to start a game
   */
  async canStartGame(roomIdOrCode: string, userId: string): Promise<{ canStart: boolean; reason?: string }> {
    const room = await this.findRoomWithRelations({
      OR: [{ id: roomIdOrCode }, { code: roomIdOrCode.toUpperCase() }] as any,
    });

    if (!room) {
      return { canStart: false, reason: 'Room not found.' };
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
    if (room.hostId !== currentHostId) throw new ForbiddenError('Only the current host can transfer host ownership');

    const targetParticipant = await prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: newHostId } },
      include: { user: true },
    });

    if (!targetParticipant || targetParticipant.leftAt) {
      throw new AppError('Target player is not an active participant in this room', 400);
    }

    return prisma.$transaction(async (tx) => {
      // Demote current host
      await tx.roomParticipant.updateMany({
        where: { roomId: room.id, userId: currentHostId },
        data: { role: ROOM_PARTICIPANT_ROLES.PLAYER },
      });

      // Promote new host
      await tx.roomParticipant.update({
        where: { id: targetParticipant.id },
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
          message: `Host transferred to ${targetParticipant.user.displayName}.`,
        },
      });

      const full = await this.findRoomWithRelations({ id: room.id });
      return this.formatRoomSnapshot(full);
    });
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

    return prisma.$transaction(async (tx) => {
      await tx.roomParticipant.update({
        where: { id: targetParticipant.id },
        data: { leftAt: new Date(), isReady: false },
      });

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

      const full = await this.findRoomWithRelations({ id: room.id });
      return {
        room: this.formatRoomSnapshot(full),
        kickedUserId: targetUserId,
      };
    });
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
    if (room.hostId !== hostId) throw new ForbiddenError('Only the host can close the room');

    await prisma.room.update({
      where: { id: room.id },
      data: { status: ROOM_STATUS.CLOSED },
    });

    const full = await this.findRoomWithRelations({ id: room.id });
    return this.formatRoomSnapshot(full);
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
    if (room.status === ROOM_STATUS.CLOSED || room.status === ROOM_STATUS.EXPIRED) {
      throw new AppError('Cannot post messages to a closed or expired room', 400);
    }

    const participant = await prisma.roomParticipant.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: senderId } },
      include: { user: true },
    });

    if (!participant || participant.leftAt) {
      throw new ForbiddenError('Only active room participants can send chat messages');
    }

    const created = await prisma.roomMessage.create({
      data: {
        roomId: room.id,
        senderId,
        message: message.trim(),
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
   * Get recent chat messages
   */
  async getMessages(roomIdOrCode: string, userId: string, limit = 50) {
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
      take: Math.min(limit, 100),
    });

    return messages.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender ? m.sender.displayName : 'System',
      text: m.message,
      timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSystem: m.senderId === 'system',
      createdAt: m.createdAt,
    }));
  }

  /**
   * Recalculate room readiness status
   */
  private async recalculateRoomStatus(roomId: string, db: any = prisma) {
    const room = await db.room.findUnique({
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
    const allReady = active.length > 0 && active.every((p: any) => p.isReady);

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
      await db.room.update({
        where: { id: roomId },
        data: { status: nextStatus },
      });
    }
  }
}

export const roomsService = new RoomsService();
