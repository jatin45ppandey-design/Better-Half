import type { GameActionEnvelope, ActionResult } from './gameEngine.types.js';
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

  if (gameId === 'would-you-rather' && action.type === 'SUBMIT_CHOICE') {
    return { type: action.type, submitted: true };
  }

  const safe = { ...action };
  delete safe.password;
  delete safe.token;
  delete safe.secret;
  delete safe.answerText;
  delete safe.answer;
  return safe;
}

export class GameActionService {
  async applyAction(
    envelope: GameActionEnvelope,
    actorUserId: string
  ): Promise<ActionExecutionResult> {
    const { sessionId, actionId, expectedVersion, action } = envelope;

    const session = gameStateService.getSession(sessionId);
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

    // Idempotency: return success if action already executed
    if (gameStateService.isActionProcessed(sessionId, actionId)) {
      const publicState = gameStateService.getPublicProjection(sessionId) || {};
      return {
        success: true,
        version: session.version,
        publicState,
      };
    }

    // State version verification (optimistic concurrency)
    if (expectedVersion !== undefined && expectedVersion !== session.version) {
      return {
        success: false,
        error: `Version conflict: client expected v${expectedVersion}, but server is at v${session.version}.`,
        version: session.version,
      };
    }

    // Check membership
    const participant = session.participants.find((p) => p.userId === actorUserId);
    if (!participant) {
      return {
        success: false,
        error: 'You are not a participant in this game session.',
        version: session.version,
      };
    }

    const engine = gameEngineFactory.getEngine(session.gameId);

    // Validate action
    const validation = engine.validateAction(action, session, actorUserId);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error || 'Invalid action.',
        version: session.version,
      };
    }

    // Apply action
    const result: ActionResult = engine.applyAction(action, session, actorUserId);
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Action failed to apply.',
        version: session.version,
      };
    }

    // Clone previous state in case DB rollback is needed
    const prevVersion = session.version;
    const prevTurn = session.currentTurnUserId;
    const prevStatus = session.status;
    const prevScores = { ...session.scores };

    // Advance version and mutate state
    session.version += 1;
    if (result.newState) session.state = result.newState;
    if (result.newPrivateStates) session.privateStates = result.newPrivateStates;
    if (result.nextTurnUserId !== undefined) session.currentTurnUserId = result.nextTurnUserId;
    if (result.scores) session.scores = result.scores;
    if (result.winnerUserId !== undefined) session.winnerUserId = result.winnerUserId;
    if (result.isCompleted) session.status = 'COMPLETED';

    // Persist to database before broadcasting
    try {
      const publicProj = engine.getPublicProjection(session.state, session);
      const sanitized = sanitizeActionMetadata(action, session.gameId);

      await prisma.$transaction([
        prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            stateVersion: session.version,
            currentTurnUserId: session.currentTurnUserId,
            status: session.status,
            publicState: publicProj as any,
            completedAt: session.status === 'COMPLETED' ? new Date() : undefined,
          },
        }),
        prisma.gameAction.create({
          data: {
            sessionId,
            actorUserId,
            actionId,
            sequenceNumber: session.version,
            actionType: action.type,
            sanitizedMetadata: sanitized,
          },
        }),
      ]);
    } catch (err: any) {
      if (process.env.NODE_ENV === 'production') {
        // Rollback state in memory if persistence fails in production
        session.version = prevVersion;
        session.currentTurnUserId = prevTurn;
        session.status = prevStatus;
        session.scores = prevScores;
        return {
          success: false,
          error: 'Action persistence failed.',
          version: prevVersion,
        };
      }
      logger.warn(`Action DB persistence skipped/failed: ${err?.message || err}`);
    }

    gameStateService.markActionProcessed(sessionId, actionId);
    gameStateService.setSession(sessionId, session);

    // Finalize match if game is completed
    let matchId: string | null = null;
    if (result.isCompleted) {
      const finalized = await matchFinalizationService.finalizeMatch(session);
      matchId = finalized?.matchId || null;
    }

    const publicState = gameStateService.getPublicProjection(sessionId) || {};

    return {
      success: true,
      version: session.version,
      publicState,
      events: result.events,
      isCompleted: result.isCompleted,
      winnerUserId: result.winnerUserId,
      matchId,
    };
  }
}

export const gameActionService = new GameActionService();
