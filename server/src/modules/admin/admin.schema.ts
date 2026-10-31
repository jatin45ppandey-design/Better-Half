import { z } from 'zod';

export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED'], {
    errorMap: () => ({ message: 'Status must be either ACTIVE or SUSPENDED.' }),
  }),
  reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional(),
}).strict();

export const assignRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MODERATOR'], {
    errorMap: () => ({ message: 'Role must be either ADMIN or MODERATOR.' }),
  }),
}).strict();

export const updateGameConfigSchema = z.object({
  isEnabled: z.boolean().optional(),
  coupleEnabled: z.boolean().optional(),
  friendEnabled: z.boolean().optional(),
  maintenanceMessage: z.string().trim().max(300, 'Maintenance message cannot exceed 300 characters').nullable().optional(),
}).strict();

export const createQuestionSchema = z.object({
  gameId: z.string().trim().min(1, 'Game ID is required').max(50),
  prompt: z.string().trim().min(1, 'Prompt is required').max(1000, 'Prompt cannot exceed 1000 characters'),
  questionType: z.enum(['TRUTH', 'DARE']).optional(),
  optionA: z.string().trim().max(500).optional(),
  optionB: z.string().trim().max(500).optional(),
  category: z.string().trim().max(50).optional(),
  intensity: z.number().int().min(1).max(5).optional(),
}).strict();

export const updateQuestionSchema = z.object({
  prompt: z.string().trim().min(1).max(1000).optional(),
  questionType: z.enum(['TRUTH', 'DARE']).optional(),
  optionA: z.string().trim().max(500).optional(),
  optionB: z.string().trim().max(500).optional(),
  category: z.string().trim().max(50).optional(),
  intensity: z.number().int().min(1).max(5).optional(),
  isActive: z.boolean().optional(),
}).strict();

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  role: z.enum(['ADMIN', 'MODERATOR']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});

export const listQuestionsQuerySchema = z.object({
  gameId: z.string().trim().max(50).optional(),
  category: z.string().trim().max(50).optional(),
  intensity: z.coerce.number().int().min(1).max(5).optional(),
  isActive: z.coerce.boolean().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const listAuditLogsQuerySchema = z.object({
  action: z.string().trim().max(50).optional(),
  actorUserId: z.string().uuid().optional(),
  targetType: z.string().trim().max(50).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

