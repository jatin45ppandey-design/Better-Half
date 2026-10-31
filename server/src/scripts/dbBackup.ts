/**
 * PlaySpace Database Backup Script
 *
 * Creates a structured data backup snapshot of all application tables.
 * Can be run in dry-run mode or exported to a timestamped JSON snapshot file.
 *
 * Usage:
 *   npx tsx src/scripts/dbBackup.ts               # Generate backup in backups/
 *   npx tsx src/scripts/dbBackup.ts --dry-run     # Inspect table counts only
 *   npx tsx src/scripts/dbBackup.ts --output my.json
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';

export interface BackupMetadata {
  version: string;
  timestamp: string;
  tableCounts: Record<string, number>;
  totalRecords: number;
  checksum?: string;
}

export interface BackupPayload {
  metadata: BackupMetadata;
  data: Record<string, any[]>;
}

// Order respects foreign key dependency hierarchy
const BACKUP_TABLES = [
  'GameConfiguration',
  'QuestionEntry',
  'UserProfile',
  'UserSettings',
  'AppRole',
  'UserModeration',
  'BlockedUser',
  'FriendRequest',
  'Friendship',
  'Room',
  'RoomParticipant',
  'RoomInvitation',
  'RoomMessage',
  'GameSession',
  'GameSessionParticipant',
  'GameAction',
  'GameVote',
  'Match',
  'MatchParticipant',
  'UserGameStats',
  'RivalryStats',
  'AuditLog',
] as const;

export async function createDatabaseBackup(options: {
  outputFile?: string;
  dryRun?: boolean;
}): Promise<BackupPayload> {
  const { outputFile, dryRun = false } = options;

  console.log('========================================================');
  console.log('📦 PlaySpace Authoritative Database Backup Engine');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (Audit Only)' : '💾 FULL SNAPSHOT'}`);
  console.log('========================================================\n');

  const tableCounts: Record<string, number> = {};
  const data: Record<string, any[]> = {};
  let totalRecords = 0;

  for (const table of BACKUP_TABLES) {
    const delegate = (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)];
    if (!delegate || typeof delegate.findMany !== 'function') {
      console.warn(`⚠️ Delegate for ${table} not found in Prisma Client.`);
      continue;
    }

    try {
      const count = await delegate.count();
      tableCounts[table] = count;
      totalRecords += count;

      if (!dryRun) {
        const records = await delegate.findMany();
        data[table] = records;
      }
      console.log(`  - ${table.padEnd(25)} : ${count} record(s)`);
    } catch (err: any) {
      console.warn(`  ⚠️ Failed to inspect ${table}: ${err?.message || err}`);
      tableCounts[table] = 0;
      data[table] = [];
    }
  }

  const metadata: BackupMetadata = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    tableCounts,
    totalRecords,
  };

  const payload: BackupPayload = { metadata, data };

  if (dryRun) {
    console.log(`\n✅ Dry run complete. Total application records: ${totalRecords}`);
    return payload;
  }

  // Calculate cryptographic checksum of data
  const dataStr = JSON.stringify(data);
  const checksum = crypto.createHash('sha256').update(dataStr).digest('hex');
  metadata.checksum = checksum;

  const targetPath =
    outputFile ||
    path.resolve(
      process.cwd(),
      'backups',
      `playspace-backup-${Date.now()}-${metadata.timestamp.slice(0, 10)}.json`
    );

  const targetDir = path.dirname(targetPath);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`\n✅ Backup snapshot successfully created!`);
  console.log(`📁 File: ${targetPath}`);
  console.log(`🔒 SHA256 Checksum: ${checksum}`);
  console.log(`📊 Total Records: ${totalRecords}`);

  return payload;
}

const isDirectRun = process.argv[1]?.endsWith('dbBackup.ts') || process.argv[1]?.endsWith('dbBackup.js');
if (isDirectRun) {
  const dryRun = process.argv.includes('--dry-run');
  const outIdx = process.argv.indexOf('--output');
  const outputFile = outIdx !== -1 && process.argv[outIdx + 1] ? process.argv[outIdx + 1] : undefined;

  createDatabaseBackup({ outputFile, dryRun })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal backup error:', err);
      process.exit(1);
    });
}

