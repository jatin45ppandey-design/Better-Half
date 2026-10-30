import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { rateLimiter } from '../../middleware/rateLimiter.js';
import {
  sendRoomInvitation,
  getReceivedInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation,
} from './invitations.controller.js';
import { sendRoomInvitationSchema } from './invitations.schema.js';

export const invitationRoutes = Router();

// All invitation routes require authentication
invitationRoutes.use(requireAuth);

invitationRoutes.post(
  '/',
  rateLimiter({ windowMs: 60 * 1000, max: 20 }),
  validateRequest({ body: sendRoomInvitationSchema }),
  sendRoomInvitation
);

invitationRoutes.get('/received', getReceivedInvitations);
invitationRoutes.post('/:id/accept', acceptInvitation);
invitationRoutes.post('/:id/decline', declineInvitation);
invitationRoutes.post('/:id/cancel', cancelInvitation);

