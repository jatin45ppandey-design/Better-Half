import { prisma } from '../../../config/prisma.js';
import type { GameEngineContext } from '../core/gameEngine.types.js';
import { evaluateGameResult } from './resultPolicies.js';
import { logger } from '../../../utils/logger.js';

export interface FinalizedMatchData {
  matchId: string;
  gameSessionId: string;
  gameId: string;
  mode: string;
  resultType: string;
  winnerUserId: string | null;
  durationSeconds: number;
  participants: Array<{
    userId: string;
    playerName: string;
    scoreValue: number | null;
    scoreLabel: string | null;
    placement: number | null;
    outcome: string;
    isWinner: boolean;
  }>;
}

export class MatchFinalizationService {
  async finalizeMatch(context: GameEngineContext): Promise<FinalizedMatchData | null> {
    const { sessionId, gameId, mode, participants } = context;

    // 1. Idempotency check: verify if match is already created for this session
    try {
      const existingMatch = await prisma.match.findUnique({
        where: { gameSessionId: sessionId },
        include: { participants: true },
      });

      if (existingMatch) {
        return {
          matchId: existingMatch.id,
          gameSessionId: existingMatch.gameSessionId,
          gameId: existingMatch.gameId,
          mode: existingMatch.mode,
          resultType: existingMatch.resultType,
          winnerUserId: existingMatch.winnerUserId,
          durationSeconds: existingMatch.durationSeconds,
          participants: existingMatch.participants.map((p) => ({
            userId: p.userId,
            playerName: p.playerNameSnapshot,
            scoreValue: p.scoreValue,
            scoreLabel: p.scoreLabel,
            placement: p.placement,
            outcome: p.outcome,
            isWinner: p.isWinner,
          })),
        };
      }
    } catch {
      // In dev or test mock environment, proceed
    }

    // 2. Authoritatively evaluate match results via result policy
    const evaluation = evaluateGameResult(context);

    // 3. Compute duration
    const startedAt = context.startedAt ? new Date(context.startedAt) : new Date(Date.now() - 60000);
    const completedAt = new Date();
    const durationSeconds = Math.max(1, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000));

    // 4. Fetch user profile snapshots for participants
    const userProfilesMap: Record<
      string,
      { displayName: string; username: string; avatarUrl: string | null }
    > = {};

