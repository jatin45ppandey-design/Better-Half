import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import {
  roomCreateLimiter,
  roomJoinLimiter,
  chatLimiter,
} from '../../middleware/rateLimiter.js';
import {
  createRoom,
  getRoomById,
  getRoomByCode,
  getMyActiveRooms,
  joinRoom,
  leaveRoom,
  closeRoom,
  toggleReady,
  voteGame,
  selectGame,
  canStartGame,
  transferHost,
  kickParticipant,
  getMessages,
  postMessage,
} from './rooms.controller.js';
import {
  createRoomSchema,
  joinRoomSchema,
  toggleReadySchema,
  voteGameSchema,
  selectGameSchema,
  transferHostSchema,
  kickParticipantSchema,
  postMessageSchema,
} from './rooms.schema.js';

export const roomRoutes = Router();

// All room routes require authentication
roomRoutes.use(requireAuth);

// Room creation & lookup
roomRoutes.post(
  '/',
  roomCreateLimiter,
  validateRequest({ body: createRoomSchema }),
  createRoom
);

roomRoutes.get('/me', getMyActiveRooms);
roomRoutes.get('/code/:code', getRoomByCode);
roomRoutes.get('/:id', getRoomById);

// Join, leave & close
roomRoutes.post(
  '/join',
  roomJoinLimiter,
  validateRequest({ body: joinRoomSchema }),
  joinRoom
);

roomRoutes.post('/:id/leave', leaveRoom);
roomRoutes.post('/:id/close', closeRoom);

// Readiness, voting, game selection & start readiness check
roomRoutes.post(
  '/:id/ready',
  validateRequest({ body: toggleReadySchema }),
  toggleReady
);

roomRoutes.post(
  '/:id/vote',
  validateRequest({ body: voteGameSchema }),
  voteGame
);

roomRoutes.post(
  '/:id/select-game',
  validateRequest({ body: selectGameSchema }),
  selectGame
);

roomRoutes.get('/:id/can-start', canStartGame);

// Host management & moderation
roomRoutes.post(
  '/:id/transfer-host',
  validateRequest({ body: transferHostSchema }),
  transferHost
);

roomRoutes.post(
  '/:id/kick',
  validateRequest({ body: kickParticipantSchema }),
  kickParticipant
);

// Room chat messages
roomRoutes.get('/:id/messages', getMessages);
roomRoutes.post(
  '/:id/messages',
  chatLimiter,
  validateRequest({ body: postMessageSchema }),
  postMessage
);

