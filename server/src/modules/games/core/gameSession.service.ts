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
    // 1. Fetch Room from DB or fallback
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
      throw new Error('Room not found');
    }

    // 2. Validate host authority
    if (room.hostId !== hostUserId) {
      throw new Error('Only the room host can start a game session');
    }

    // 3. Validate mode eligibility
    const mode = room.mode.toLowerCase() as 'couple' | 'friend';
    const gameId = requestedGameId || room.selectedGameId || 'truth-or-dare';

    if (!isGameEligibleForMode(gameId, mode)) {
      throw new Error(`Game "${gameId}" is not allowed in ${room.mode} Mode`);
    }

    // 4. Validate participant counts & readiness
    const activeParticipants = room.participants.filter((p) => !p.leftAt);
    if (!validatePlayerCount(gameId, activeParticipants.length)) {
      throw new Error(`Invalid player count (${activeParticipants.length}) for game "${gameId}"`);
    }

    if (mode === 'couple' && activeParticipants.length !== 2) {
      throw new Error('Couple Mode requires exactly 2 players to start');
    }

    // Check readiness (all non-host players must be ready, or in 2-player mode all ready)
    const notReady = activeParticipants.filter((p) => p.userId !== hostUserId && !p.isReady);
    if (notReady.length > 0) {
      throw new Error('All players must be ready before starting the match');
    }

    // 5. Generate seed and initial state
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

    // 6. Save in memory
    gameStateService.setSession(sessionId, context);

    // 7. Try persisting in DB safely (non-blocking if DB is unreachable in dev)
    try {
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
                // Never persist BETWEEN US answers or sensitive private states
                privateState:
                  gameId === 'between-us'
                    ? undefined
                    : (context.privateStates[p.userId] as any),
              })),
            },
          },
        }),
      ]);
    } catch {
      // Database write non-blocking for mock or isolated testing
    }

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
    if (!session) throw new Error('Session not found');

    const participant = session.participants.find((p) => p.userId === actorUserId);
    if (!participant) throw new Error('Unauthorized');

    session.isPaused = true;
    session.version += 1;
    gameStateService.setSession(sessionId, session);

    return session;
  }

  async resumeSession(
    sessionId: string,
    actorUserId: string
  ): Promise<GameEngineContext> {
    const session = gameStateService.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const participant = session.participants.find((p) => p.userId === actorUserId);
    if (!participant) throw new Error('Unauthorized');

    session.isPaused = false;
    session.version += 1;
    gameStateService.setSession(sessionId, session);

    return session;
  }

  async rematchSession(
    sessionId: string,
    hostUserId: string
  ): Promise<GameEngineContext> {
    const prevSession = gameStateService.getSession(sessionId);
    if (!prevSession) throw new Error('Session not found');

    const hostParticipant = prevSession.participants.find((p) => p.userId === hostUserId);
    if (!hostParticipant || !hostParticipant.isHost) {
      throw new Error('Only the host can initiate a rematch');
    }

    const engine = gameEngineFactory.getEngine(prevSession.gameId);
    const newRngSeed = Math.random().toString(36).substring(2, 10);
    const newSessionId = `gs-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const initialState = engine.createInitialState({
      sessionId: newSessionId,
      mode: prevSession.mode,
      participants: prevSession.participants,
      rngSeed: newRngSeed,
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
    };

    gameStateService.setSession(newSessionId, newContext);
    return newContext;
  }
}

export const gameSessionService = new GameSessionService();

