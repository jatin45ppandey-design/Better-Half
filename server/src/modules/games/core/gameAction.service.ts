import type { GameActionEnvelope, ActionResult, GameEngineContext } from './gameEngine.types.js';
import { gameSessionService } from './gameSession.service.js';
import { gameStateService } from './gameState.service.js';
import { gameEngineFactory } from './gameEngineFactory.js';
import { prisma } from '../../../config/prisma.js';
import { matchFinalizationService } from '../match/matchFinalization.service.js';
import { logger } from '../../../utils/logger.js';

export interface ActionExecutionResult {
  success: boolean;
  error?: string;
  version: number;
  publicState?: Record<string, unknown>;
  events?: Array<{ type: string; payload: unknown; targetUserId?: string }>;
  isCompleted?: boolean;
  winnerUserId?: string | null;
  matchId?: string | null;
}

function sanitizeActionMetadata(action: any, gameId: string): any {
  if (!action || typeof action !== 'object') return null;

  // Strict privacy: never persist BETWEEN US answers or sensitive text answers
  if (gameId === 'between-us' || action.type === 'SUBMIT_ANSWER') {
    return { type: action.type, hasSubmitted: true };
  }

  // Strict privacy: never persist pending Would You Rather dilemma choices
  if (gameId === 'would-you-rather' && action.type === 'SUBMIT_CHOICE') {
    return { type: action.type, submitted: true };
  }

  const safe = { ...action };
  delete safe.password;
  delete safe.token;
  delete safe.secret;
  delete safe.answerText;
  delete safe.answer;
  delete safe.pendingChoice;
  return safe;
}

