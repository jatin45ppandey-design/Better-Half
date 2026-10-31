import { z } from 'zod';

export const roomJoinSchema = z
  .object({
    roomId: z.string().trim().optional(),
    code: z.string().trim().min(3).max(12).optional(),
  })
  .refine((data) => Boolean(data.roomId || data.code), {
    message: 'Either roomId or code is required',
  });

export const roomLeaveSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required'),
});

export const roomReadyUpdateSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required'),
  isReady: z.boolean().optional(),
});

export const roomGameVoteSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required'),
  gameId: z.string().trim().min(1).max(50),
});

export const roomGameSelectSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required'),
  gameId: z.string().trim().min(1).max(50),
});

export const roomStartPrepareSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required'),
});

export const roomHostTransferSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required'),
  newHostId: z.string().trim().min(1, 'newHostId is required'),
});

export const roomPlayerKickSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required'),
  targetUserId: z.string().trim().min(1, 'targetUserId is required'),
});

export const roomChatSendSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required'),
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(500, 'Message cannot exceed 500 characters'),
});

export const roomReactionSendSchema = z.object({
  roomId: z.string().trim().min(1, 'roomId is required'),
  reaction: z.string().trim().min(1).max(10, 'Reaction cannot exceed 10 characters'),
});

export const gameSessionJoinSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId is required'),
});

export const gameActionSchema = z
  .object({
    sessionId: z.string().trim().min(1, 'sessionId is required'),
    actionId: z.string().trim().min(1, 'actionId is required'),
    version: z.number().int().min(1).optional(),
    expectedVersion: z.number().int().min(1).optional(),
    action: z
      .object({
        type: z.string().trim().min(1, 'action type is required'),
      })
      .passthrough(),
  })
  .refine((data) => data.version !== undefined || data.expectedVersion !== undefined, {
    message: 'Either version or expectedVersion is required',
  })
  .transform((data) => ({
    ...data,
    version: ((data.expectedVersion ?? data.version) as number),
    expectedVersion: ((data.expectedVersion ?? data.version) as number),
  }));

export const gamePauseSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId is required'),
});

export const gameResumeSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId is required'),
});

export const gameRematchSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId is required'),
});

export const gameSessionLeaveSchema = z.object({
  sessionId: z.string().trim().min(1, 'sessionId is required'),
});

/**
 * Validates a socket event payload against a Zod schema.
 * Returns parsed data if valid, or invokes the error callback and returns null.
 */
export function validateSocketPayload<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  callback?: (response: { success: false; error: string }) => void
): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errorMsg = result.error.errors.map((e) => e.message).join(', ');
    callback?.({ success: false, error: `Invalid payload: ${errorMsg}` });
    return null;
  }
  return result.data;
}
