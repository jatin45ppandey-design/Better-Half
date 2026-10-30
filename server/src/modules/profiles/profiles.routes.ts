import { Router } from 'express';
import { requireAuth, requireAuthForProfileBootstrap } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { rateLimiter } from '../../middleware/rateLimiter.js';
import {
  getMyProfile,
  updateMyProfile,
  getProfileByUsername,
  searchProfiles,
} from './profiles.controller.js';
import { updateProfileSchema, searchProfileSchema } from './profiles.schema.js';

export const profileRoutes = Router();

// Authenticated user's profile
profileRoutes.get('/me', requireAuthForProfileBootstrap, getMyProfile);
profileRoutes.patch(
  '/me',
  requireAuth,
  rateLimiter({ windowMs: 60 * 1000, max: 30 }),
  validateRequest({ body: updateProfileSchema }),
  updateMyProfile
);

// Search profiles (requires auth so blocked users are excluded and current user excluded)
profileRoutes.get(
  '/search',
  requireAuth,
  validateRequest({ query: searchProfileSchema }),
  searchProfiles
);

// Public profile by username
profileRoutes.get('/:username', getProfileByUsername);