export class GameActionService {
  async applyAction(
    envelope: GameActionEnvelope,
    actorUserId: string
  ): Promise<ActionExecutionResult> {
    const { sessionId, actionId, expectedVersion, action } = envelope;

    let session = gameStateService.getSession(sessionId);
    if (!session) {
      session = await gameSessionService.getOrRestoreSession(sessionId);
    }
    if (!session) {
      return { success: false, error: 'Session not found.', version: 0 };
    }

    if (session.status !== 'ACTIVE') {
      return {
        success: false,
        error: `Cannot apply action. Session is ${session.status.toLowerCase()}.`,
        version: session.version,
      };
    }

    if (session.isPaused) {
      return {
        success: false,
        error: 'Game is currently paused.',
        version: session.version,
      };
    }

    // 1. Enforce Action ID idempotency across process restarts
    if (gameStateService.isActionProcessed(sessionId, actionId)) {
      const publicState = gameStateService.getPublicProjection(sessionId) || {};
      return {
        success: true,
        version: session.version,
        publicState,
      };
    }

    try {
      const existingAction = await prisma.gameAction.findFirst({
        where: { sessionId, actionId },
      });
      if (existingAction) {
        gameStateService.markActionProcessed(sessionId, actionId);
        const publicState = gameStateService.getPublicProjection(sessionId) || {};
        return {
          success: true,
          version: session.version,
          publicState,
        };
      }
    } catch (err: any) {
      logger.warn(`Idempotency DB lookup failed: ${err?.message || err}`);
      return {
        success: false,
        error: 'Database unavailable for idempotency verification.',
        version: session.version,
      };
    }

    // 2. State version verification (optimistic concurrency check)
    if (expectedVersion !== undefined && expectedVersion !== session.version) {
      return {
        success: false,
        error: `Version conflict: client expected v${expectedVersion}, but server is at v${session.version}.`,
        version: session.version,
      };
    }

    // 3. Check membership
    const participant = session.participants.find((p) => p.userId === actorUserId);
    if (!participant) {
      return {
        success: false,
        error: 'You are not a participant in this game session.',
        version: session.version,
      };
    }

    const engine = gameEngineFactory.getEngine(session.gameId);

    // 4. Validate action
    const validation = engine.validateAction(action, session, actorUserId);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid action.',
        version: session.version,
      };
    }

    // 5. Capture complete immutable pre-action snapshot BEFORE applying action
    const preActionSnapshot: GameEngineContext = {
      sessionId: session.sessionId,
      gameId: session.gameId,
      mode: session.mode,
      participants: session.participants.map((p) => ({ ...p })),
      state: structuredClone(session.state),
      privateStates: structuredClone(session.privateStates),
      version: session.version,
      isPaused: session.isPaused,
      status: session.status,
      winnerUserId: session.winnerUserId,
      scores: { ...session.scores },
      rngSeed: session.rngSeed,
      currentTurnUserId: session.currentTurnUserId,
      roomId: session.roomId,
      startedAt: session.startedAt,
    };

    // 6. Apply action to working copy
    const workingSession: GameEngineContext = {
      ...preActionSnapshot,
      state: structuredClone(preActionSnapshot.state),
      privateStates: structuredClone(preActionSnapshot.privateStates),
      scores: { ...preActionSnapshot.scores },
    };

    const result: ActionResult = engine.applyAction(action, workingSession, actorUserId);
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Action failed to apply.',
        version: session.version,
      };
    }

    const targetVersion = session.version;
    const newVersion = session.version + 1;
    workingSession.version = newVersion;

    if (result.newState) workingSession.state = result.newState;
    if (result.newPrivateStates) workingSession.privateStates = result.newPrivateStates;
    if (result.nextTurnUserId !== undefined) workingSession.currentTurnUserId = result.nextTurnUserId;
    if (result.scores) workingSession.scores = result.scores;
    if (result.winnerUserId !== undefined) workingSession.winnerUserId = result.winnerUserId;
    if (result.isCompleted) workingSession.status = 'COMPLETED';

    const publicProj = engine.getPublicProjection(workingSession.state, workingSession);
    const sanitized = sanitizeActionMetadata(action, workingSession.gameId);

    // 7. Execute single atomic transaction:
    // Update session with expectedVersion check, insert action, update participants, and finalize match if completed.
    let finalizedMatchId: string | null = null;

    try {
      await prisma.$transaction(async (tx) => {
        // A. Concurrency-safe expected-version update
        const updateResult = await tx.gameSession.updateMany({
          where: {
            id: sessionId,
            stateVersion: targetVersion,
          },
          data: {
            stateVersion: newVersion,
            currentTurnUserId: workingSession.currentTurnUserId,
            status: workingSession.status,
            publicState: publicProj as any,
            completedAt: workingSession.status === 'COMPLETED' ? new Date() : undefined,
          },
        });

        if (updateResult.count === 0) {
          throw new Error(`CONCURRENCY_CONFLICT: Version mismatch or concurrent action committed (expected v${targetVersion}).`);
        }

        // B. Insert persisted GameAction
        await tx.gameAction.create({
          data: {
            sessionId,
            actorUserId,
            actionId,
            sequenceNumber: newVersion,
            actionType: action.type,
            sanitizedMetadata: sanitized,
          },
        });

        // C. Update participant scores and permitted private state
        for (const p of workingSession.participants) {
          // Never persist BETWEEN US personal answers or pending Would You Rather choices
          const safePrivateState =
            workingSession.gameId === 'between-us' || workingSession.gameId === 'would-you-rather'
              ? undefined
              : (workingSession.privateStates[p.userId] as any);

          await tx.gameSessionParticipant.updateMany({
            where: {
              sessionId,
              userId: p.userId,
            },
            data: {
              score: workingSession.scores[p.userId] || 0,
              privateState: safePrivateState,
            },
          });
        }

        // D. Finalize match in same atomic transaction if completed
        if (result.isCompleted) {
          const finalized = await matchFinalizationService.finalizeMatch(workingSession, tx);
          if (!finalized || !finalized.matchId) {
            throw new Error('Failed to finalize match in atomic transaction.');
          }
          finalizedMatchId = finalized.matchId;
        }
      });
    } catch (err: any) {
      logger.error(`Action transaction failed: ${err?.message || err}`);
      // On persistence failure: full original context is untouched in memory!
      // Do not mark action processed. Do not acknowledge success.
      return {
        success: false,
        error: err?.message?.includes('CONCURRENCY_CONFLICT')
          ? 'Version conflict: another action was processed concurrently.'
          : 'Action persistence failed.',
        version: session.version,
      };
    }

    // 8. Commit to in-memory GameStateService ONLY after successful database transaction
    session.version = newVersion;
    session.state = workingSession.state;
    session.privateStates = workingSession.privateStates;
    session.scores = workingSession.scores;
    session.currentTurnUserId = workingSession.currentTurnUserId;
    session.winnerUserId = workingSession.winnerUserId;
    session.status = workingSession.status;

    gameStateService.markActionProcessed(sessionId, actionId);
    gameStateService.setSession(sessionId, session);

    const publicState = gameStateService.getPublicProjection(sessionId) || {};

    return {
      success: true,
      version: session.version,
      publicState,
      events: result.events,
      isCompleted: result.isCompleted,
      winnerUserId: result.winnerUserId,
      matchId: finalizedMatchId,
    };
  }
}

export const gameActionService = new GameActionService();
