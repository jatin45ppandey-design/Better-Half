import { z } from 'zod';

export const createRoomSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Room name cannot be empty')
    .max(50, 'Room name must not exceed 50 characters')
    .optional(),
  mode: z.enum(['couple', 'friend'], {
    errorMap: () => ({ message: "Mode must be either 'couple' or 'friend'" }),
  }),
  selectedGameId: z.string().trim().min(2).max(40).optional(),
});

export const joinRoomSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, 'Room code must be at least 4 characters')
    .max(8, 'Room code must not exceed 8 characters')
    .transform((val) => val.toUpperCase()),
});

export const voteGameSchema = z.object({
  gameId: z.string().trim().min(2).max(40),
});

export const selectGameSchema = z.object({
  gameId: z.string().trim().min(2).max(40),
});

export const postMessageSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message cannot exceed 500 characters'),
});

export const roomIdParamSchema = z.object({
  roomId: z.string().trim().min(1, 'Valid room ID or code required'),
});

export const codeParamSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4)
    .max(8)
    .transform((val) => val.toUpperCase()),
});

export const toggleReadySchema = z.object({
  isReady: z.boolean().optional(),
});

export const transferHostSchema = z.object({
  newHostId: z.string().trim().min(1, 'New host ID is required'),
});

export const kickParticipantSchema = z.object({
  targetUserId: z.string().trim().min(1, 'Target user ID is required'),
});

export const transferHostParamSchema = z.object({
  roomId: z.string().trim().min(1),
  newHostId: z.string().trim().min(1),
});

export const kickParamSchema = z.object({
  roomId: z.string().trim().min(1),
  targetUserId: z.string().trim().min(1),
});
