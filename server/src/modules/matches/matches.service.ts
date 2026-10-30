import { prisma } from '../../config/prisma.js';

export interface MatchHistoryOptions {
  gameId?: string;
  mode?: string;
  cursor?: string;
  limit?: number;
}

export class MatchesService {
  async getMatchHistory(userId: string, requestingUserId: string, options: MatchHistoryOptions = {}) {
    const limit = Math.min(Math.max(options.limit || 20, 1), 50);

    // Privacy check if requesting another user's history
    if (userId !== requestingUserId) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });
      if (settings && !settings.publicMatchHistory) {
        throw new Error('User match history is private.');
      }

      // Check block relationship
      const isBlocked = await prisma.blockedUser.findFirst({
        where: {
          OR: [
            { blockerId: userId, blockedUserId: requestingUserId },
            { blockerId: requestingUserId, blockedUserId: userId },
          ],
        },
      });
      if (isBlocked) {
        throw new Error('User profile is not accessible.');
      }
    }

    const whereClause: any = {
      userId,
      match: {
        ...(options.gameId ? { gameId: options.gameId } : {}),
        ...(options.mode ? { mode: options.mode.toUpperCase() } : {}),
      },
    };

    const participations = await prisma.matchParticipant.findMany({
      where: whereClause,
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        match: {
          include: {
            participants: {
              select: {
                id: true,
                userId: true,
                playerNameSnapshot: true,
                usernameSnapshot: true,
                avatarUrlSnapshot: true,
                scoreValue: true,
                scoreLabel: true,
                placement: true,
                outcome: true,
                isWinner: true,
              },
            },
          },
        },
      },
    });

    const hasMore = participations.length > limit;
    const items = hasMore ? participations.slice(0, limit) : participations;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      matches: items.map((p) => {
        const m = p.match;
        return {
          id: m.id,
          gameSessionId: m.gameSessionId,
          gameId: m.gameId,
          mode: m.mode,
          resultType: m.resultType,
          winnerUserId: m.winnerUserId,
          startedAt: m.startedAt,
          completedAt: m.completedAt,
          durationSeconds: m.durationSeconds,
          roundsPlayed: m.roundsPlayed,
          userOutcome: p.outcome,
          userPlacement: p.placement,
          userScore: p.scoreValue,
          userScoreLabel: p.scoreLabel,
          isWinner: p.isWinner,
          participants: m.participants,
          resultSummary: m.resultSummary,
        };
      }),
      nextCursor,
      hasMore,
    };
  }

  async getMatchById(matchId: string, requestingUserId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        participants: {
          select: {
            id: true,
            userId: true,
            playerNameSnapshot: true,
            usernameSnapshot: true,
            avatarUrlSnapshot: true,
            scoreValue: true,
            scoreLabel: true,
            placement: true,
            outcome: true,
            isWinner: true,
          },
        },
      },
    });

    if (!match) {
      throw new Error('Match not found.');
    }

    const isParticipant = match.participants.some((p) => p.userId === requestingUserId);

    // If requester is not participant, verify if participants have public history
    if (!isParticipant) {
      const participantUserIds = match.participants.map((p) => p.userId);
      const [privateSettings, block] = await Promise.all([
        prisma.userSettings.findFirst({
          where: {
            userId: { in: participantUserIds },
            publicMatchHistory: false,
          },
          select: { userId: true },
        }),
        prisma.blockedUser.findFirst({
          where: {
            OR: [
              { blockerId: requestingUserId, blockedUserId: { in: participantUserIds } },
              { blockerId: { in: participantUserIds }, blockedUserId: requestingUserId },
            ],
          },
          select: { id: true },
        }),
      ]);

      if (privateSettings || block) {
        throw new Error('You do not have permission to view this match.');
      }
    }

    return match;
  }
}

export const matchesService = new MatchesService();

