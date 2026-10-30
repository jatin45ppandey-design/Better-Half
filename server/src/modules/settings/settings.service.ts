import { prisma } from '../../config/prisma.js';
import { presenceManager } from '../../socket/presence.js';
import type { z } from 'zod';
import type { updateSettingsSchema } from './settings.schema.js';

type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

export class SettingsService {
  async getSettings(userId: string) {
    let settings = await prisma.userSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await prisma.userSettings.create({
        data: {
          userId,
          showOnlineStatus: true,
          allowDirectInvites: true,
          publicMatchHistory: true,
          ghostMode: false,
          soundMuted: false,
          volume: 0.8,
          reducedMotion: false,
        },
      });
    }

    return settings;
  }

  async updateSettings(userId: string, data: UpdateSettingsInput) {
    const updated = await prisma.userSettings.upsert({
      where: { userId },
      update: data,
      create: {
        userId,
        showOnlineStatus: data.showOnlineStatus ?? true,
        allowDirectInvites: data.allowDirectInvites ?? true,
        publicMatchHistory: data.publicMatchHistory ?? true,
        ghostMode: data.ghostMode ?? false,
        soundMuted: data.soundMuted ?? false,
        volume: data.volume ?? 0.8,
        reducedMotion: data.reducedMotion ?? false,
      },
    });

    presenceManager.setUserPrivacy(userId, {
      showOnlineStatus: updated.showOnlineStatus,
      ghostMode: updated.ghostMode,
    });

    return updated;
  }
}

export const settingsService = new SettingsService();

