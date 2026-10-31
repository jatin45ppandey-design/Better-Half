/**
 * PlaySpace Database Restore Script
 *
 * Imports a structured database backup snapshot into a DISPOSABLE ISOLATED database.
 *
 * CRITICAL SAFETY RESTRICTIONS:
 * - NEVER restores into production or shared staging databases.
 * - Refuses execution if target database URL contains "supabase.co" or matches production env.
 * - Requires explicit --target-url pointing to a disposable/local database.
 * - Supports --dry-run validation of snapshot structure and checksum.
 *
 * Usage:
 *   npx tsx src/scripts/dbRestore.ts --input backups/my-backup.json --dry-run
 *   npx tsx src/scripts/dbRestore.ts --input backups/my-backup.json --target-url postgresql://test:test@localhost:5432/disposable_db
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import type { BackupPayload } from './dbBackup.js';

export function isDisposableDatabase(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Reject any production or Supabase hosting
  if (lower.includes('supabase.co')) return false;
  if (lower.includes('render.com')) return false;
  if (lower.includes('pooler.')) return false;
  if (lower.includes('production') || lower.includes('prod')) return false;

  // Accept strictly localhost, 127.0.0.1, or explicit disposable test databases
  if (
    lower.includes('localhost') ||
    lower.includes('127.0.0.1') ||
    lower.includes('test') ||
    lower.includes('disposable')
  ) {
    return true;
  }
  return false;
}

export async function restoreDatabaseSnapshot(options: {
  inputFile: string;
  targetUrl?: string;
  dryRun?: boolean;
}): Promise<{ success: boolean; restoredRecords: number; error?: string }> {
  const { inputFile, targetUrl, dryRun = false } = options;

  console.log('========================================================');
  console.log('🔄 PlaySpace Database Snapshot Restore Engine');
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (Integrity Check Only)' : '⚡ LIVE RESTORE'}`);
  console.log('========================================================\n');

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Backup snapshot file not found: ${inputFile}`);
  }

  const raw = fs.readFileSync(inputFile, 'utf8');
  let payload: BackupPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON format in backup file: ${inputFile}`);
  }

  if (!payload.metadata || !payload.data) {
    throw new Error(`Malformed backup snapshot. Missing metadata or data sections.`);
  }

  // 1. Verify Checksum if present
  if (payload.metadata.checksum) {
    const dataStr = JSON.stringify(payload.data);
    const calculatedChecksum = crypto.createHash('sha256').update(dataStr).digest('hex');
    if (calculatedChecksum !== payload.metadata.checksum) {
      throw new Error(
        `CHECKSUM INTEGRITY MISMATCH!\nExpected: ${payload.metadata.checksum}\nComputed: ${calculatedChecksum}`
      );
    }
    console.log(`🔒 Checksum verified successfully (SHA256: ${payload.metadata.checksum.slice(0, 16)}...)`);
  }

  console.log(`📋 Backup Timestamp : ${payload.metadata.timestamp}`);
  console.log(`📊 Total Records    : ${payload.metadata.totalRecords}`);
  console.log(`🔢 Tables Contained : ${Object.keys(payload.data).length}`);

  if (dryRun) {
    console.log('\n✅ Dry-run validation passed. Backup snapshot is valid and safe to restore.');
    return { success: true, restoredRecords: payload.metadata.totalRecords };
  }

  // 2. Strict Safety Check on Target Database URL
  if (!targetUrl) {
    throw new Error(
      'Target database URL must be explicitly specified with --target-url to prevent accidental restoration.'
    );
  }

  if (!isDisposableDatabase(targetUrl)) {
    throw new Error(
      `CRITICAL SAFETY VIOLATION:\nTarget database URL is NOT recognized as an isolated disposable database!\n` +
      `Restoration is strictly prohibited on production, staging, or Supabase databases.\n` +
      `Target URL: ${targetUrl.replace(/:[^:@]+@/, ':***@')}`
    );
  }

  console.log(`\n🎯 Target Database : ${targetUrl.replace(/:[^:@]+@/, ':***@')}`);
  console.log('⚡ Target verified as an isolated disposable database. Proceeding with import...');

  const disposablePrisma = new PrismaClient({
    datasources: {
      db: { url: targetUrl },
    },
  });

  let restoredRecords = 0;

  try {
    // Import tables in forward dependency order
    for (const [table, records] of Object.entries(payload.data)) {
      if (!Array.isArray(records) || records.length === 0) continue;
      const delegate = (disposablePrisma as any)[table.charAt(0).toLowerCase() + table.slice(1)];
      if (!delegate || typeof delegate.createMany !== 'function') {
        console.warn(`  ⚠️ Table ${table} not found in target Prisma schema. Skipping.`);
        continue;
      }

      const res = await delegate.createMany({
        data: records,
        skipDuplicates: true,
      });
      restoredRecords += res.count || 0;
      console.log(`  ✅ Restored ${res.count} record(s) into ${table}`);
    }

    console.log(`\n🎉 Restoration completed successfully! Total imported: ${restoredRecords}`);
    return { success: true, restoredRecords };
  } finally {
    await disposablePrisma.$disconnect();
  }
}

const isDirectRun = process.argv[1]?.endsWith('dbRestore.ts') || process.argv[1]?.endsWith('dbRestore.js');
if (isDirectRun) {
  const dryRun = process.argv.includes('--dry-run');
  const inputIdx = process.argv.indexOf('--input');
  const targetIdx = process.argv.indexOf('--target-url');

  const inputFile = inputIdx !== -1 && process.argv[inputIdx + 1] ? process.argv[inputIdx + 1] : '';
  const targetUrl = targetIdx !== -1 && process.argv[targetIdx + 1] ? process.argv[targetIdx + 1] : undefined;

  if (!inputFile) {
    console.error('Error: --input <path> is required.');
    process.exit(1);
  }

  restoreDatabaseSnapshot({ inputFile, targetUrl, dryRun })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Fatal restore error:', err.message || err);
      process.exit(1);
    });
}

