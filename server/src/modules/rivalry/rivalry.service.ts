import { prisma } from '../../config/prisma.js';

export class RivalryService {
  private async assertCanViewRivalry(currentUserId: string, rivalUserId: string): Promise<void> {
    if (currentUserId === rivalUserId) {
      throw new Error('Cannot view rivalry with oneself.');
    }

    const [settings, block] = await Promise.all([
      prisma.userSettings.findUnique({
        where: { userId: rivalUserId },
        select: { publicMatchHistory: true },
      }),
      prisma.blockedUser.findFirst({
        where: {
          OR: [
            { blockerId: currentUserId, blockedUserId: rivalUserId },
            { blockerId: rivalUserId, blockedUserId: currentUserId },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (settings && !settings.publicMatchHistory) {
      throw new Error('User statistics are private.');
    }
    if (block) {
      throw new Error('User profile is not accessible.');
    }
  }

  async getRivalries(currentUserId: string) {
    const records = await prisma.rivalryStats.findMany({
      where: {
        OR: [{ userLowId: currentUserId }, { userHighId: currentUserId }],
      },
      include: {
        userLow: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            avatarColor: true,
            avatarInitials: true,
          },
        },
        userHigh: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            avatarColor: true,
            avatarInitials: true,
          },
        },
      },
      orderBy: [{ matchesPlayed: 'desc' }, { lastMatchAt: 'desc' }],
    });

    const rivalUserIds = [...new Set(records.map((record) =>
      record.userLowId === currentUserId ? record.userHighId : record.userLowId
    ))];

    if (rivalUserIds.length === 0) return [];

    const [settings, blocks] = await Promise.all([
      prisma.userSettings.findMany({
        where: { userId: { in: rivalUserIds } },
        select: { userId: true, publicMatchHistory: true },
      }),
      prisma.blockedUser.findMany({
        where: {
          OR: [
            { blockerId: currentUserId, blockedUserId: { in: rivalUserIds } },
            { blockerId: { in: rivalUserIds }, blockedUserId: currentUserId },
          ],
        },
        select: { blockerId: true, blockedUserId: true },
      }),
    ]);

    const privateUserIds = new Set(
      settings.filter((setting) => !setting.publicMatchHistory).map((setting) => setting.userId)
    );
    const blockedUserIds = new Set(
      blocks.map((block) => block.blockerId === currentUserId ? block.blockedUserId : block.blockerId)
    );

    return records.filter((record) => {
      const rivalUserId = record.userLowId === currentUserId ? record.userHighId : record.userLowId;
      return !privateUserIds.has(rivalUserId) && !blockedUserIds.has(rivalUserId);
    }).map((r) => {
      const isLow = r.userLowId === currentUserId;
      const rival = isLow ? r.userHigh : r.userLow;
      const userWins = isLow ? r.userLowWins : r.userHighWins;
      const rivalWins = isLow ? r.userHighWins : r.userLowWins;

      return {
        id: r.id,
        rival,
        matchesPlayed: r.matchesPlayed,
        competitiveMatches: r.competitiveMatches,
        userWins,
        rivalWins,
        draws: r.draws,
        cooperativeCompletions: r.cooperativeCompletions,
        currentStreakHolder: r.currentStreakHolder,
        currentStreakCount: r.currentStreakCount,
        lastMatchAt: r.lastMatchAt,
      };
    });
  }

  async getRivalryWithUser(currentUserId: string, rivalUserId: string) {
    await this.assertCanViewRivalry(currentUserId, rivalUserId);

    const userLowId = currentUserId < rivalUserId ? currentUserId : rivalUserId;
    const userHighId = currentUserId < rivalUserId ? rivalUserId : currentUserId;

    const [rivalry, rivalProfile] = await Promise.all([
      prisma.rivalryStats.findUnique({
        where: {
          userLowId_userHighId: { userLowId, userHighId },
        },
      }),
      prisma.userProfile.findUnique({
        where: { id: rivalUserId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          avatarColor: true,
          avatarInitials: true,
          bio: true,
        },
      }),
    ]);

    if (!rivalProfile) {
      throw new Error('Rival user not found.');
    }

    const isLow = userLowId === currentUserId;
    const matchesPlayed = rivalry?.matchesPlayed || 0;
    const competitiveMatches = rivalry?.competitiveMatches || 0;
    const userWins = rivalry ? (isLow ? rivalry.userLowWins : rivalry.userHighWins) : 0;
    const rivalWins = rivalry ? (isLow ? rivalry.userHighWins : rivalry.userLowWins) : 0;
    const draws = rivalry?.draws || 0;
    const cooperativeCompletions = rivalry?.cooperativeCompletions || 0;

    const userWinPct = competitiveMatches > 0 ? Math.round((userWins / competitiveMatches) * 100) : 0;
    const rivalWinPct = competitiveMatches > 0 ? Math.round((rivalWins / competitiveMatches) * 100) : 0;
    const drawPct = competitiveMatches > 0 ? Math.round((draws / competitiveMatches) * 100) : 0;

    // Find favorite games played together
    const sharedMatches = await prisma.match.findMany({
      where: {
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: rivalUserId } } },
        ],
      },
      select: { gameId: true },
    });

    const gameCounts: Record<string, number> = {};
    sharedMatches.forEach((m) => {
      gameCounts[m.gameId] = (gameCounts[m.gameId] || 0) + 1;
    });

    const favoriteGames = Object.entries(gameCounts)
      .map(([gameId, count]) => ({ gameId, count }))
      .sort((a, b) => b.count - a.count);

    return {
      rival: rivalProfile,
      matchesPlayed,
      competitiveMatches,
      userWins,
      rivalWins,
      draws,
      cooperativeCompletions,
      userWinPct,
      rivalWinPct,
      drawPct,
      currentStreakHolder: rivalry?.currentStreakHolder || null,
      currentStreakCount: rivalry?.currentStreakCount || 0,
      lastMatchAt: rivalry?.lastMatchAt || null,
      favoriteGames,
    };
  }

  async getRivalryHistory(currentUserId: string, rivalUserId: string, limit = 10) {
    await this.assertCanViewRivalry(currentUserId, rivalUserId);

    const matches = await prisma.match.findMany({
      where: {
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: rivalUserId } } },
        ],
      },
      orderBy: { completedAt: 'desc' },
      take: Math.min(limit, 30),
      include: {
        participants: {
          where: {
            userId: { in: [currentUserId, rivalUserId] },
          },
          select: {
            userId: true,
            playerNameSnapshot: true,
            scoreValue: true,
            scoreLabel: true,
            placement: true,
            outcome: true,
            isWinner: true,
          },
        },
      },
    });

    return matches.map((m) => {
      const userPart = m.participants.find((p) => p.userId === currentUserId);
      const rivalPart = m.participants.find((p) => p.userId === rivalUserId);

      return {
        matchId: m.id,
        gameId: m.gameId,
        mode: m.mode,
        resultType: m.resultType,
        completedAt: m.completedAt,
        durationSeconds: m.durationSeconds,
        userResult: userPart,
        rivalResult: rivalPart,
      };
    });
  }
}

export const rivalryService = new RivalryService();

