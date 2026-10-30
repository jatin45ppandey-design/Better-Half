import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name cannot be empty')
    .max(50, 'Display name must not exceed 50 characters')
    .optional(),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(24, 'Username must not exceed 24 characters')
    .regex(/^[a-zA-Z0-9_.]+$/, 'Username can only contain letters, numbers, underscores, and dots')
    .optional(),
  bio: z
    .string()
    .trim()
    .max(250, 'Bio must not exceed 250 characters')
    .optional(),
  avatarColor: z
    .string()
    .trim()
    .regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Must be a valid hex color code')
    .optional(),
  avatarInitials: z
    .string()
    .trim()
    .max(3)
    .optional(),
}).strict();

export const searchProfileSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1, 'Search query cannot be empty')
    .max(50),
});

