import { prisma } from '../../config/prisma.js';

export class StatsService {
  private async checkPrivacy(targetUserId: string, requestingUserId: string): Promise<void> {
    if (targetUserId === requestingUserId) return;

    const settings = await prisma.userSettings.findUnique({
      where: { userId: targetUserId },
    });
    if (settings && !settings.publicMatchHistory) {
      throw new Error('User statistics are private.');
    }

    const isBlocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: targetUserId, blockedUserId: requestingUserId },
          { blockerId: requestingUserId, blockedUserId: targetUserId },
        ],
      },
    });
    if (isBlocked) {
      throw new Error('User profile is not accessible.');
    }
  }

  async getUserStats(targetUserId: string, requestingUserId: string) {
    await this.checkPrivacy(targetUserId, requestingUserId);

    const gameStats = await prisma.userGameStats.findMany({
      where: { userId: targetUserId },
    });

    let totalMatches = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let totalDraws = 0;
    let totalCoop = 0;
    let mostPlayedGame: string | null = null;
    let maxMatches = -1;

    gameStats.forEach((g) => {
      totalMatches += g.matchesPlayed;
      totalWins += g.wins;
      totalLosses += g.losses;
      totalDraws += g.draws;
      totalCoop += g.cooperativeCompletions;

      if (g.matchesPlayed > maxMatches) {
        maxMatches = g.matchesPlayed;
        mostPlayedGame = g.gameId;
      }
    });

    const competitiveMatches = totalWins + totalLosses + totalDraws;
    const winRate = competitiveMatches > 0 ? Math.round((totalWins / competitiveMatches) * 100) : 0;

    // Calculate current win streak from recent matches
    const recentParticipations = await prisma.matchParticipant.findMany({
      where: {
        userId: targetUserId,
        outcome: { in: ['WIN', 'LOSS', 'DRAW'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    let currentStreak = 0;
    for (const p of recentParticipations) {
      if (p.outcome === 'WIN') {
        currentStreak += 1;
      } else {
        break;
      }
    }

    return {
      userId: targetUserId,
      totalMatches,
      competitiveMatches,
      wins: totalWins,
      losses: totalLosses,
      draws: totalDraws,
      cooperativeCompletions: totalCoop,
      winRate,
      currentStreak,
      mostPlayedGame,
      gameStats,
    };
  }

  async getUserGameStats(targetUserId: string, requestingUserId: string) {
    await this.checkPrivacy(targetUserId, requestingUserId);

    const stats = await prisma.userGameStats.findMany({
      where: { userId: targetUserId },
      orderBy: { matchesPlayed: 'desc' },
    });

    return stats.map((s) => {
      const comp = s.wins + s.losses + s.draws;
      return {
        ...s,
        competitiveMatches: comp,
        winRate: comp > 0 ? Math.round((s.wins / comp) * 100) : 0,
      };
    });
  }

  async getRecentPerformance(targetUserId: string, requestingUserId: string, limit = 10) {
    await this.checkPrivacy(targetUserId, requestingUserId);

    const participations = await prisma.matchParticipant.findMany({
      where: { userId: targetUserId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 30),
      include: {
        match: {
          select: {
            id: true,
            gameId: true,
            mode: true,
            resultType: true,
            durationSeconds: true,
            completedAt: true,
          },
        },
      },
    });

    return participations.map((p) => ({
      matchId: p.matchId,
      gameId: p.match.gameId,
      mode: p.match.mode,
      resultType: p.match.resultType,
      outcome: p.outcome,
      placement: p.placement,
      scoreValue: p.scoreValue,
      scoreLabel: p.scoreLabel,
      isWinner: p.isWinner,
      completedAt: p.match.completedAt,
      durationSeconds: p.match.durationSeconds,
    }));
  }

  async reconcileUserStats(userId: string) {
    // 1. Fetch all completed participations for this user
    const participations = await prisma.matchParticipant.findMany({
      where: { userId },
      include: {
        match: {
          select: {
            gameId: true,
            completedAt: true,
          },
        },
      },
    });

    const aggregates: Record<
      string,
      {
        matchesPlayed: number;
        wins: number;
        losses: number;
        draws: number;
        cooperativeCompletions: number;
        lastPlayedAt: Date | null;
      }
    > = {};

    participations.forEach((p) => {
      const gId = p.match.gameId;
      if (!aggregates[gId]) {
        aggregates[gId] = {
          matchesPlayed: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          cooperativeCompletions: 0,
          lastPlayedAt: null,
        };
      }

      aggregates[gId].matchesPlayed += 1;
      if (p.outcome === 'WIN') aggregates[gId].wins += 1;
      else if (p.outcome === 'LOSS') aggregates[gId].losses += 1;
      else if (p.outcome === 'DRAW') aggregates[gId].draws += 1;
      else if (p.outcome === 'COMPLETED') aggregates[gId].cooperativeCompletions += 1;

      if (!aggregates[gId].lastPlayedAt || p.match.completedAt > aggregates[gId].lastPlayedAt!) {
        aggregates[gId].lastPlayedAt = p.match.completedAt;
      }
    });

    // 2. Atomically upsert recomputed records
    for (const [gameId, data] of Object.entries(aggregates)) {
      await prisma.userGameStats.upsert({
        where: {
          userId_gameId: { userId, gameId },
        },
        update: {
          matchesPlayed: data.matchesPlayed,
          wins: data.wins,
          losses: data.losses,
          draws: data.draws,
          cooperativeCompletions: data.cooperativeCompletions,
          lastPlayedAt: data.lastPlayedAt,
        },
        create: {
          userId,
          gameId,
          matchesPlayed: data.matchesPlayed,
          wins: data.wins,
          losses: data.losses,
          draws: data.draws,
          cooperativeCompletions: data.cooperativeCompletions,
          lastPlayedAt: data.lastPlayedAt,
        },
      });
    }

    return { reconciledGames: Object.keys(aggregates).length };
  }
}

export const statsService = new StatsService();

