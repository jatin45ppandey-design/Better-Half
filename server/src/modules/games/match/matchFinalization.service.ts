import { prisma } from '../../../config/prisma.js';
import type { GameEngineContext } from '../core/gameEngine.types.js';
import { evaluateGameResult } from './resultPolicies.js';
import { logger } from '../../../utils/logger.js';

export interface FinalizeMatchResponse {
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
    scoreValue: number;
    scoreLabel: string;
    placement: number;
    outcome: string;
    isWinner: boolean;
  }>;
}

export class MatchFinalizationService {
  /**
   * Finalizes a completed game session into immutable Match and MatchParticipant records,
   * updates player statistics and pairwise rivalries.
   * Can be executed within an existing Prisma transaction client.
   * NEVER returns a fabricated match ID on error.
   */
  async finalizeMatch(
    context: GameEngineContext,
    externalTx?: any
  ): Promise<FinalizeMatchResponse> {
    const { sessionId, gameId, mode, participants } = context;

    const executeFinalization = async (tx: any): Promise<FinalizeMatchResponse> => {
      // 1. Check idempotency: if match already created for this session, return existing record
      const matchExists = await tx.match.findUnique({
        where: { gameSessionId: sessionId },
        include: { participants: true },
      });

      if (matchExists) {
        logger.info(`Match for session ${sessionId} already finalized (${matchExists.id}). Returning existing record.`);
        return {
          matchId: matchExists.id,
          gameSessionId: sessionId,
          gameId: matchExists.gameId,
          mode: matchExists.mode.toLowerCase(),
          resultType: matchExists.resultType,
          winnerUserId: matchExists.winnerUserId,
          durationSeconds: matchExists.durationSeconds,
          participants: matchExists.participants.map((p: any) => ({
            userId: p.userId,
            playerName: p.playerNameSnapshot,
            scoreValue: p.scoreValue || 0,
            scoreLabel: p.scoreLabel || '',
            placement: p.placement || 1,
            outcome: p.outcome,
            isWinner: p.isWinner,
          })),
        };
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

      const userIds = participants.map((p) => p.userId);
      const profiles = await tx.userProfile.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, username: true, avatarUrl: true },
      });

      profiles.forEach((pr: any) => {
        userProfilesMap[pr.id] = {
          displayName: pr.displayName,
          username: pr.username,
          avatarUrl: pr.avatarUrl,
        };
      });

      // 5. Create Match record
      const matchId = `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

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

      // Update room status to COMPLETED if associated with an active room
      if (
        context.roomId &&
        context.roomId !== 'direct-room' &&
        tx &&
        tx.room &&
        typeof tx.room.updateMany === 'function'
      ) {
        await tx.room.updateMany({
          where: { id: context.roomId, status: 'IN_PROGRESS' },
          data: { status: 'COMPLETED' },
        });
      }

      // 6. Create MatchParticipants
      for (const pResult of evaluation.participants) {
        const profile = userProfilesMap[pResult.userId] || {
          displayName: participants.find((p) => p.userId === pResult.userId)?.name || 'Player',
          username: `player_${pResult.userId.substring(0, 6)}`,
          avatarUrl: null,
        };

        await tx.matchParticipant.create({
          data: {
            matchId: createdMatch.id,
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

        // 7. Atomically upsert UserGameStats
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

      // 8. Atomically update RivalryStats for all distinct pairs
      const pCount = evaluation.participants.length;
      for (let i = 0; i < pCount; i++) {
        for (let j = i + 1; j < pCount; j++) {
          const pA = evaluation.participants[i];
          const pB = evaluation.participants[j];

          const userLowId = pA.userId < pB.userId ? pA.userId : pB.userId;
          const userHighId = pA.userId < pB.userId ? pB.userId : pA.userId;

          const isCoop = evaluation.resultType === 'COOPERATIVE';
          const isComp = evaluation.resultType === 'COMPETITIVE' || evaluation.resultType === 'DRAW';

          let lowWon = false;
          let highWon = false;
          let pairDraw = false;

          // Derive pairwise outcome strictly from individual placements in competitive/draw games
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
          } else if (pairDraw && isComp) {
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

      return {
        matchId: createdMatch.id,
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
    };

    if (externalTx) {
      return executeFinalization(externalTx);
    }

    return prisma.$transaction(async (tx) => {
      return executeFinalization(tx);
    });
  }
}

export const matchFinalizationService = new MatchFinalizationService();
