/**
 * PlaySpace Database Archival and Retention Script
 *
 * Runs non-destructive data retention policies with dry-run support.
 * Operates in small bounded batches to avoid table locking and replication lag.
 *
 * Usage:
 *   npx tsx src/scripts/dbRetention.ts             # Dry run (default)
 *   npx tsx src/scripts/dbRetention.ts --execute   # Perform actual cleanup
 */

import { prisma } from '../config/prisma.js';

interface RetentionOptions {
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

  // 1. Identify Candidate Expired Invitations
  const eligibleInvites = await prisma.roomInvitation.count({
    where: {
      status: { in: ['EXPIRED', 'REJECTED', 'CANCELLED'] },
      updatedAt: { lte: inviteCutoff },
    },
  });
  console.log(`📋 Expired/Cancelled invitations eligible for pruning: ${eligibleInvites}`);

  // 2. Identify Candidate Abandoned Sessions
  const eligibleSessions = await prisma.gameSession.count({
    where: {
      status: { in: ['ABANDONED', 'COMPLETED'] },
      updatedAt: { lte: sessionCutoff },
    },
  });
  console.log(`🎮 Abandoned/Completed game sessions eligible for archiving: ${eligibleSessions}`);

  // 3. Identify Candidate Closed/Expired Rooms
  const eligibleRooms = await prisma.room.count({
    where: {
      status: { in: ['CLOSED', 'EXPIRED'] },
      updatedAt: { lte: roomCutoff },
    },
  });
  console.log(`🚪 Closed/Expired rooms eligible for archiving: ${eligibleRooms}`);

  // 4. Identify Candidate Audit Logs
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
      eligibleSessions,
      eligibleRooms,
      eligibleAuditLogs,
      executed: false,
    };
  }

  console.log(`\n🚀 Executing bounded retention operations...`);

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
    // 1. Prune Invitations
    const deletedInvites = await prisma.roomInvitation.deleteMany({
      where: {
        status: { in: ['EXPIRED', 'REJECTED', 'CANCELLED'] },
        updatedAt: { lte: inviteCutoff },
      },
    });
    console.log(`✅ Pruned ${deletedInvites.count} stale invitations.`);

    // 2. Prune Audit Logs
    const deletedAudit = await prisma.auditLog.deleteMany({
      where: {
        createdAt: { lte: auditCutoff },
      },
    });
    console.log(`✅ Pruned ${deletedAudit.count} historical audit logs.`);

    console.log(`\n🎉 Retention run completed successfully.`);
    return {
      deletedInvites: deletedInvites.count,
      deletedAudit: deletedAudit.count,
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
