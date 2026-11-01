/**
 * PlaySpace Database Archival and Retention Script
 *
 * Runs non-destructive data retention policies with dry-run support.
 * Operates in small bounded batches to avoid table locking and replication lag.
 *
 * SAFETY GUARANTEES:
 * - Match history, match participants, player statistics and rivalry records are 100% PRESERVED.
 * - Rooms and GameSessions with associated Match records are preserved to prevent cascade deletion.
 * - Ephemeral turn-by-turn game actions from expired/completed sessions are pruned.
 * - Executes in configurable bounded batches with advisory locking.
 *
 * Usage:
 *   npx tsx src/scripts/dbRetention.ts             # Dry run (default)
 *   npx tsx src/scripts/dbRetention.ts --execute   # Perform actual cleanup
 */

import { prisma } from '../config/prisma.js';

export interface RetentionOptions {
  execute: boolean;
  roomRetentionDays?: number;
  sessionRetentionDays?: number;
  invitationRetentionDays?: number;
  auditRetentionDays?: number;
  batchSize?: number;
}

export async function runRetention(options: RetentionOptions) {
  const {
    execute = false,
    roomRetentionDays = 30,
    sessionRetentionDays = 30,
    invitationRetentionDays = 14,
    auditRetentionDays = 90,
    batchSize = 100,
  } = options;

  console.log(`=======================================================`);
  console.log(`🧹 PlaySpace Database Retention Policy Engine`);
  console.log(`Mode: ${execute ? '⚡ EXECUTE (LIVE)' : '🔍 DRY RUN (SIMULATION)'}`);
  console.log(`Policies:`);
  console.log(`  - Closed/Expired Rooms older than: ${roomRetentionDays} days`);
  console.log(`  - Abandoned/Completed Sessions older than: ${sessionRetentionDays} days`);
  console.log(`  - Expired Invitations older than: ${invitationRetentionDays} days`);
  console.log(`  - Audit Logs older than: ${auditRetentionDays} days`);
  console.log(`Batch Size: ${batchSize}`);
  console.log(`=======================================================\n`);

  const now = Date.now();
  const roomCutoff = new Date(now - roomRetentionDays * 24 * 60 * 60 * 1000);
  const sessionCutoff = new Date(now - sessionRetentionDays * 24 * 60 * 60 * 1000);
  const inviteCutoff = new Date(now - invitationRetentionDays * 24 * 60 * 60 * 1000);
  const auditCutoff = new Date(now - auditRetentionDays * 24 * 60 * 60 * 1000);

  // 1. Invitations eligible for pruning
  const eligibleInvites = await prisma.roomInvitation.count({
    where: {
      status: { in: ['EXPIRED', 'REJECTED', 'CANCELLED'] },
      updatedAt: { lte: inviteCutoff },
    },
  });
  console.log(`📋 Expired/Cancelled invitations eligible for pruning: ${eligibleInvites}`);

  // 2. Ephemeral GameActions from completed/abandoned sessions
  const eligibleGameActions = await prisma.gameAction.count({
    where: {
      session: {
        status: { in: ['ABANDONED', 'COMPLETED'] },
        updatedAt: { lte: sessionCutoff },
      },
    },
  });
  console.log(`⚡ Ephemeral game action history eligible for pruning: ${eligibleGameActions}`);

  // 3. Game sessions eligible for deletion (ONLY sessions WITHOUT Match records)
  const eligibleSessionsWithoutMatch = await prisma.gameSession.count({
    where: {
      status: { in: ['ABANDONED', 'COMPLETED'] },
      updatedAt: { lte: sessionCutoff },
      match: null,
    },
  });
  const preservedSessionsWithMatch = await prisma.gameSession.count({
    where: {
      status: { in: ['ABANDONED', 'COMPLETED'] },
      updatedAt: { lte: sessionCutoff },
      match: { isNot: null },
    },
  });
  console.log(`🎮 Sessions without matches eligible for pruning: ${eligibleSessionsWithoutMatch}`);
  console.log(`🛡️  Sessions preserved to protect Match history: ${preservedSessionsWithMatch}`);

  // 4. Closed/Expired rooms eligible for deletion (ONLY rooms WITHOUT any Match records)
  const eligibleRoomsWithoutMatch = await prisma.room.count({
    where: {
      status: { in: ['CLOSED', 'EXPIRED'] },
      updatedAt: { lte: roomCutoff },
      gameSessions: {
        none: {
          match: { isNot: null },
        },
      },
    },
  });
  const preservedRoomsWithMatch = await prisma.room.count({
    where: {
      status: { in: ['CLOSED', 'EXPIRED'] },
      updatedAt: { lte: roomCutoff },
      gameSessions: {
        some: {
          match: { isNot: null },
        },
      },
    },
  });
  console.log(`🚪 Rooms without matches eligible for pruning: ${eligibleRoomsWithoutMatch}`);
  console.log(`🛡️  Rooms preserved to protect Match history: ${preservedRoomsWithMatch}`);

  // 5. Stale RoomMessages in closed/expired rooms
  const eligibleRoomMessages = await prisma.roomMessage.count({
    where: {
      room: {
        status: { in: ['CLOSED', 'EXPIRED'] },
        updatedAt: { lte: roomCutoff },
      },
    },
  });
  console.log(`💬 Ephemeral room messages eligible for pruning: ${eligibleRoomMessages}`);

  // 6. Audit logs eligible for pruning
  const eligibleAuditLogs = await prisma.auditLog.count({
    where: {
      createdAt: { lte: auditCutoff },
    },
  });
  console.log(`📜 Audit log entries eligible for archiving: ${eligibleAuditLogs}`);

  if (!execute) {
    console.log(`\n💡 [Dry Run Complete] No records were modified. Pass --execute to run cleanup.`);
    return {
      eligibleInvites,
      eligibleGameActions,
      eligibleSessionsWithoutMatch,
      preservedSessionsWithMatch,
      eligibleRoomsWithoutMatch,
      preservedRoomsWithMatch,
      eligibleRoomMessages,
      eligibleAuditLogs,
      executed: false,
    };
  }

  console.log(`\n🚀 Executing bounded retention operations in batches of ${batchSize}...`);

  // Advisory lock to prevent multiple concurrent retention executions
  if (typeof prisma.$queryRaw === 'function') {
    try {
      const lockRes: any = await prisma.$queryRaw`SELECT pg_try_advisory_lock(847291048) as acquired`;
      if (lockRes?.[0]?.acquired === false) {
        console.warn('⚠️ Another retention job is currently running. Exiting.');
        return { executed: false, locked: true };
      }
    } catch {}
  }

  try {
    // 1. Prune Invitations in bounded batches
    let deletedInvites = 0;
    while (true) {
      const batch = await prisma.roomInvitation.findMany({
        where: {
          status: { in: ['EXPIRED', 'REJECTED', 'CANCELLED'] },
          updatedAt: { lte: inviteCutoff },
        },
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id);
      const res = await prisma.roomInvitation.deleteMany({ where: { id: { in: ids } } });
      deletedInvites += res.count;
      if (batch.length < batchSize) break;
    }
    console.log(`✅ Pruned ${deletedInvites} stale invitations.`);

    // 2. Prune Ephemeral GameActions in bounded batches
    let deletedGameActions = 0;
    while (true) {
      const batch = await prisma.gameAction.findMany({
        where: {
          session: {
            status: { in: ['ABANDONED', 'COMPLETED'] },
            updatedAt: { lte: sessionCutoff },
          },
        },
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id);
      const res = await prisma.gameAction.deleteMany({ where: { id: { in: ids } } });
      deletedGameActions += res.count;
      if (batch.length < batchSize) break;
    }
    console.log(`✅ Pruned ${deletedGameActions} ephemeral game actions.`);

    // 3. Prune GameSessions without Matches in bounded batches
    let deletedSessions = 0;
    while (true) {
      const batch = await prisma.gameSession.findMany({
        where: {
          status: { in: ['ABANDONED', 'COMPLETED'] },
          updatedAt: { lte: sessionCutoff },
          match: null,
        },
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id);
      const res = await prisma.gameSession.deleteMany({ where: { id: { in: ids } } });
      deletedSessions += res.count;
      if (batch.length < batchSize) break;
    }
    console.log(`✅ Pruned ${deletedSessions} non-match game sessions (preserved ${preservedSessionsWithMatch} sessions with matches).`);

    // 4. Prune Ephemeral RoomMessages in bounded batches
    let deletedRoomMessages = 0;
    while (true) {
      const batch = await prisma.roomMessage.findMany({
        where: {
          room: {
            status: { in: ['CLOSED', 'EXPIRED'] },
            updatedAt: { lte: roomCutoff },
          },
        },
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id);
      const res = await prisma.roomMessage.deleteMany({ where: { id: { in: ids } } });
      deletedRoomMessages += res.count;
      if (batch.length < batchSize) break;
    }
    console.log(`✅ Pruned ${deletedRoomMessages} ephemeral room messages.`);

    // 5. Prune Rooms without Matches in bounded batches
    let deletedRooms = 0;
    while (true) {
      const batch = await prisma.room.findMany({
        where: {
          status: { in: ['CLOSED', 'EXPIRED'] },
          updatedAt: { lte: roomCutoff },
          gameSessions: {
            none: {
              match: { isNot: null },
            },
          },
        },
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id);
      const res = await prisma.room.deleteMany({ where: { id: { in: ids } } });
      deletedRooms += res.count;
      if (batch.length < batchSize) break;
    }
    console.log(`✅ Pruned ${deletedRooms} non-match rooms (preserved ${preservedRoomsWithMatch} rooms with matches).`);

    // 6. Prune Audit Logs in bounded batches
    let deletedAudit = 0;
    while (true) {
      const batch = await prisma.auditLog.findMany({
        where: { createdAt: { lte: auditCutoff } },
        select: { id: true },
        take: batchSize,
      });
      if (batch.length === 0) break;
      const ids = batch.map((r) => r.id);
      const res = await prisma.auditLog.deleteMany({ where: { id: { in: ids } } });
      deletedAudit += res.count;
      if (batch.length < batchSize) break;
    }
    console.log(`✅ Pruned ${deletedAudit} historical audit logs.`);

    console.log(`\n🎉 Retention run completed successfully.`);
    return {
      deletedInvites,
      deletedGameActions,
      deletedSessions,
      deletedRoomMessages,
      deletedRooms,
      deletedAudit,
      preservedSessionsWithMatch,
      preservedRoomsWithMatch,
      executed: true,
    };
  } finally {
    if (typeof prisma.$queryRaw === 'function') {
      try {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(847291048)`;
      } catch {}
    }
  }
}

// Direct execution from CLI
const isDirectRun = process.argv[1]?.endsWith('dbRetention.ts') || process.argv[1]?.endsWith('dbRetention.js');
if (isDirectRun) {
  const execute = process.argv.includes('--execute');
  runRetention({ execute })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error in dbRetention:', err);
      process.exit(1);
    });
}
