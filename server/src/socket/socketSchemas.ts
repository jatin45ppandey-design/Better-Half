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

const gameActionPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('CHOOSE_TYPE'),
    promptType: z.enum(['truth', 'dare']),
    category: z.enum(['Romantic', 'Funny', 'Personal', 'Challenging']).optional(),
    intensity: z.enum(['Soft', 'Spicy', 'Wild']).optional(),
  }).strict(),
  z.object({ type: z.literal('SKIP') }).strict(),
  z.object({ type: z.literal('COMPLETE') }).strict(),
  z.object({
    type: z.literal('SUBMIT_CHOICE'),
    choice: z.enum(['A', 'B']),
  }).strict(),
  z.object({ type: z.literal('NEXT_QUESTION') }).strict(),
  z.object({
    type: z.literal('PLACE_ITEM'),
    slotIndex: z.number().int().min(0).max(4),
  }).strict(),
  z.object({ type: z.literal('NEXT_CATEGORY') }).strict(),
  z.object({
    type: z.literal('PLAY_CARD'),
    cardId: z.string().trim().min(1).max(100),
    chosenColor: z.enum(['purple', 'lavender', 'amber', 'emerald']).optional(),
  }).strict(),
  z.object({ type: z.literal('DRAW_CARD') }).strict(),
  z.object({ type: z.literal('PASS_TURN') }).strict(),
  z.object({
    type: z.literal('MAKE_MOVE'),
    cellIndex: z.number().int().min(0).max(8),
  }).strict(),
  z.object({ type: z.literal('START_NEXT_ROUND') }).strict(),
  z.object({
    type: z.literal('SET_SERIES_FORMAT'),
    format: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  }).strict(),
  z.object({
    type: z.literal('FLICK_PEN'),
    dx: z.number().finite().min(-640).max(640),
    dy: z.number().finite().min(-440).max(440),
    power: z.number().finite().min(5).max(100),
  }).strict(),
  z.object({
    type: z.literal('CLAIM_CELL'),
    row: z.number().int().min(0).max(5),
    col: z.number().int().min(0).max(5),
  }).strict(),
  z.object({
    type: z.literal('SHOOT'),
    angle: z.number().finite().min(30).max(85),
    power: z.number().finite().min(20).max(100),
  }).strict(),
  z.object({
    type: z.literal('SPAWN_DROP'),
    forcedType: z.enum(['GOLDEN', 'SPICY', 'SOGGY_TRAP', 'REGULAR']).optional(),
  }).strict(),
  z.object({
    type: z.literal('SNATCH'),
    dropId: z.string().trim().min(1).max(100),
  }).strict(),
  z.object({
    type: z.literal('STROKE'),
    angle: z.number().finite().min(0).max(360),
    power: z.number().finite().min(2).max(100),
  }).strict(),
  z.object({
    type: z.literal('SUBMIT_ANSWER'),
    answer: z.string().trim().min(1).max(1000),
  }).strict(),
  z.object({ type: z.literal('GRANT_ADULT_CONSENT') }).strict(),
  z.object({
    type: z.literal('SET_SETTINGS'),
    category: z.string().trim().min(1).max(50).optional(),
    intensity: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  }).strict(),
]);

export const gameActionSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(100),
    actionId: z.string().trim().min(1).max(100),
    version: z.number().int().min(1).optional(),
    expectedVersion: z.number().int().min(1).optional(),
    action: gameActionPayloadSchema,
  })
  .strict()
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
