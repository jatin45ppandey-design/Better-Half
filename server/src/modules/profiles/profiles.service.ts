import { prisma } from '../../config/prisma.js';
import { NotFoundError, ConflictError } from '../../utils/errors.js';
import type { z } from 'zod';
import type { updateProfileSchema } from './profiles.schema.js';

type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export class ProfilesService {
  /**
   * Safe idempotent get or bootstrap profile for authenticated user
   */
  async getOrCreateProfile(
    userId: string,
    email?: string,
    metadata?: Record<string, any>
  ) {
    const existing = await prisma.userProfile.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    if (existing) {
      return existing;
    }

    // Generate displayName from metadata or email
    const rawName =
      metadata?.full_name ||
      metadata?.name ||
      (email ? email.split('@')[0].replace(/[._-]/g, ' ') : 'PlaySpace Player');

    const displayName = rawName
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
      .slice(0, 50);

    // Generate avatar initials
    const initials =
      displayName
        .split(' ')
        .map((w: string) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'PL';

    // Generate a unique username
    let baseUsername = (
      metadata?.preferred_username ||
      (email ? email.split('@')[0] : 'player')
    )
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .slice(0, 18);

    if (baseUsername.length < 3) {
      baseUsername = `player_${baseUsername}`;
    }

    let finalUsername = baseUsername;
    let counter = 1;

    while (await prisma.userProfile.findUnique({ where: { username: finalUsername } })) {
      const suffix = Math.floor(1000 + Math.random() * 9000);
      finalUsername = `${baseUsername.slice(0, 18)}_${suffix}`;
      counter++;
      if (counter > 10) {
        finalUsername = `user_${Date.now().toString(36)}`;
        break;
      }
    }

    const avatarColor = metadata?.avatar_color || '#9670E8';
    const avatarUrl = metadata?.avatar_url || metadata?.picture || null;

    // Create profile and initial settings in a transaction
    return prisma.$transaction(async (tx) => {
      const createdProfile = await tx.userProfile.create({
        data: {
          id: userId,
          username: finalUsername,
          displayName,
          avatarInitials: initials,
          avatarColor,
          avatarUrl,
          bio: 'Ready for couple showdowns and friendly game nights!',
        },
      });

      const settings = await tx.userSettings.create({
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

      return {
        ...createdProfile,
        settings,
      };
    });
  }

  async getProfileById(userId: string) {
    const profile = await prisma.userProfile.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    return profile;
  }

  async updateProfile(userId: string, data: UpdateProfileInput) {
    // If username is being changed, ensure uniqueness
    if (data.username) {
      const existing = await prisma.userProfile.findUnique({
        where: { username: data.username },
      });

      if (existing && existing.id !== userId) {
        throw new ConflictError('Username is already taken by another user');
      }
    }

    const updated = await prisma.userProfile.update({
      where: { id: userId },
      data: {
        ...(data.displayName ? { displayName: data.displayName } : {}),
        ...(data.username ? { username: data.username } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.avatarColor ? { avatarColor: data.avatarColor } : {}),
        ...(data.avatarInitials ? { avatarInitials: data.avatarInitials } : {}),
      },
      include: { settings: true },
    });

    return updated;
  }

  async getProfileByUsername(username: string) {
    const profile = await prisma.userProfile.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
      },
      include: {
        settings: {
          select: {
            showOnlineStatus: true,
            publicMatchHistory: true,
            allowDirectInvites: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundError(`User with username '${username}' not found`);
    }

    // Redact private information
    return {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarInitials: profile.avatarInitials,
      avatarColor: profile.avatarColor,
      bio: profile.bio,
      createdAt: profile.createdAt,
      settings: profile.settings,
    };
  }

  async searchProfiles(query: string, currentUserId: string) {
    // Find all users blocked by current user or who have blocked current user
    const blocks = await prisma.blockedUser.findMany({
      where: {
        OR: [
          { blockerId: currentUserId },
          { blockedUserId: currentUserId },
        ],
      },
      select: {
        blockerId: true,
        blockedUserId: true,
      },
    });

    const excludedUserIds = new Set<string>([currentUserId]);
    for (const b of blocks) {
      excludedUserIds.add(b.blockerId);
      excludedUserIds.add(b.blockedUserId);
    }

    const profiles = await prisma.userProfile.findMany({
      where: {
        id: { notIn: Array.from(excludedUserIds) },
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        avatarInitials: true,
        avatarColor: true,
        bio: true,
        createdAt: true,
      },
      take: 20,
    });

    return profiles;
  }
}

export const profilesService = new ProfilesService();

