import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { rateLimiter } from '../../middleware/rateLimiter.js';
import {
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  listBlockedUsers,
} from './friends.controller.js';
import {
  sendFriendRequestSchema,
  requestIdParamSchema,
  friendIdParamSchema,
  targetUserParamSchema,
} from './friends.schema.js';

export const friendRoutes = Router();

friendRoutes.use(requireAuth);

// Friends list
friendRoutes.get('/', getFriends);

// Friend requests
friendRoutes.get('/requests', getFriendRequests);
friendRoutes.post(
  '/requests',
  rateLimiter({ windowMs: 60 * 1000, max: 20 }),
  validateRequest({ body: sendFriendRequestSchema }),
  sendFriendRequest
);
friendRoutes.post(
  '/requests/:requestId/accept',
  validateRequest({ params: requestIdParamSchema }),
  acceptFriendRequest
);
friendRoutes.post(
  '/requests/:requestId/reject',
  validateRequest({ params: requestIdParamSchema }),
  rejectFriendRequest
);
friendRoutes.delete(
  '/requests/:requestId',
  validateRequest({ params: requestIdParamSchema }),
  cancelFriendRequest
);

// Delete friend
friendRoutes.delete(
  '/:friendId',
  validateRequest({ params: friendIdParamSchema }),
  removeFriend
);

// Block routes
export const blockRoutes = Router();
blockRoutes.use(requireAuth);

blockRoutes.get('/', listBlockedUsers);
blockRoutes.post(
  '/:userId',
  rateLimiter({ windowMs: 60 * 1000, max: 20 }),
  validateRequest({ params: targetUserParamSchema }),
  blockUser
);
blockRoutes.delete(
  '/:userId',
  validateRequest({ params: targetUserParamSchema }),
  unblockUser
);

