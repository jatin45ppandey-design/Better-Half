/**
 * PlaySpace Database Backup Script
 *
 * Creates a structured data backup snapshot of all application tables.
 * Can be run in dry-run mode or exported to a timestamped JSON snapshot file.
 *
 * Fail-safe & consistency guarantees:
 * - Reads all tables under a single RepeatableRead transactional snapshot.
 * - If any table read or count fails, the entire backup is aborted (never substituted with []).
 * - Checksum is computed over complete data only.
 * - Writes to an isolated temporary file first, then atomically renames to target.
 * - Uses restricted file permissions (0o600) to protect user data.
 *
 * Usage:
 *   npx tsx src/scripts/dbBackup.ts               # Generate backup in backups/
 *   npx tsx src/scripts/dbBackup.ts --dry-run     # Inspect table counts only
 *   npx tsx src/scripts/dbBackup.ts --output my.json
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
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
export const BACKUP_TABLES = [
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

  let tempPath: string | null = null;

  try {
    // 1. Execute all table reads under a consistent RepeatableRead transactional snapshot
    const { tableCounts, data, totalRecords } = await prisma.$transaction(
      async (tx) => {
        const counts: Record<string, number> = {};
        const recordsData: Record<string, any[]> = {};
        let runningTotal = 0;

        for (const table of BACKUP_TABLES) {
          const delegateName = table.charAt(0).toLowerCase() + table.slice(1);
          const delegate = (tx as any)[delegateName];

          if (!delegate || typeof delegate.findMany !== 'function' || typeof delegate.count !== 'function') {
            throw new Error(`Critical backup error: Required table delegate "${table}" was not found in Prisma Client.`);
          }

          // Any query failure here will throw and abort the entire transaction
          const count = await delegate.count();
          counts[table] = count;
          runningTotal += count;

          if (!dryRun) {
            const records = await delegate.findMany();
            if (records.length !== count) {
              throw new Error(
                `Data snapshot inconsistency in table "${table}": counted ${count} records but retrieved ${records.length}.`
              );
            }
            recordsData[table] = records;
          }

          console.log(`  - ${table.padEnd(25)} : ${count} record(s)`);
        }

        return { tableCounts: counts, data: recordsData, totalRecords: runningTotal };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 10000,
        timeout: 60000,
      }
    );

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

    // 2. Generate SHA-256 cryptographic checksum only after all table reads succeed
    const dataStr = JSON.stringify(data);
    const checksum = crypto.createHash('sha256').update(dataStr).digest('hex');
    metadata.checksum = checksum;

    // 3. Resolve target destination path
    const targetPath =
      outputFile ||
      path.resolve(
        process.cwd(),
        'backups',
        `playspace-backup-${Date.now()}-${metadata.timestamp.slice(0, 10)}.json`
      );

    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
    }

    // 4. Write to temporary file with restricted permissions (0o600)
    tempPath = path.resolve(
      targetDir,
      `.tmp-${path.basename(targetPath)}-${crypto.randomBytes(6).toString('hex')}`
    );

    const serialized = JSON.stringify(payload, null, 2);
    fs.writeFileSync(tempPath, serialized, { encoding: 'utf8', mode: 0o600 });

    // Validate temp file was written properly
    const stat = fs.statSync(tempPath);
    if (stat.size === 0) {
      throw new Error(`Backup file write failed: temporary file ${tempPath} is empty.`);
    }

    // 5. Atomic rename to final destination
    fs.renameSync(tempPath, targetPath);
    tempPath = null; // Clear so cleanup doesn't delete the final file

    try {
      fs.chmodSync(targetPath, 0o600);
    } catch {
      // chmod may fail on some Windows filesystems, non-fatal
    }

    console.log(`\n✅ Backup snapshot successfully created!`);
    console.log(`📁 File: ${targetPath}`);
    console.log(`🔒 SHA256 Checksum: ${checksum}`);
    console.log(`📊 Total Records: ${totalRecords}`);

    return payload;
  } catch (err: any) {
    // If temp file remains from an interrupted write, remove it so no corrupt file lingers
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
    console.error(`❌ [BACKUP FAILED] Backup aborted:`, err?.message || err);
    throw err;
  }
}

const isDirectRun = process.argv[1]?.endsWith('dbBackup.ts') || process.argv[1]?.endsWith('dbBackup.js');
if (isDirectRun) {
  const dryRun = process.argv.includes('--dry-run');
  const outIdx = process.argv.indexOf('--output');
  const outputFile = outIdx !== -1 && process.argv[outIdx + 1] ? process.argv[outIdx + 1] : undefined;

  createDatabaseBackup({ outputFile, dryRun })
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
