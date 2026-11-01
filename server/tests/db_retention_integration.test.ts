import crypto from 'node:crypto';
import pg from 'pg';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { runRetention } from '../src/scripts/dbRetention.js';

const RETENTION_LOCK_ID = 847291048;
const runIntegration =
  process.env.RUN_DATABASE_RETENTION_INTEGRATION === 'true' ? it : it.skip;

describe('isolated PostgreSQL retention integration', () => {
  runIntegration('keeps dry-run non-destructive, respects lock contention, and preserves match history', async () => {
    const directUrl = process.env.DIRECT_URL;
    if (!directUrl) {
      throw new Error('DIRECT_URL is required for the disposable retention integration test.');
    }

    const parsedUrl = new URL(directUrl);
    const localHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
    if (!localHosts.has(parsedUrl.hostname)) {
      throw new Error('Retention integration is restricted to a local disposable PostgreSQL database.');
    }

    const marker = crypto.randomUUID();
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const userAId = marker + '-user-a';
    const userBId = marker + '-user-b';
    const usernamePrefix = 'retention-' + marker.replace(/-/g, '').slice(0, 12);
    const roomIds: string[] = [];
    const userIds = [userAId, userBId];
    let lockClient: pg.Client | undefined;
    let lockHeld = false;

    try {
      const userA = await prisma.userProfile.create({
        data: {
          id: userAId,
          username: usernamePrefix + '-a',
          displayName: 'Retention Test A',
        },
      });
      const userB = await prisma.userProfile.create({
        data: {
          id: userBId,
          username: usernamePrefix + '-b',
          displayName: 'Retention Test B',
        },
      });

      const ephemeralRoom = await prisma.room.create({
        data: {
          code: marker.replace(/-/g, '').slice(0, 6).toUpperCase(),
          hostId: userA.id,
          name: 'Retention disposable room',
          mode: 'COUPLE',
          status: 'CLOSED',
          maxPlayers: 2,
          createdAt: oldDate,
          updatedAt: oldDate,
          expiresAt: oldDate,
        },
      });
      roomIds.push(ephemeralRoom.id);

      const protectedRoom = await prisma.room.create({
        data: {
          code: marker.replace(/-/g, '').slice(6, 12).toUpperCase(),
          hostId: userA.id,
          name: 'Retention protected history room',
          mode: 'COUPLE',
          status: 'CLOSED',
          maxPlayers: 2,
          createdAt: oldDate,
          updatedAt: oldDate,
          expiresAt: oldDate,
        },
      });
      roomIds.push(protectedRoom.id);

      const ephemeralSession = await prisma.gameSession.create({
        data: {
          roomId: ephemeralRoom.id,
          gameId: 'tic-tac-toe',
          mode: 'COUPLE',
          status: 'COMPLETED',
          startedAt: oldDate,
          completedAt: oldDate,
          updatedAt: oldDate,
          publicState: { fixture: marker },
        },
      });

      const protectedSession = await prisma.gameSession.create({
        data: {
          roomId: protectedRoom.id,
          gameId: 'tic-tac-toe',
          mode: 'COUPLE',
          status: 'COMPLETED',
          startedAt: oldDate,
          completedAt: oldDate,
          updatedAt: oldDate,
          publicState: { fixture: marker },
        },
      });

      const ephemeralAction = await prisma.gameAction.create({
        data: {
          sessionId: ephemeralSession.id,
          actorUserId: userA.id,
          actionId: marker + '-action',
          sequenceNumber: 1,
          actionType: 'RETENTION_TEST',
          createdAt: oldDate,
        },
      });

      const ephemeralInvitation = await prisma.roomInvitation.create({
        data: {
          roomId: ephemeralRoom.id,
          senderId: userA.id,
          receiverId: userB.id,
          status: 'EXPIRED',
          createdAt: oldDate,
          updatedAt: oldDate,
          expiresAt: oldDate,
        },
      });

      const ephemeralMessage = await prisma.roomMessage.create({
        data: {
          roomId: ephemeralRoom.id,
          senderId: userA.id,
          message: 'Disposable retention fixture',
          createdAt: oldDate,
        },
      });

      const protectedMatch = await prisma.match.create({
        data: {
          gameSessionId: protectedSession.id,
          roomId: protectedRoom.id,
          gameId: 'tic-tac-toe',
          mode: 'COUPLE',
          resultType: 'COMPETITIVE',
          startedAt: oldDate,
          completedAt: oldDate,
          durationSeconds: 12,
          roundsPlayed: 1,
        },
      });

      await prisma.matchParticipant.createMany({
        data: [
          {
            matchId: protectedMatch.id,
            userId: userA.id,
            playerNameSnapshot: 'Retention Test A',
            usernameSnapshot: userA.username,
            outcome: 'WIN',
            isWinner: true,
          },
          {
            matchId: protectedMatch.id,
            userId: userB.id,
            playerNameSnapshot: 'Retention Test B',
            usernameSnapshot: userB.username,
            outcome: 'LOSS',
            isWinner: false,
          },
        ],
      });

      const protectedStats = await prisma.userGameStats.create({
        data: {
          userId: userA.id,
          gameId: 'tic-tac-toe',
          matchesPlayed: 1,
          wins: 1,
        },
      });

      const protectedRivalry = await prisma.rivalryStats.create({
        data: {
          userLowId: userA.id,
          userHighId: userB.id,
          matchesPlayed: 1,
          competitiveMatches: 1,
          userLowWins: 1,
          lastMatchAt: oldDate,
        },
      });

      const ephemeralAuditLog = await prisma.auditLog.create({
        data: {
          actorUserId: userA.id,
          action: 'RETENTION_TEST_FIXTURE',
          targetType: 'TEST',
          targetId: marker,
          metadata: { marker },
          createdAt: oldDate,
        },
      });

      const retentionOptions = {
        roomRetentionDays: 30,
        sessionRetentionDays: 30,
        invitationRetentionDays: 14,
        auditRetentionDays: 365,
        batchSize: 1,
      };

      const dryRun = await runRetention({ ...retentionOptions, execute: false });
      expect(dryRun.eligibleInvites).toBeGreaterThanOrEqual(1);
      expect(dryRun.eligibleGameActions).toBeGreaterThanOrEqual(1);
      expect(dryRun.eligibleSessionsWithoutMatch).toBeGreaterThanOrEqual(1);
      expect(dryRun.preservedSessionsWithMatch).toBeGreaterThanOrEqual(1);
      expect(dryRun.eligibleRoomsWithoutMatch).toBeGreaterThanOrEqual(1);
      expect(dryRun.preservedRoomsWithMatch).toBeGreaterThanOrEqual(1);
      expect(dryRun.eligibleRoomMessages).toBeGreaterThanOrEqual(1);
      expect(dryRun.eligibleAuditLogs).toBeGreaterThanOrEqual(1);

      expect(await prisma.roomInvitation.count({ where: { id: ephemeralInvitation.id } })).toBe(1);
      expect(await prisma.gameAction.count({ where: { id: ephemeralAction.id } })).toBe(1);
      expect(await prisma.gameSession.count({ where: { id: ephemeralSession.id } })).toBe(1);
      expect(await prisma.room.count({ where: { id: ephemeralRoom.id } })).toBe(1);
      expect(await prisma.roomMessage.count({ where: { id: ephemeralMessage.id } })).toBe(1);
      expect(await prisma.auditLog.count({ where: { id: ephemeralAuditLog.id } })).toBe(1);

      lockClient = new pg.Client({ connectionString: directUrl });
      await lockClient.connect();
      const lockResult = await lockClient.query<{ acquired: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS acquired',
        [RETENTION_LOCK_ID]
      );
      lockHeld = lockResult.rows[0]?.acquired === true;
      expect(lockHeld).toBe(true);

      const blockedRun = await runRetention({ ...retentionOptions, execute: true });
      expect(blockedRun).toEqual({ executed: false, locked: true });
      expect(await prisma.roomInvitation.count({ where: { id: ephemeralInvitation.id } })).toBe(1);

      const unlockResult = await lockClient.query<{ unlocked: boolean }>(
        'SELECT pg_advisory_unlock($1) AS unlocked',
        [RETENTION_LOCK_ID]
      );
      expect(unlockResult.rows[0]?.unlocked).toBe(true);
      lockHeld = false;
      await lockClient.end();
      lockClient = undefined;

      const execution = await runRetention({ ...retentionOptions, execute: true });
      expect(execution.executed).toBe(true);

      expect(await prisma.roomInvitation.count({ where: { id: ephemeralInvitation.id } })).toBe(0);
      expect(await prisma.gameAction.count({ where: { id: ephemeralAction.id } })).toBe(0);
      expect(await prisma.gameSession.count({ where: { id: ephemeralSession.id } })).toBe(0);
      expect(await prisma.room.count({ where: { id: ephemeralRoom.id } })).toBe(0);
      expect(await prisma.roomMessage.count({ where: { id: ephemeralMessage.id } })).toBe(0);
      expect(await prisma.auditLog.count({ where: { id: ephemeralAuditLog.id } })).toBe(0);

      expect(await prisma.room.count({ where: { id: protectedRoom.id } })).toBe(1);
      expect(await prisma.gameSession.count({ where: { id: protectedSession.id } })).toBe(1);
      expect(await prisma.match.count({ where: { id: protectedMatch.id } })).toBe(1);
      expect(await prisma.matchParticipant.count({ where: { matchId: protectedMatch.id } })).toBe(2);
      expect(await prisma.userGameStats.count({ where: { id: protectedStats.id } })).toBe(1);
      expect(await prisma.rivalryStats.count({ where: { id: protectedRivalry.id } })).toBe(1);
    } finally {
      if (lockClient) {
        if (lockHeld) {
          await lockClient.query('SELECT pg_advisory_unlock($1)', [RETENTION_LOCK_ID]).catch(() => {});
        }
        await lockClient.end().catch(() => {});
      }

      await prisma.auditLog.deleteMany({ where: { targetId: marker } }).catch(() => {});
      if (roomIds.length > 0) {
        await prisma.room.deleteMany({ where: { id: { in: roomIds } } }).catch(() => {});
      }
      await prisma.userProfile.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    }
  });
});
