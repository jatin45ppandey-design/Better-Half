import { z } from 'zod';

export const updateSettingsSchema = z.object({
  showOnlineStatus: z.boolean().optional(),
  allowDirectInvites: z.boolean().optional(),
  publicMatchHistory: z.boolean().optional(),
  ghostMode: z.boolean().optional(),
  soundMuted: z.boolean().optional(),
  volume: z.number().min(0).max(1).optional(),
  reducedMotion: z.boolean().optional(),
});

