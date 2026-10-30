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

export function registerGameHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) {
  const userId = socket.data.userId;

  // 1. Join Game Session
  socket.on('game:session:join', async (payload, callback) => {
    try {
      const { sessionId } = payload;
      const session = gameStateService.getSession(sessionId);

      if (!session) {
        callback?.({ success: false, error: 'Game session not found.' });
        return;
      }

      const participant = session.participants.find((p) => p.userId === userId);
      if (!participant) {
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
      callback?.({ success: false, error: err.message || 'Failed to join game session.' });
    }
  });

  // 2. Submit Game Action
  socket.on('game:action', (payload, callback) => {
    try {
      const result = gameActionService.applyAction(payload, userId);

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
        });
      }
    } catch (err: any) {
      callback?.({ success: false, error: err.message || 'Action execution error.' });
    }
  });

  // 3. Pause Game Session
  socket.on('game:pause', async (payload, callback) => {
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
      callback?.({ success: false, error: err.message || 'Failed to pause match.' });
    }
  });

  // 4. Resume Game Session
  socket.on('game:resume', async (payload, callback) => {
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
      callback?.({ success: false, error: err.message || 'Failed to resume match.' });
    }
  });

  // 5. Rematch Request
  socket.on('game:rematch:request', async (payload, callback) => {
    try {
      const newSession = await gameSessionService.rematchSession(payload.sessionId, userId);

      io.to(`session:${payload.sessionId}`).emit('game:session:started', {
        sessionId: newSession.sessionId,
        gameId: newSession.gameId,
        roomCode: '',
      });

      callback?.({ success: true, newSessionId: newSession.sessionId });
    } catch (err: any) {
      callback?.({ success: false, error: err.message || 'Failed to initiate rematch.' });
    }
  });

  // 6. Leave Game Session
  socket.on('game:session:leave', (payload, callback) => {
    socket.leave(`session:${payload.sessionId}`);
    callback?.({ success: true });
  });
}
