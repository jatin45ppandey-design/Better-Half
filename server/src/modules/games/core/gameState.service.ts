import type { GameEngineContext } from './gameEngine.types.js';
import { gameEngineFactory } from './gameEngineFactory.js';

export interface GameStateServiceOptions {
  maxSessions?: number;
  sessionTtlMs?: number;
  maxActionsPerSession?: number;
  sweepIntervalMs?: number;
}

export class GameStateService {
  private activeSessions: Map<string, GameEngineContext> = new Map();
  private processedActionIds: Map<string, Set<string>> = new Map();
  private lastAccessedAt: Map<string, number> = new Map();
  private accessCounter = 0;
  private sessionAccessOrder: Map<string, number> = new Map();

  private maxSessions: number;
  private sessionTtlMs: number;
  private maxActionsPerSession: number;
  private sweepInterval: NodeJS.Timeout | null = null;

  constructor(options: GameStateServiceOptions = {}) {
    this.maxSessions = options.maxSessions ?? 500;
    this.sessionTtlMs = options.sessionTtlMs ?? 30 * 60 * 1000; // 30 minutes
    this.maxActionsPerSession = options.maxActionsPerSession ?? 100;

    const sweepIntervalMs = options.sweepIntervalMs ?? 60 * 1000;
    if (sweepIntervalMs > 0) {
      this.sweepInterval = setInterval(() => {
        this.evictExpiredSessions();
      }, sweepIntervalMs);
      if (typeof this.sweepInterval.unref === 'function') {
        this.sweepInterval.unref();
      }
    }
  }

  /**
   * Determine if an in-memory session holds volatile client data that has
   * not yet been committed to PostgreSQL or revealed to players.
   *
   * Crucially, Between Us pending answers exist exclusively in memory
   * (context.privateStates[userId].pendingAnswer) during the ANSWERING phase.
   * Evicting such sessions prematurely would destroy unrevealed player submissions.
   */
  isEvictionProtected(context: GameEngineContext): boolean {
    if (context.status !== 'ACTIVE') return false;

    if (context.gameId === 'between-us') {
      const state = context.state as any;
      if (state?.phase === 'ANSWERING') {
        const privateStates = context.privateStates || {};
        const hasPending = Object.values(privateStates).some(
          (p: any) => typeof p?.pendingAnswer === 'string' && p.pendingAnswer.trim().length > 0
        );
        if (hasPending) return true;
      }
    }

    return false;
  }

  getSession(sessionId: string): GameEngineContext | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;
    this.lastAccessedAt.set(sessionId, Date.now());
    this.sessionAccessOrder.set(sessionId, ++this.accessCounter);
    return session;
  }

  getSessionForParticipant(sessionId: string, userId: string): GameEngineContext | null {
    const session = this.getSession(sessionId);
    if (!session || !session.participants.some((participant) => participant.userId === userId)) return null;
    return session;
  }

  setSession(sessionId: string, context: GameEngineContext): void {
    // Check LRU eviction if cache size exceeds limit and this is a new session
    if (!this.activeSessions.has(sessionId) && this.activeSessions.size >= this.maxSessions) {
      this.evictLRU(sessionId);
    }

    this.activeSessions.set(sessionId, context);
    this.lastAccessedAt.set(sessionId, Date.now());
    this.sessionAccessOrder.set(sessionId, ++this.accessCounter);

    if (!this.processedActionIds.has(sessionId)) {
      this.processedActionIds.set(sessionId, new Set());
    }
  }

  private evictLRU(excludeSessionId?: string): boolean {
    let oldestOrder = Infinity;
    let oldestId: string | null = null;

    for (const [id, session] of this.activeSessions.entries()) {
      if (id === excludeSessionId) continue;
      if (this.isEvictionProtected(session)) continue;

      const order = this.sessionAccessOrder.get(id) || 0;
      if (order < oldestOrder) {
        oldestOrder = order;
        oldestId = id;
      }
    }

    if (oldestId) {
      this.removeSession(oldestId);
      return true;
    }
    return false;
  }

  /**
   * Remove expired sessions based on TTL, preserving volatile protected sessions.
   */
  evictExpiredSessions(): number {
    const now = Date.now();
    let evictedCount = 0;

    for (const [id, session] of this.activeSessions.entries()) {
      if (this.isEvictionProtected(session)) continue;

      const lastAccess = this.lastAccessedAt.get(id) || 0;
      if (now - lastAccess > this.sessionTtlMs) {
        this.removeSession(id);
        evictedCount++;
      }
    }

    return evictedCount;
  }

  removeSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.processedActionIds.delete(sessionId);
    this.lastAccessedAt.delete(sessionId);
    this.sessionAccessOrder.delete(sessionId);
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

    // Bound memory consumption for idempotency actions per session
    if (actions.size > this.maxActionsPerSession) {
      const oldestActionId = actions.keys().next().value;
      if (oldestActionId) {
        actions.delete(oldestActionId);
      }
    }
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

  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }

  shutdown(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  reset(): void {
    this.activeSessions.clear();
    this.processedActionIds.clear();
    this.lastAccessedAt.clear();
    this.sessionAccessOrder.clear();
    this.accessCounter = 0;
  }
}

export const gameStateService = new GameStateService();
