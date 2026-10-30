import type { GameActionEnvelope, ActionResult } from './gameEngine.types.js';
import { gameStateService } from './gameState.service.js';
import { gameEngineFactory } from './gameEngineFactory.js';

export interface ActionExecutionResult {
  success: boolean;
  error?: string;
  version: number;
  publicState?: Record<string, unknown>;
  events?: Array<{ type: string; payload: unknown; targetUserId?: string }>;
  isCompleted?: boolean;
  winnerUserId?: string | null;
}

export class GameActionService {
  applyAction(
    envelope: GameActionEnvelope,
    actorUserId: string
  ): ActionExecutionResult {
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

    // Commit state updates
    if (result.newState) session.state = result.newState;
    if (result.newPrivateStates) session.privateStates = result.newPrivateStates;
    if (result.nextTurnUserId !== undefined) session.currentTurnUserId = result.nextTurnUserId;
    if (result.scores) session.scores = result.scores;
    if (result.winnerUserId !== undefined) session.winnerUserId = result.winnerUserId;
    if (result.isCompleted) session.status = 'COMPLETED';

    session.version += 1;
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
    };
  }
}

export const gameActionService = new GameActionService();

