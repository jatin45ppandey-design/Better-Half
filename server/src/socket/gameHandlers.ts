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
import { safeSocketError } from './safeError.js';
import {
  gameSessionJoinSchema,
  gameActionSchema,
  gamePauseSchema,
  gameResumeSchema,
  gameRematchSchema,
  gameSessionLeaveSchema,
  validateSocketPayload,
} from './socketSchemas.js';

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
      const result = await gameActionService.applyAction(payload, userId);

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
