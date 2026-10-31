import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types.js';
import { gameStateService } from '../modules/games/core/gameState.service.js';
import { gameActionService } from '../modules/games/core/gameAction.service.js';
import { gameSessionService } from '../modules/games/core/gameSession.service.js';
import { presenceManager } from './presence.js';
import { prisma } from '../config/prisma.js';
import { safeSocketError } from './safeError.js';
import type { GameActionEnvelope } from '../modules/games/core/gameEngine.types.js';
import {
  gameSessionJoinSchema,
  gameActionSchema,
  gamePauseSchema,
  gameResumeSchema,
  gameRematchSchema,
  gameSessionLeaveSchema,
  validateSocketPayload,
} from './socketSchemas.js';

type SnatchDropTimer = {
  timer: ReturnType<typeof setTimeout>;
  dropState: string;
  version: number;
};

const snatchDropTimers = new Map<string, SnatchDropTimer>();

/**
 * Server-owned Snatch The Fries drop scheduler. It is started when a participant
 * joins a session and after each game action, so no host browser/tab is required
 * to keep the match moving.
 */
async function scheduleServerSnatchDrop(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  sessionId: string
): Promise<void> {
  const session = gameStateService.getSession(sessionId)
    || await gameSessionService.getOrRestoreSession(sessionId);

  if (!session || session.gameId !== 'snatch-the-fries' || session.status !== 'ACTIVE') {
    const existing = snatchDropTimers.get(sessionId);
    if (existing) clearTimeout(existing.timer);
    snatchDropTimers.delete(sessionId);
    return;
  }

  const state = session.state as {
    dropState?: string;
    matchOver?: boolean;
  };

  const existing = snatchDropTimers.get(sessionId);
  if (state.matchOver || state.dropState === 'DROPPED') {
    if (existing) clearTimeout(existing.timer);
    snatchDropTimers.delete(sessionId);
    return;
  }

  const dropState = state.dropState || 'WAITING';
  if (
    existing &&
    existing.dropState === dropState &&
    existing.version === session.version
  ) {
    return;
  }
  if (existing) clearTimeout(existing.timer);

  const delay = dropState === 'FALSE_START'
    ? 1500
    : dropState === 'SNATCHED'
    ? 1400
    : Math.floor(Math.random() * 2600) + 1400;

  const timer = setTimeout(async () => {
    snatchDropTimers.delete(sessionId);

    try {
      const latestSession = gameStateService.getSession(sessionId)
        || await gameSessionService.getOrRestoreSession(sessionId);
      if (!latestSession || latestSession.status !== 'ACTIVE') return;

      const latestState = latestSession.state as { dropState?: string; matchOver?: boolean };
      if (latestState.matchOver || latestState.dropState === 'DROPPED') return;

      const room = latestSession.roomId
        ? await prisma.room.findUnique({
            where: { id: latestSession.roomId },
            select: { hostId: true, status: true },
          })
        : null;

      if (!room || room.status !== 'IN_PROGRESS') return;
      if (!latestSession.participants.some((participant) => participant.userId === room.hostId)) return;

      const result = await gameActionService.applyAction(
        {
          sessionId,
          actionId: `server-fries-drop-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          expectedVersion: latestSession.version,
          action: { type: 'SPAWN_DROP' },
        },
        room.hostId
      );

      if (result.success) {
        if (result.publicState) {
          io.to(`session:${sessionId}`).emit('game:state', { publicState: result.publicState });
        }
        result.events?.forEach((event) => {
          io.to(`session:${sessionId}`).emit('game:event', {
            type: event.type,
            payload: event.payload,
          });
        });
      } else if (result.error?.toLowerCase().includes('version conflict')) {
        // An unrelated accepted action won the version race. Re-read current
        // state and only schedule again when the game still needs a drop.
        await scheduleServerSnatchDrop(io, sessionId);
      }
    } catch (error: any) {
      console.warn('[Snatch The Fries] Server drop scheduler failed:', error?.message || error);
    }
  }, delay);

  snatchDropTimers.set(sessionId, { timer, dropState, version: session.version });
}

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) {
  const userId = socket.data.userId;

  const checkSuspension = (callback?: (res: { success: false; error: string }) => void): boolean => {
    if (socket.data.accountStatus === 'SUSPENDED') {
      callback?.({ success: false, error: 'Your account is suspended' });
      socket.disconnect(true);
      return true;
    }
    if (socket.data.tokenExp && Date.now() > socket.data.tokenExp) {
      callback?.({ success: false, error: 'Authentication token has expired' });
      socket.emit('room:error', { code: 'TOKEN_EXPIRED', message: 'Authentication token has expired.' });
      socket.disconnect(true);
      return true;
    }
    return false;
  };

  // 1. Join Game Session
  socket.on('game:session:join', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(gameSessionJoinSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const { sessionId } = payload;
      const session = await gameSessionService.getOrRestoreSession(sessionId);

      if (!session) {
        callback?.({ success: false, error: 'Game session not found.' });
        return;
      }

      const authorizedSession = gameStateService.getSessionForParticipant(sessionId, userId);
      if (!authorizedSession) {
        callback?.({ success: false, error: 'You are not a participant of this game session.' });
        return;
      }

      // Join socket room for this game session
      socket.join(`session:${sessionId}`);

      if (session.gameId === 'snatch-the-fries') {
        void scheduleServerSnatchDrop(io, sessionId);
      }

      const publicState = gameStateService.getPublicProjection(sessionId) || {};
      const privateState = gameStateService.getPrivateProjection(sessionId, userId);

      // Emit initial projections
      socket.emit('game:state', { publicState });
      if (privateState) {
        socket.emit('game:state:private', { privateState });
      }

      callback?.({
        success: true,
        publicState,
        privateState,
      });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to join game session.') });
    }
  });

  // 2. Submit Game Action
  socket.on('game:action', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(gameActionSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const envelope: GameActionEnvelope = {
        sessionId: payload.sessionId,
        actionId: payload.actionId,
        expectedVersion: ((payload.expectedVersion ?? payload.version) as number),
        action: payload.action,
      };
      const result = await gameActionService.applyAction(envelope, userId);

      if (!result.success) {
        socket.emit('game:action:rejected', {
          actionId: payload.actionId,
          error: result.error || 'Action failed.',
        });
        callback?.({ success: false, error: result.error, version: result.version });
        return;
      }

      socket.emit('game:action:accepted', {
        actionId: payload.actionId,
        version: result.version,
      });

      callback?.({ success: true, version: result.version });

      // Broadcast public state to all sockets in session
      if (result.publicState) {
        io.to(`session:${payload.sessionId}`).emit('game:state', {
          publicState: result.publicState,
        });
      }

      // Distribute private states to each participant securely
      const session = gameStateService.getSession(payload.sessionId);
      if (session) {
        session.participants.forEach((p) => {
          const pState = gameStateService.getPrivateProjection(payload.sessionId, p.userId);
          if (pState) {
            const userSockets = presenceManager.getUserSockets(p.userId);
            userSockets.forEach((sId) => {
              io.to(sId).emit('game:state:private', { privateState: pState });
            });
          }
        });
      }

      // Broadcast game events
      if (result.events) {
        result.events.forEach((evt) => {
          if (evt.targetUserId) {
            const targetSockets = presenceManager.getUserSockets(evt.targetUserId);
            targetSockets.forEach((sId) => {
              io.to(sId).emit('game:event', { type: evt.type, payload: evt.payload });
            });
          } else {
            io.to(`session:${payload.sessionId}`).emit('game:event', {
              type: evt.type,
              payload: evt.payload,
            });
          }
        });
      }

      // Schedule the next server-owned fry drop after SNATCH/FALSE_START.
      // SPAWN_DROP moves the state to DROPPED, which clears any pending timer.
      if (session?.gameId === 'snatch-the-fries') {
        void scheduleServerSnatchDrop(io, payload.sessionId);
      }

      // Broadcast game completion
      if (result.isCompleted && session) {
        io.to(`session:${payload.sessionId}`).emit('game:completed', {
          sessionId: payload.sessionId,
          winnerUserId: result.winnerUserId || null,
          scores: session.scores,
          matchId: result.matchId || null,
        });
      }
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Action execution error.') });
    }
  });

  // 3. Pause Game Session
  socket.on('game:pause', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(gamePauseSchema, rawPayload, callback);
    if (!payload) return;

    try {
      await gameSessionService.pauseSession(payload.sessionId, userId);
      const publicState = gameStateService.getPublicProjection(payload.sessionId) || {};

      io.to(`session:${payload.sessionId}`).emit('game:paused', {
        sessionId: payload.sessionId,
        pausedBy: userId,
      });
      io.to(`session:${payload.sessionId}`).emit('game:state', { publicState });

      callback?.({ success: true });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to pause match.') });
    }
  });

  // 4. Resume Game Session
  socket.on('game:resume', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(gameResumeSchema, rawPayload, callback);
    if (!payload) return;

    try {
      await gameSessionService.resumeSession(payload.sessionId, userId);
      const publicState = gameStateService.getPublicProjection(payload.sessionId) || {};

      io.to(`session:${payload.sessionId}`).emit('game:resumed', {
        sessionId: payload.sessionId,
        resumedBy: userId,
      });
      io.to(`session:${payload.sessionId}`).emit('game:state', { publicState });

      callback?.({ success: true });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to resume match.') });
    }
  });

  // 5. Rematch Request
  socket.on('game:rematch:request', async (rawPayload, callback) => {
    if (checkSuspension(callback)) return;

    const payload = validateSocketPayload(gameRematchSchema, rawPayload, callback);
    if (!payload) return;

    try {
      const newSession = await gameSessionService.rematchSession(payload.sessionId, userId);

      io.to(`session:${payload.sessionId}`).emit('game:session:started', {
        sessionId: newSession.sessionId,
        gameId: newSession.gameId,
        roomCode: '',
      });

      callback?.({ success: true, newSessionId: newSession.sessionId });
    } catch (err: any) {
      callback?.({ success: false, error: safeSocketError(err, 'Failed to initiate rematch.') });
    }
  });

  // 6. Leave Game Session
  socket.on('game:session:leave', (rawPayload, callback) => {
    const payload = validateSocketPayload(gameSessionLeaveSchema, rawPayload, callback);
    if (!payload) return;

    socket.leave(`session:${payload.sessionId}`);
    callback?.({ success: true });
  });
}