    try {
      const userIds = participants.map((p) => p.userId);
      const profiles = await prisma.userProfile.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, username: true, avatarUrl: true },
      });

      profiles.forEach((pr) => {
        userProfilesMap[pr.id] = {
          displayName: pr.displayName,
          username: pr.username,
          avatarUrl: pr.avatarUrl,
        };
      });
    } catch {
      // Fallback to participant runtime names
    }

    // 5. Execute transactional creation and statistics updates
    let matchId = `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      await prisma.$transaction(async (tx) => {
        // Double-check inside transaction for race conditions
        const matchExists = await tx.match.findUnique({
          where: { gameSessionId: sessionId },
        });
        if (matchExists) {
          matchId = matchExists.id;
          return;
        }

        // A. Create Match record
        const createdMatch = await tx.match.create({
          data: {
            id: matchId,
            gameSessionId: sessionId,
            roomId: context.roomId || 'direct-room',
            gameId,
            mode: mode.toUpperCase(),
            resultType: evaluation.resultType,
            winnerUserId: evaluation.winnerUserId,
            startedAt,
            completedAt,
            durationSeconds,
            roundsPlayed: evaluation.roundsPlayed,
            resultSummary: evaluation.resultSummary as any,
          },
        });
        matchId = createdMatch.id;

        // B. Create MatchParticipants
        for (const pResult of evaluation.participants) {
          const profile = userProfilesMap[pResult.userId] || {
            displayName: participants.find((p) => p.userId === pResult.userId)?.name || 'Player',
            username: `player_${pResult.userId.substring(0, 6)}`,
            avatarUrl: null,
          };

          await tx.matchParticipant.create({
            data: {
              matchId,
              userId: pResult.userId,
              playerNameSnapshot: profile.displayName,
              usernameSnapshot: profile.username,
              avatarUrlSnapshot: profile.avatarUrl,
              scoreValue: pResult.scoreValue,
              scoreLabel: pResult.scoreLabel,
              placement: pResult.placement,
              outcome: pResult.outcome,
              isWinner: pResult.isWinner,
              createdAt: completedAt,
            },
          });

          // C. Atomically upsert UserGameStats
          const isWin = pResult.outcome === 'WIN';
          const isLoss = pResult.outcome === 'LOSS';
          const isDraw = pResult.outcome === 'DRAW';
          const isCoop = pResult.outcome === 'COMPLETED';

          await tx.userGameStats.upsert({
            where: {
              userId_gameId: {
                userId: pResult.userId,
                gameId,
              },
            },
            update: {
              matchesPlayed: { increment: 1 },
              wins: { increment: isWin ? 1 : 0 },
              losses: { increment: isLoss ? 1 : 0 },
              draws: { increment: isDraw ? 1 : 0 },
              cooperativeCompletions: { increment: isCoop ? 1 : 0 },
              lastPlayedAt: completedAt,
            },
            create: {
              userId: pResult.userId,
              gameId,
              matchesPlayed: 1,
              wins: isWin ? 1 : 0,
              losses: isLoss ? 1 : 0,
              draws: isDraw ? 1 : 0,
              cooperativeCompletions: isCoop ? 1 : 0,
              lastPlayedAt: completedAt,
            },
          });
        }

        // D. Atomically update RivalryStats for all distinct pairs
        const pCount = evaluation.participants.length;
        for (let i = 0; i < pCount; i++) {
          for (let j = i + 1; j < pCount; j++) {
            const pA = evaluation.participants[i];
            const pB = evaluation.participants[j];

            const userLowId = pA.userId < pB.userId ? pA.userId : pB.userId;
            const userHighId = pA.userId < pB.userId ? pB.userId : pA.userId;

            const isCoop = evaluation.resultType === 'COOPERATIVE';
            const isComp = evaluation.resultType === 'COMPETITIVE';

            let lowWon = false;
            let highWon = false;
            let pairDraw = false;

            if (isComp) {
              const resLow = pA.userId === userLowId ? pA : pB;
              const resHigh = pA.userId === userHighId ? pA : pB;

              if (resLow.placement < resHigh.placement) {
                lowWon = true;
              } else if (resHigh.placement < resLow.placement) {
                highWon = true;
              } else {
                pairDraw = true;
              }
            } else if (evaluation.resultType === 'DRAW') {
              pairDraw = true;
            }

            // Fetch existing rivalry pair to calculate streak
            const existingRivalry = await tx.rivalryStats.findUnique({
              where: {
                userLowId_userHighId: {
                  userLowId,
                  userHighId,
                },
              },
            });

            let newStreakHolder: string | null = existingRivalry?.currentStreakHolder || null;
            let newStreakCount = existingRivalry?.currentStreakCount || 0;

            if (lowWon) {
              if (newStreakHolder === userLowId) {
                newStreakCount += 1;
              } else {
                newStreakHolder = userLowId;
                newStreakCount = 1;
              }
            } else if (highWon) {
              if (newStreakHolder === userHighId) {
                newStreakCount += 1;
              } else {
                newStreakHolder = userHighId;
                newStreakCount = 1;
              }
            } else if (pairDraw) {
              newStreakCount = 0;
              newStreakHolder = null;
            }

            await tx.rivalryStats.upsert({
              where: {
                userLowId_userHighId: {
                  userLowId,
                  userHighId,
                },
              },
              update: {
                matchesPlayed: { increment: 1 },
                competitiveMatches: { increment: isComp ? 1 : 0 },
                userLowWins: { increment: lowWon ? 1 : 0 },
                userHighWins: { increment: highWon ? 1 : 0 },
                draws: { increment: pairDraw ? 1 : 0 },
                cooperativeCompletions: { increment: isCoop ? 1 : 0 },
                currentStreakHolder: newStreakHolder,
                currentStreakCount: newStreakCount,
                lastMatchAt: completedAt,
              },
              create: {
                userLowId,
                userHighId,
                matchesPlayed: 1,
                competitiveMatches: isComp ? 1 : 0,
                userLowWins: lowWon ? 1 : 0,
                userHighWins: highWon ? 1 : 0,
                draws: pairDraw ? 1 : 0,
                cooperativeCompletions: isCoop ? 1 : 0,
                currentStreakHolder: newStreakHolder,
                currentStreakCount: newStreakCount,
                lastMatchAt: completedAt,
              },
            });
          }
        }
      });
    } catch (err: any) {
      logger.warn(`Match finalization DB skipped/failed: ${err?.message || err}`);
    }

    return {
      matchId,
      gameSessionId: sessionId,
      gameId,
      mode,
      resultType: evaluation.resultType,
      winnerUserId: evaluation.winnerUserId,
      durationSeconds,
      participants: evaluation.participants.map((p) => {
        const profile = userProfilesMap[p.userId] || {
          displayName: participants.find((part) => part.userId === p.userId)?.name || 'Player',
        };
        return {
          userId: p.userId,
          playerName: profile.displayName,
          scoreValue: p.scoreValue,
          scoreLabel: p.scoreLabel,
          placement: p.placement,
          outcome: p.outcome,
          isWinner: p.isWinner,
        };
      }),
    };
  }
}

export const matchFinalizationService = new MatchFinalizationService();

