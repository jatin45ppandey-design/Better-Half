import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NotFoundError, ForbiddenError, AppError } from '../../../utils/errors.js';
import { prisma } from '../../../config/prisma.js';
import { normalizeGameId } from '../../rooms/rooms.constants.js';
import { isGameEligibleForMode, validatePlayerCount } from './gameRegistry.js';
import { gameEngineFactory } from './gameEngineFactory.js';
import { gameStateService } from './gameState.service.js';
import type { GameEngineContext, GameParticipant } from './gameEngine.types.js';

export class GameSessionService {
  private inFlightRestorations = new Map<string, Promise<GameEngineContext | null>>();

  async createSession(
    roomId: string,
    requestedGameId: string,
    hostUserId: string
  ): Promise<{
    session: GameEngineContext;
    roomCode: string;
    created: boolean;
  }> {
    const room = await prisma.room.findFirst({
      where: {
        OR: [{ id: roomId }, { code: roomId.trim().toUpperCase() }],
      },
      include: {
        participants: {
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!room) throw new NotFoundError('Room not found');

    if (room.hostId !== hostUserId) {
      throw new ForbiddenError('Only the room host can start a game session');
    }

    const now = new Date();
    if (room.status === 'CLOSED' || room.status === 'EXPIRED' || room.status === 'COMPLETED') {
      throw new AppError('This room is not available for starting a game.', 400);
    }
    if (room.expiresAt <= now) {
      await prisma.room.updateMany({
        where: { id: room.id, status: { notIn: ['CLOSED', 'COMPLETED'] } },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('This room has expired.', 400);
    }

    const mode = room.mode.toLowerCase() as 'couple' | 'friend';
    const selectedGameId = room.selectedGameId ? normalizeGameId(room.selectedGameId) : null;
    const canonicalRequestedGameId = requestedGameId ? normalizeGameId(requestedGameId) : null;
    const gameId = selectedGameId || canonicalRequestedGameId || 'truth-or-dare';

    if (canonicalRequestedGameId && selectedGameId && canonicalRequestedGameId !== selectedGameId) {
      throw new AppError('The requested game is not the game selected in this room.', 409);
    }

    // Repeated start requests must return the same active session, not fail with
    // 409 or create another session for the same room.
    const existingActive = await prisma.gameSession.findFirst({
      where: {
        roomId: room.id,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      select: { id: true, gameId: true },
    });

    if (existingActive) {
      if (normalizeGameId(existingActive.gameId) !== gameId) {
        throw new AppError('A different game session is already active in this room.', 409);
      }
      const existingContext = await this.getOrRestoreSession(existingActive.id);
      if (!existingContext) {
        throw new AppError('The active game session could not be restored.', 503);
      }
      return { session: existingContext, roomCode: room.code, created: false };
    }

    if (room.status === 'IN_PROGRESS') {
      throw new AppError('The room is already marked in progress but has no active session.', 409);
    }

    if (mode === 'friend' && ['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId)) {
      throw new AppError(`Game "${gameId}" is restricted to Couple Mode only.`, 400);
    }

    if (!isGameEligibleForMode(gameId, mode)) {
      throw new AppError(`Game "${gameId}" is not allowed in ${room.mode} Mode`, 400);
    }

    let gameConfig = null;
    try {
      gameConfig = await prisma.gameConfiguration.findUnique({
        where: { gameId },
      });
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Game configuration service is temporarily unavailable. Please retry.', 503);
    }
    if (gameConfig) {
      if (!gameConfig.isEnabled) {
        throw new AppError(`Game "${gameId}" is currently disabled by administrators.`, 400);
      }
      if (mode === 'friend' && !gameConfig.friendEnabled) {
        throw new AppError(`Game "${gameId}" is disabled in Friend Mode.`, 400);
      }
      if (mode === 'couple' && !gameConfig.coupleEnabled) {
        throw new AppError(`Game "${gameId}" is disabled in Couple Mode.`, 400);
      }
    }

    const activeParticipants = room.participants.filter((participant) => !participant.leftAt);
    if (!activeParticipants.some((participant) => participant.userId === hostUserId)) {
      throw new ForbiddenError('The room host must be an active room participant to start the game.');
    }

    if (!validatePlayerCount(gameId, activeParticipants.length)) {
      throw new AppError(
        `Invalid player count (${activeParticipants.length}) for game "${gameId}"`,
        400
      );
    }

    if (mode === 'couple' && activeParticipants.length !== 2) {
      throw new AppError('Couple Mode requires exactly 2 players to start', 400);
    }

    const notReady = activeParticipants.filter((participant) => !participant.isReady);
    if (notReady.length > 0) {
      throw new AppError('All active players, including the host, must be ready before starting.', 400);
    }

    let customQuestions: any[] | undefined;
    if (['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId)) {
      const dbQuestions = await prisma.questionEntry.findMany({
        where: { gameId, isActive: true },
      });
      if (dbQuestions.length > 0) customQuestions = dbQuestions;
    }

    const rngSeed = crypto.randomBytes(16).toString('hex');
    const engine = gameEngineFactory.getEngine(gameId);
    const participants: GameParticipant[] = activeParticipants.map((participant, index) => ({
      userId: participant.userId,
      name: participant.user.displayName || participant.user.username,
      seatIndex: index,
      isHost: participant.userId === hostUserId,
    }));

    const sessionId = crypto.randomUUID();
    const initialState = engine.createInitialState({
      sessionId,
      mode,
      participants,
      rngSeed,
      customQuestions,
    });

    const context: GameEngineContext = {
      sessionId,
      gameId,
      mode,
      participants,
      state: initialState.state,
      privateStates: initialState.privateStates,
      version: 1,
      isPaused: false,
      status: 'ACTIVE',
      scores: initialState.scores || {},
      rngSeed,
      currentTurnUserId: initialState.currentTurnUserId || participants[0]?.userId || null,
      roomId: room.id,
      startedAt: new Date(),
    };

    // Serialize room starts with a row lock. If another request wins the race,
    // the later request returns that already-created session.
    const transactionResult = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Room" WHERE "id" = ${room.id} FOR UPDATE`;

        const currentRoom = await tx.room.findUnique({
          where: { id: room.id },
          include: {
            participants: {
              where: { leftAt: null },
              include: { user: true },
              orderBy: { joinedAt: 'asc' },
            },
          },
        });

        if (!currentRoom) throw new NotFoundError('Room not found');
        if (
          currentRoom.status === 'CLOSED' ||
          currentRoom.status === 'EXPIRED' ||
          currentRoom.status === 'COMPLETED' ||
          currentRoom.expiresAt <= new Date()
        ) {
          throw new AppError('This room is no longer available for starting a game.', 400);
        }

        if (currentRoom.hostId !== hostUserId) {
          throw new ForbiddenError('Only the current room host can start the game.');
        }

        const activeInTransaction = await tx.gameSession.findFirst({
          where: {
            roomId: currentRoom.id,
            status: { in: ['ACTIVE', 'PAUSED'] },
          },
          select: { id: true, gameId: true },
        });

        if (activeInTransaction) {
          if (normalizeGameId(activeInTransaction.gameId) !== gameId) {
            throw new AppError('A different game session is already active in this room.', 409);
          }
          return { sessionId: activeInTransaction.id, created: false };
        }

        if (currentRoom.status === 'IN_PROGRESS') {
          throw new AppError('The room is already in progress without an active session.', 409);
        }

        if (currentRoom.selectedGameId && normalizeGameId(currentRoom.selectedGameId) !== gameId) {
          throw new AppError('The selected game changed while the session was starting. Please retry.', 409);
        }

        let lockedGameConfig = null;
        try {
          lockedGameConfig = await tx.gameConfiguration.findUnique({
            where: { gameId },
          });
        } catch (err: any) {
          if (err instanceof AppError) throw err;
          throw new AppError('Game configuration service is temporarily unavailable. Please retry.', 503);
        }
        if (lockedGameConfig) {
          if (!lockedGameConfig.isEnabled) {
            throw new AppError(`Game "${gameId}" is currently disabled by administrators.`, 400);
          }
          if (mode === 'friend' && !lockedGameConfig.friendEnabled) {
            throw new AppError(`Game "${gameId}" is disabled in Friend Mode.`, 400);
          }
          if (mode === 'couple' && !lockedGameConfig.coupleEnabled) {
            throw new AppError(`Game "${gameId}" is disabled in Couple Mode.`, 400);
          }
        }

        const currentParticipantIds = currentRoom.participants.map((participant) => participant.userId);
        const preparedParticipantIds = participants.map((participant) => participant.userId);
        if (
          currentParticipantIds.length !== preparedParticipantIds.length ||
          currentParticipantIds.some((id, index) => id !== preparedParticipantIds[index])
        ) {
          throw new AppError('Room participants changed while the session was starting. Please retry.', 409);
        }

        if (currentRoom.participants.some((participant) => !participant.isReady)) {
          throw new AppError('All active players must be ready before starting.', 400);
        }

        const roomUpdate = await tx.room.updateMany({
          where: {
            id: currentRoom.id,
            hostId: hostUserId,
            status: { in: ['WAITING', 'READY_TO_START'] },
          },
          data: { status: 'IN_PROGRESS', selectedGameId: gameId },
        });

        if (roomUpdate.count !== 1) {
          throw new AppError('The room changed while the game was starting. Please retry.', 409);
        }

        await tx.gameSession.create({
          data: {
            id: sessionId,
            roomId: currentRoom.id,
            gameId,
            mode: currentRoom.mode,
            status: 'ACTIVE',
            currentTurnUserId: context.currentTurnUserId,
            stateVersion: 1,
            publicState: context.state as any,
            rngSeed,
            participants: {
              create: participants.map((participant) => ({
                userId: participant.userId,
                seatIndex: participant.seatIndex,
                status: 'ACTIVE',
                score: context.scores[participant.userId] || 0,
                // Stored separately from publicState and only exposed to its owner.
                privateState:
                  context.privateStates[participant.userId] == null
                    ? Prisma.DbNull
                    : (context.privateStates[participant.userId] as any),
              })),
            },
          },
        });

        return { sessionId, created: true };
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    if (!transactionResult.created) {
      const existingContext = await this.getOrRestoreSession(transactionResult.sessionId);
      if (!existingContext) {
        throw new AppError('The active game session could not be restored.', 503);
      }
      return { session: existingContext, roomCode: room.code, created: false };
    }

    gameStateService.setSession(sessionId, context);
    return { session: context, roomCode: room.code, created: true };
  }

  getSession(sessionId: string): GameEngineContext | null {
    return gameStateService.getSession(sessionId);
  }

  /**
   * Reconstruct session from PostgreSQL database on demand if missing in memory.
   */
  async restoreSession(sessionId: string): Promise<GameEngineContext | null> {
    const cached = gameStateService.getSession(sessionId);
    if (cached) return cached;

    const sessionRecord = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        participants: {
          include: { user: true },
          orderBy: { seatIndex: 'asc' },
        },
        room: true,
      },
    });

    if (!sessionRecord) return null;

    const participants: GameParticipant[] = sessionRecord.participants.map((p) => ({
      userId: p.userId,
      name: p.user.displayName || p.user.username,
      seatIndex: p.seatIndex,
      isHost: p.userId === sessionRecord.room?.hostId,
    }));

    const scores: Record<string, number> = {};
    const privateStates: Record<string, any> = {};
    for (const p of sessionRecord.participants) {
      scores[p.userId] = p.score;
      if (p.privateState) {
        privateStates[p.userId] = p.privateState;
      }
    }

    const mode = sessionRecord.mode.toLowerCase() as 'couple' | 'friend';
    const context: GameEngineContext = {
      sessionId: sessionRecord.id,
      gameId: normalizeGameId(sessionRecord.gameId),
      mode,
      participants,
      state: sessionRecord.publicState as any,
      privateStates,
      version: sessionRecord.stateVersion,
      isPaused: sessionRecord.status === 'PAUSED',
      status: sessionRecord.status as any,
      scores,
      rngSeed: sessionRecord.rngSeed || undefined,
      currentTurnUserId: sessionRecord.currentTurnUserId,
      roomId: sessionRecord.roomId,
      startedAt: sessionRecord.startedAt,
    };
    if (sessionRecord.room) {
      (context as any).room = sessionRecord.room;
    }

    // Hydrate action idempotency map from past actions (bounded to latest 50 actions)
    try {
      const pastActions = await prisma.gameAction.findMany({
        where: { sessionId },
        select: { actionId: true },
        take: 50,
        orderBy: { sequenceNumber: 'desc' },
      });
      for (const a of pastActions) {
        gameStateService.markActionProcessed(sessionId, a.actionId);
      }
    } catch {
      // Non-fatal if action lookup fails
    }

    gameStateService.setSession(sessionId, context);
    return context;
  }

  async getOrRestoreSession(sessionId: string): Promise<GameEngineContext | null> {
    const session = gameStateService.getSession(sessionId);
    if (session) return session;

    const inFlight = this.inFlightRestorations.get(sessionId);
    if (inFlight) return inFlight;

    const promise = this.restoreSession(sessionId).finally(() => {
      this.inFlightRestorations.delete(sessionId);
    });
    this.inFlightRestorations.set(sessionId, promise);
    return promise;
  }

  async restoreActiveSessions(): Promise<number> {
    try {
      // Bounded startup recovery (at most 50 recent active/paused sessions)
      const activeSessions = await prisma.gameSession.findMany({
        where: {
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        select: { id: true },
        take: 50,
        orderBy: { updatedAt: 'desc' },
      });

      let count = 0;
      const batchSize = 5;
      for (let i = 0; i < activeSessions.length; i += batchSize) {
        const batch = activeSessions.slice(i, i + batchSize);
        const results = await Promise.all(batch.map((s) => this.restoreSession(s.id)));
        count += results.filter(Boolean).length;
      }
      return count;
    } catch (err: any) {
      console.error('Failed to restore active sessions from DB:', err?.message || err);
      return 0;
    }
  }

  async pauseSession(
    sessionId: string,
    actorUserId: string
  ): Promise<GameEngineContext> {
    const session = await this.getOrRestoreSession(sessionId);
    if (!session) throw new NotFoundError('Session not found');

    const participant = session.participants.find((p) => p.userId === actorUserId);
    if (!participant) throw new ForbiddenError('Not a participant of this game session');

    if (session.status !== 'ACTIVE') {
      throw new AppError(`Cannot pause session in '${session.status}' state. Only ACTIVE sessions can be paused.`, 409);
    }

    const nextVersion = session.version + 1;

    // Persist pause status and CAS version increment to database
    const updateResult = await prisma.gameSession.updateMany({
      where: { id: sessionId, status: 'ACTIVE', stateVersion: session.version },
      data: {
        status: 'PAUSED',
        stateVersion: nextVersion,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError('Conflict: Session state version changed concurrently.', 409);
    }

    session.isPaused = true;
    session.status = 'PAUSED';
    session.version = nextVersion;
    gameStateService.setSession(sessionId, session);

    return session;
  }

  async resumeSession(
    sessionId: string,
    actorUserId: string
  ): Promise<GameEngineContext> {
    const session = await this.getOrRestoreSession(sessionId);
    if (!session) throw new NotFoundError('Session not found');

    const participant = session.participants.find((p) => p.userId === actorUserId);
    if (!participant) throw new ForbiddenError('Not a participant of this game session');

    if (session.status !== 'PAUSED') {
      throw new AppError(`Cannot resume session in '${session.status}' state. Only PAUSED sessions can be resumed.`, 409);
    }

    const nextVersion = session.version + 1;

    // Persist resume status and CAS version increment to database
    const updateResult = await prisma.gameSession.updateMany({
      where: { id: sessionId, status: 'PAUSED', stateVersion: session.version },
      data: {
        status: 'ACTIVE',
        stateVersion: nextVersion,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError('Conflict: Session state version changed concurrently.', 409);
    }

    session.isPaused = false;
    session.status = 'ACTIVE';
    session.version = nextVersion;
    gameStateService.setSession(sessionId, session);

    return session;
  }

  async rematchSession(
    sessionId: string,
    hostUserId: string
  ): Promise<GameEngineContext> {
    const prevSession = await this.getOrRestoreSession(sessionId);
    if (!prevSession) throw new NotFoundError('Session not found');
    if (prevSession.status !== 'COMPLETED') {
      throw new AppError('A rematch is available only after the current match is completed.', 409);
    }
    if (!prevSession.roomId) {
      throw new AppError('Cannot rematch a session without an associated room.', 400);
    }

    // Repeated or concurrent rematch requests return the active rematch session if already started
    const existingActiveInitial = typeof prisma.gameSession.findFirst === 'function'
      ? await prisma.gameSession.findFirst({
      where: { roomId: prevSession.roomId, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { id: true, gameId: true },
    }) : null;
    if (
      existingActiveInitial &&
      normalizeGameId(existingActiveInitial.gameId) === normalizeGameId(prevSession.gameId)
    ) {
      const existingContext = await this.getOrRestoreSession(existingActiveInitial.id);
      if (existingContext) return existingContext;
    }

    const room = await prisma.room.findUnique({
      where: { id: prevSession.roomId },
      include: {
        participants: {
          where: { leftAt: null },
          include: { user: true },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!room) throw new NotFoundError('Room not found for rematch');
    if (room.status === 'CLOSED' || room.status === 'EXPIRED' || room.expiresAt <= new Date()) {
      throw new AppError('Cannot initiate rematch in a closed or expired room.', 400);
    }
    if (room.hostId !== hostUserId) {
      throw new ForbiddenError('Only the host can initiate a rematch');
    }

    const gameId = normalizeGameId(prevSession.gameId);
    const mode = room.mode.toLowerCase() as 'couple' | 'friend';
    if (!isGameEligibleForMode(gameId, mode)) {
      throw new AppError(`Game "${gameId}" is not allowed in ${room.mode} Mode.`, 400);
    }

    // Prisma's query filters leftAt:null, but apply the guard again here so
    // test doubles, alternate data loaders and stale snapshots cannot make a
    // departed player count toward a rematch.
    const activeParticipants = room.participants.filter((participant) => !participant.leftAt);
    if (!validatePlayerCount(gameId, activeParticipants.length)) {
      throw new AppError(`Invalid player count (${activeParticipants.length}) for game "${gameId}".`, 400);
    }
    if (mode === 'couple' && activeParticipants.length !== 2) {
      throw new AppError('Couple Mode requires exactly 2 players to start rematch.', 400);
    }
    if (activeParticipants.some((participant) => !participant.isReady)) {
      throw new AppError('All active players must be ready before starting a rematch.', 400);
    }

    let gameConfig = null;
    try {
      gameConfig = await prisma.gameConfiguration.findUnique({ where: { gameId } });
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError('Game configuration service is temporarily unavailable. Please retry.', 503);
    }
    if (gameConfig) {
      if (!gameConfig.isEnabled) {
        throw new AppError(`Game "${gameId}" is currently disabled by administrators.`, 400);
      }
      if (mode === 'friend' && !gameConfig.friendEnabled) {
        throw new AppError(`Game "${gameId}" is disabled in Friend Mode.`, 400);
      }
      if (mode === 'couple' && !gameConfig.coupleEnabled) {
        throw new AppError(`Game "${gameId}" is disabled in Couple Mode.`, 400);
      }
    }

    let customQuestions: any[] | undefined;
    if (['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId)) {
      const dbQuestions = await prisma.questionEntry.findMany({
        where: { gameId, isActive: true },
      });
      if (dbQuestions.length > 0) customQuestions = dbQuestions;
    }

    const engine = gameEngineFactory.getEngine(gameId);
    const newRngSeed = crypto.randomBytes(16).toString('hex');
    const newSessionId = crypto.randomUUID();
    const participants: GameParticipant[] = activeParticipants.map((participant, index) => ({
      userId: participant.userId,
      name: participant.user.displayName || participant.user.username,
      seatIndex: index,
      isHost: participant.userId === hostUserId,
    }));
    const initialState = engine.createInitialState({
      sessionId: newSessionId,
      mode,
      participants,
      rngSeed: newRngSeed,
      customQuestions,
    });
    const newContext: GameEngineContext = {
      sessionId: newSessionId,
      gameId,
      mode,
      participants,
      state: initialState.state,
      privateStates: initialState.privateStates,
      version: 1,
      isPaused: false,
      status: 'ACTIVE',
      scores: initialState.scores || {},
      rngSeed: newRngSeed,
      currentTurnUserId: initialState.currentTurnUserId || participants[0]?.userId || null,
      roomId: room.id,
      startedAt: new Date(),
    };

    // Serialize rematch creation on the room row. The previous completed
    // session, current host, participants, readiness, config and active-session
    // uniqueness are all revalidated under the same lock as the new insert.
    const txResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Room" WHERE "id" = ${room.id} FOR UPDATE`;

      const [currentRoom, previousRecord, existingActive, lockedConfig] = await Promise.all([
        tx.room.findUnique({
          where: { id: room.id },
          include: {
            participants: {
              where: { leftAt: null },
              include: { user: true },
              orderBy: { joinedAt: 'asc' },
            },
          },
        }),
        tx.gameSession.findUnique({
          where: { id: sessionId },
          select: { status: true, roomId: true, gameId: true },
        }),
        tx.gameSession.findFirst({
          where: { roomId: room.id, status: { in: ['ACTIVE', 'PAUSED'] } },
          select: { id: true },
        }),
        tx.gameConfiguration.findUnique({ where: { gameId } }),
      ]);

      if (!currentRoom) throw new NotFoundError('Room not found for rematch');
      if (
        currentRoom.status === 'CLOSED' ||
        currentRoom.status === 'EXPIRED' ||
        currentRoom.expiresAt <= new Date()
      ) {
        throw new AppError('Cannot initiate rematch in a closed or expired room.', 400);
      }
      if (currentRoom.status !== 'COMPLETED' && currentRoom.status !== 'IN_PROGRESS') {
        throw new AppError('The room is not in a completed-match state.', 409);
      }
      if (currentRoom.hostId !== hostUserId) {
        throw new ForbiddenError('Only the current room host can initiate a rematch.');
      }
      if (!previousRecord || previousRecord.roomId !== room.id || previousRecord.status !== 'COMPLETED') {
        throw new AppError('The previous match is no longer eligible for a rematch.', 409);
      }
      if (normalizeGameId(previousRecord.gameId) !== gameId) {
        throw new AppError('The previous game changed. Please return to the lobby.', 409);
      }
      if (existingActive) {
        if (normalizeGameId(previousRecord.gameId) === gameId) {
          return { alreadyCreatedId: existingActive.id };
        }
        throw new AppError('Another active game session already exists for this room.', 409);
      }
      if (lockedConfig) {
        if (!lockedConfig.isEnabled) {
          throw new AppError(`Game "${gameId}" is currently disabled by administrators.`, 400);
        }
        if (mode === 'friend' && !lockedConfig.friendEnabled) {
          throw new AppError(`Game "${gameId}" is disabled in Friend Mode.`, 400);
        }
        if (mode === 'couple' && !lockedConfig.coupleEnabled) {
          throw new AppError(`Game "${gameId}" is disabled in Couple Mode.`, 400);
        }
      }

      const currentIds = currentRoom.participants.map((participant) => participant.userId);
      const preparedIds = participants.map((participant) => participant.userId);
      if (
        currentIds.length !== preparedIds.length ||
        currentIds.some((id, index) => id !== preparedIds[index])
      ) {
        throw new AppError('Room participants changed while rematch was starting. Please retry.', 409);
      }
      if (currentRoom.participants.some((participant) => !participant.isReady)) {
        throw new AppError('All active players must be ready before starting a rematch.', 400);
      }

      const roomUpdate = await tx.room.updateMany({
        where: {
          id: room.id,
          hostId: hostUserId,
          status: { in: ['COMPLETED', 'IN_PROGRESS'] },
        },
        data: { status: 'IN_PROGRESS', selectedGameId: gameId },
      });
      if (roomUpdate.count !== 1) {
        throw new AppError('The room changed while rematch was starting. Please retry.', 409);
      }

      await tx.gameSession.create({
        data: {
          id: newSessionId,
          roomId: room.id,
          gameId,
          mode: room.mode,
          status: 'ACTIVE',
          currentTurnUserId: newContext.currentTurnUserId,
          stateVersion: 1,
          publicState: newContext.state as any,
          rngSeed: newRngSeed,
          participants: {
            create: participants.map((participant) => ({
              userId: participant.userId,
              seatIndex: participant.seatIndex,
              status: 'ACTIVE',
              score: newContext.scores[participant.userId] || 0,
              privateState:
                newContext.privateStates[participant.userId] == null
                  ? Prisma.DbNull
                  : (newContext.privateStates[participant.userId] as any),
            })),
          },
        },
      });
    }, {
      maxWait: 5000,
      timeout: 15000,
    });

    if (txResult?.alreadyCreatedId) {
      const restored = await this.getOrRestoreSession(txResult.alreadyCreatedId);
      if (restored) return restored;
    }

    gameStateService.setSession(newSessionId, newContext);
    return newContext;
  }
}

export const gameSessionService = new GameSessionService();
