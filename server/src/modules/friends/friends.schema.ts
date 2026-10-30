import { z } from 'zod';

export const sendFriendRequestSchema = z.object({
  receiverId: z.string().uuid().optional(),
  username: z.string().trim().min(3).max(30).optional(),
}).refine((data) => data.receiverId || data.username, {
  message: 'Either receiverId or username must be provided',
});

export const requestIdParamSchema = z.object({
  requestId: z.string().uuid({ message: 'Valid request ID required' }),
});

export const targetUserParamSchema = z.object({
  userId: z.string().uuid({ message: 'Valid user ID required' }),
});

export const friendIdParamSchema = z.object({
  friendId: z.string().uuid({ message: 'Valid friend user ID required' }),
});

