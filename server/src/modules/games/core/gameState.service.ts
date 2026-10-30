import type { GameEngineContext } from './gameEngine.types.js';
import { gameEngineFactory } from './gameEngineFactory.js';

export class GameStateService {
  private activeSessions: Map<string, GameEngineContext> = new Map();
  private processedActionIds: Map<string, Set<string>> = new Map();

  getSession(sessionId: string): GameEngineContext | null {
    return this.activeSessions.get(sessionId) || null;
  }

  getSessionForParticipant(sessionId: string, userId: string): GameEngineContext | null {
    const session = this.getSession(sessionId);
    if (!session || !session.participants.some((participant) => participant.userId === userId)) return null;
    return session;
  }

  setSession(sessionId: string, context: GameEngineContext): void {
    this.activeSessions.set(sessionId, context);
    if (!this.processedActionIds.has(sessionId)) {
      this.processedActionIds.set(sessionId, new Set());
    }
  }

  removeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.processedActionIds.delete(sessionId);
  }

  isActionProcessed(sessionId: string, actionId: string): boolean {
    const actions = this.processedActionIds.get(sessionId);
    return actions ? actions.has(actionId) : false;
  }

  markActionProcessed(sessionId: string, actionId: string): void {
    let actions = this.processedActionIds.get(sessionId);
    if (!actions) {
      actions = new Set();
      this.processedActionIds.set(sessionId, actions);
    }
    actions.add(actionId);
  }

  getPublicProjection(sessionId: string): Record<string, unknown> | null {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const engine = gameEngineFactory.getEngine(session.gameId);
    const enginePublicState = engine.getPublicProjection(session.state, session);

    return {
      sessionId: session.sessionId,
      gameId: session.gameId,
      mode: session.mode,
      version: session.version,
      status: session.status,
      isPaused: session.isPaused,
      winnerUserId: session.winnerUserId,
      scores: session.scores,
      currentTurnUserId: session.currentTurnUserId,
      participants: session.participants,
      state: enginePublicState,
    };
  }

  getPrivateProjection(
    sessionId: string,
    userId: string
  ): Record<string, unknown> | null {
    const session = this.getSessionForParticipant(sessionId, userId);
    if (!session) return null;

    const engine = gameEngineFactory.getEngine(session.gameId);
    const userPrivateState = session.privateStates[userId];

    if (!userPrivateState) {
      return engine.getPrivateProjection(null as any, session.state, userId, session);
    }

    return engine.getPrivateProjection(
      userPrivateState,
      session.state,
      userId,
      session
    );
  }
}

export const gameStateService = new GameStateService();

