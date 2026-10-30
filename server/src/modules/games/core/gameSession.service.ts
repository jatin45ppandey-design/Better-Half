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
  }> {
    // 1. Fetch Room from DB
    let room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          include: { user: true },
        },
      },
    });

    if (!room) {
      // Try finding by code
      room = await prisma.room.findUnique({
        where: { code: roomId.toUpperCase() },
        include: {
          participants: {
            include: { user: true },
          },
        },
      });
    }

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    // 2. Validate host authority
    if (room.hostId !== hostUserId) {
      throw new ForbiddenError('Only the room host can start a game session');
    }

    // 3. Validate mode eligibility
    const mode = room.mode.toLowerCase() as 'couple' | 'friend';
    const gameId = requestedGameId || room.selectedGameId || 'truth-or-dare';

    // Enforce Couple-only hardcoded restriction
    if (mode === 'friend' && ['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId)) {
      throw new AppError(`Game "${gameId}" is restricted to Couple Mode only.`, 400);
    }

    if (!isGameEligibleForMode(gameId, mode)) {
      throw new AppError(`Game "${gameId}" is not allowed in ${room.mode} Mode`, 400);
    }

    // Enforce GameConfiguration server-side check
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

    // 4. Validate participant counts & readiness
    const activeParticipants = room.participants.filter((p) => !p.leftAt);
    if (!validatePlayerCount(gameId, activeParticipants.length)) {
      throw new AppError(`Invalid player count (${activeParticipants.length}) for game "${gameId}"`, 400);
    }

    if (mode === 'couple' && activeParticipants.length !== 2) {
      throw new AppError('Couple Mode requires exactly 2 players to start', 400);
    }

    // Check readiness (all non-host players must be ready, or in 2-player mode all ready)
    const notReady = activeParticipants.filter((p) => p.userId !== hostUserId && !p.isReady);
    if (notReady.length > 0) {
      throw new AppError('All players must be ready before starting the match', 400);
    }

    // 5. Query active questions from QuestionEntry if applicable
    let customQuestions: any[] | undefined = undefined;
    if (['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId)) {
      try {
        const dbQuestions = await prisma.questionEntry.findMany({
          where: { gameId, isActive: true },
        });
        if (dbQuestions && dbQuestions.length > 0) {
          customQuestions = dbQuestions;
        }
      } catch {
        // Fallback to static questions if question library query is unavailable
      }
    }

    // 6. Generate seed and initial state
    const rngSeed = Math.random().toString(36).substring(2, 10);
    const engine = gameEngineFactory.getEngine(gameId);

    const participants: GameParticipant[] = activeParticipants.map((p, idx) => ({
      userId: p.userId,
      name: p.user.displayName || p.user.username,
      seatIndex: idx,
      isHost: p.userId === hostUserId,
    }));

    const sessionId = `gs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
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

    // 7. Persist to DB transactionally BEFORE registering in memory
    // If database persistence fails, an authoritative error is thrown.
    await prisma.$transaction([
      prisma.room.update({
        where: { id: room.id },
        data: { status: 'IN_PROGRESS', selectedGameId: gameId },
      }),
      prisma.gameSession.create({
        data: {
          id: sessionId,
          roomId: room.id,
          gameId,
          mode: room.mode,
          status: 'ACTIVE',
          currentTurnUserId: context.currentTurnUserId,
          stateVersion: 1,
          publicState: engine.getPublicProjection(context.state, context) as any,
          rngSeed,
          participants: {
            create: participants.map((p) => ({
              userId: p.userId,
              seatIndex: p.seatIndex,
              status: 'ACTIVE',
              score: context.scores[p.userId] || 0,
              // Never persist BETWEEN US answers or pending Would You Rather choices
              privateState:
                gameId === 'between-us' || gameId === 'would-you-rather'
                  ? undefined
                  : (context.privateStates[p.userId] as any),
            })),
          },
        },
      }),
    ]);

    // 8. Register in memory ONLY after DB persistence succeeds
    gameStateService.setSession(sessionId, context);

    return { session: context, roomCode: room.code };
  }

  getSession(sessionId: string): GameEngineContext | null {
    return gameStateService.getSession(sessionId);
  }

  async pauseSession(
    sessionId: string,
    actorUserId: string
  ): Promise<GameEngineContext> {
    const session = gameStateService.getSession(sessionId);
    if (!session) throw new NotFoundError('Session not found');

    const participant = session.participants.find((p) => p.userId === actorUserId);
    if (!participant) throw new ForbiddenError('Not a participant of this game session');

    const nextVersion = session.version + 1;

    // Persist pause status and version increment to database
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'PAUSED',
        stateVersion: nextVersion,
      },
    });

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
    const session = gameStateService.getSession(sessionId);
    if (!session) throw new NotFoundError('Session not found');

    const participant = session.participants.find((p) => p.userId === actorUserId);
    if (!participant) throw new ForbiddenError('Not a participant of this game session');

    const nextVersion = session.version + 1;

    // Persist resume status and version increment to database
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        status: 'ACTIVE',
        stateVersion: nextVersion,
      },
    });

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
    const prevSession = gameStateService.getSession(sessionId);
    if (!prevSession) throw new NotFoundError('Session not found');

    const hostParticipant = prevSession.participants.find((p) => p.userId === hostUserId);
    if (!hostParticipant || !hostParticipant.isHost) {
      throw new ForbiddenError('Only the host can initiate a rematch');
    }

    const gameId = prevSession.gameId;
    const mode = prevSession.mode;

    // Enforce GameConfiguration server-side check
    const gameConfig = await prisma.gameConfiguration.findUnique({
      where: { gameId },
    });
    if (gameConfig && !gameConfig.isEnabled) {
      throw new AppError(`Game "${gameId}" is currently disabled by administrators.`, 400);
    }

    // Enforce Couple-only restriction
    if (mode === 'friend' && ['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId)) {
      throw new AppError(`Game "${gameId}" is restricted to Couple Mode only.`, 400);
    }

    // Query active questions from QuestionEntry if applicable
    let customQuestions: any[] | undefined = undefined;
    if (['truth-or-dare', 'would-you-rather', 'between-us'].includes(gameId)) {
      try {
        const dbQuestions = await prisma.questionEntry.findMany({
          where: { gameId, isActive: true },
        });
        if (dbQuestions && dbQuestions.length > 0) {
          customQuestions = dbQuestions;
        }
      } catch {
        // Fallback to static questions
      }
    }

    const engine = gameEngineFactory.getEngine(gameId);
    const newRngSeed = Math.random().toString(36).substring(2, 10);
    const newSessionId = `gs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const initialState = engine.createInitialState({
      sessionId: newSessionId,
      mode: prevSession.mode,
      participants: prevSession.participants,
      rngSeed: newRngSeed,
      customQuestions,
    });

    const newContext: GameEngineContext = {
      sessionId: newSessionId,
      gameId: prevSession.gameId,
      mode: prevSession.mode,
      participants: prevSession.participants,
      state: initialState.state,
      privateStates: initialState.privateStates,
      version: 1,
      isPaused: false,
      status: 'ACTIVE',
      scores: initialState.scores || {},
      rngSeed: newRngSeed,
      currentTurnUserId: initialState.currentTurnUserId || prevSession.participants[0]?.userId || null,
      roomId: prevSession.roomId,
      startedAt: new Date(),
    };

    // Persist rematch session to DB transactionally before registering in memory
    await prisma.$transaction([
      ...(prevSession.roomId
        ? [
          prisma.room.update({
            where: { id: prevSession.roomId },
            data: { status: 'IN_PROGRESS', selectedGameId: gameId },
          }),
        ]
        : []),
      prisma.gameSession.create({
        data: {
          id: newSessionId,
          roomId: prevSession.roomId || 'direct-room',
          gameId,
          mode: prevSession.mode.toUpperCase(),
          status: 'ACTIVE',
          currentTurnUserId: newContext.currentTurnUserId,
          stateVersion: 1,
          publicState: engine.getPublicProjection(newContext.state, newContext) as any,
          rngSeed: newRngSeed,
          participants: {
            create: prevSession.participants.map((p) => ({
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

    // Register in memory ONLY after successful DB persistence
    gameStateService.setSession(newSessionId, newContext);
    return newContext;
  }
}

export const gameSessionService = new GameSessionService();
