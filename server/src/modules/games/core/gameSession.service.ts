import crypto from 'node:crypto';
import { NotFoundError, ForbiddenError, AppError } from '../../../utils/errors.js';
import { prisma } from '../../../config/prisma.js';
import { isGameEligibleForMode, validatePlayerCount } from './gameRegistry.js';
import { gameEngineFactory } from './gameEngineFactory.js';
import { gameStateService } from './gameState.service.js';
import type { GameEngineContext, GameParticipant } from './gameEngine.types.js';

export class GameSessionService {
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
    const gameId = room.selectedGameId || requestedGameId || 'truth-or-dare';

    if (requestedGameId && room.selectedGameId && requestedGameId !== room.selectedGameId) {
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
      if (existingActive.gameId !== gameId) {
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

    const gameConfig = await prisma.gameConfiguration.findUnique({
      where: { gameId },
    });
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
          if (activeInTransaction.gameId !== gameId) {
            throw new AppError('A different game session is already active in this room.', 409);
          }
          return { sessionId: activeInTransaction.id, created: false };
        }

        if (currentRoom.status === 'IN_PROGRESS') {
          throw new AppError('The room is already in progress without an active session.', 409);
        }

        if (currentRoom.selectedGameId && currentRoom.selectedGameId !== gameId) {
          throw new AppError('The selected game changed while the session was starting. Please retry.', 409);
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
                privateState:
                  gameId === 'between-us' || gameId === 'would-you-rather'
                    ? undefined
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
      gameId: sessionRecord.gameId,
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

    // Hydrate action idempotency map from past actions
    try {
      const pastActions = await prisma.gameAction.findMany({
        where: { sessionId },
        select: { actionId: true },
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
    return this.restoreSession(sessionId);
  }

  async restoreActiveSessions(): Promise<number> {
    try {
      const activeSessions = await prisma.gameSession.findMany({
        where: {
          status: { in: ['ACTIVE', 'PAUSED'] },
        },
        select: { id: true },
      });

      let count = 0;
      for (const s of activeSessions) {
        const restored = await this.restoreSession(s.id);
        if (restored) count++;
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

    const nextVersion = session.version + 1;

    // Persist pause status and CAS version increment to database
    const updateResult = await prisma.gameSession.updateMany({
      where: { id: sessionId, stateVersion: session.version },
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

    const nextVersion = session.version + 1;

    // Persist resume status and CAS version increment to database
    const updateResult = await prisma.gameSession.updateMany({
      where: { id: sessionId, stateVersion: session.version },
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

    if (!prevSession.roomId) {
      throw new AppError('Cannot rematch a session without an associated room.', 400);
    }

    // 1. Fetch and revalidate room
    const room = await prisma.room.findUnique({
      where: { id: prevSession.roomId },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (!room) {
      throw new NotFoundError('Room not found for rematch');
    }

    if (room.status === 'CLOSED' || room.status === 'EXPIRED') {
      throw new AppError('Cannot initiate rematch in a closed or expired room.', 400);
    }

    // 2. Validate host authority
    if (room.hostId !== hostUserId) {
      throw new ForbiddenError('Only the host can initiate a rematch');
    }

    const gameId = prevSession.gameId;
    const mode = room.mode.toLowerCase() as 'couple' | 'friend';

    // 3. Validate game eligibility for room mode
    if (mode === 'friend' && ['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId)) {
      throw new AppError(`Game "${gameId}" is restricted to Couple Mode only.`, 400);
    }

    if (!isGameEligibleForMode(gameId, mode)) {
      throw new AppError(`Game "${gameId}" is not allowed in ${room.mode} Mode.`, 400);
    }

    // 4. Validate active participants and player count
    const activeParticipants = room.participants.filter((p) => !p.leftAt);
    if (!validatePlayerCount(gameId, activeParticipants.length)) {
      throw new AppError(`Invalid player count (${activeParticipants.length}) for game "${gameId}".`, 400);
    }

    if (mode === 'couple' && activeParticipants.length !== 2) {
      throw new AppError('Couple Mode requires exactly 2 players to start rematch.', 400);
    }

    // 5. Enforce GameConfiguration server-side check
    const gameConfig = await prisma.gameConfiguration.findUnique({
      where: { gameId },
    });
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

    // 6. Ensure no other active session is currently running for this room
    const existingActive = await prisma.gameSession.findFirst({
      where: {
        roomId: room.id,
        status: { in: ['ACTIVE', 'PAUSED'] },
        id: { not: sessionId },
      },
    });
    if (existingActive) {
      throw new AppError('Another active game session already exists for this room.', 409);
    }

    // 7. Query active questions from QuestionEntry if applicable
    let customQuestions: any[] | undefined = undefined;
    if (['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId)) {
      const dbQuestions = await prisma.questionEntry.findMany({
        where: { gameId, isActive: true },
      });
      if (dbQuestions && dbQuestions.length > 0) {
        customQuestions = dbQuestions;
      }
    }

    const engine = gameEngineFactory.getEngine(gameId);
    const newRngSeed = crypto.randomBytes(16).toString('hex');
    const newSessionId = crypto.randomUUID();

    const participants: GameParticipant[] = activeParticipants.map((p, idx) => ({
      userId: p.userId,
      name: p.user.displayName || p.user.username,
      seatIndex: idx,
      isHost: p.userId === hostUserId,
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

    // 8. Persist rematch session to DB transactionally before registering in memory
    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { status: 'IN_PROGRESS', selectedGameId: gameId },
      }),
      prisma.gameSession.create({
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
            create: participants.map((p) => ({
              userId: p.userId,
              seatIndex: p.seatIndex,
              status: 'ACTIVE',
              score: newContext.scores[p.userId] || 0,
              privateState:
                gameId === 'between-us' || gameId === 'would-you-rather'
                  ? undefined
                  : (newContext.privateStates[p.userId] as any),
            })),
          },
        },
      }),
    ]);

    // 9. Register in memory ONLY after successful DB persistence
    gameStateService.setSession(newSessionId, newContext);
    return newContext;
  }
}

export const gameSessionService = new GameSessionService();
