/**
 * PlaySpace Database Restore Script
 *
 * Imports a structured database backup snapshot into a DISPOSABLE ISOLATED database.
 *
 * CRITICAL SAFETY RESTRICTIONS:
 * - NEVER restores into production or shared staging databases.
 * - Parses and strictly validates target connection URL (protocol, host, port, db name).
 * - Remote databases are blocked unless explicitly configured in DISPOSABLE_DATABASE_ALLOWLIST.
 * - Substring matching (e.g. "test" in remote URL) is prohibited.
 * - Requires explicit operator confirmation before executing live restore.
 * - Executes within a single atomic transaction with complete rollback on any failure.
 * - Never logs passwords or sensitive credentials.
 * - Treats missing or unrecognized schema tables as compatibility errors.
 *
 * Usage:
 *   npx tsx src/scripts/dbRestore.ts --input backups/my-backup.json --dry-run
 *   npx tsx src/scripts/dbRestore.ts --input backups/my-backup.json --target-url postgresql://test:test@localhost:5432/playspace_test --confirm
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { BACKUP_TABLES, type BackupPayload } from './dbBackup.js';

export interface ParsedTargetInfo {
  protocol: string;
  hostname: string;
  port: string;
  database: string;
  sanitizedUrl: string;
}

export function validateDisposableDatabase(url: string): { isValid: boolean; reason?: string; info?: ParsedTargetInfo } {
  if (!url) {
    return { isValid: false, reason: 'Database target URL must be explicitly specified.' };
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { isValid: false, reason: 'Failed to parse database connection URL as a valid standard URL.' };
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return { isValid: false, reason: `Invalid protocol "${parsed.protocol}". Expected "postgresql:" or "postgres:".` };
  }

  const hostname = parsed.hostname.toLowerCase();
  const dbName = parsed.pathname.replace(/^\//, '').toLowerCase();

  if (!dbName) {
    return { isValid: false, reason: 'Target database name is missing from the connection URL.' };
  }

  const sanitizedUrl = `${parsed.protocol}//${parsed.username ? `${parsed.username}:***@` : ''}${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}/${dbName}`;

  // Reject known cloud/hosted databases immediately
  if (
    hostname.includes('supabase.co') ||
    hostname.includes('render.com') ||
    hostname.includes('pooler.') ||
    hostname.includes('amazonaws.com') ||
    hostname.includes('azure.com') ||
    hostname.includes('neon.tech') ||
    hostname.includes('cockroachlabs.cloud')
  ) {
    return {
      isValid: false,
      reason: `Host "${hostname}" is a cloud/hosted provider and is strictly forbidden for restore operations.`,
    };
  }

  // Local isolated databases (localhost, 127.0.0.1, [::1])
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  if (isLocalHost) {
    if (dbName === 'postgres' || dbName === 'template1') {
      return {
        isValid: false,
        reason: `Target database "${dbName}" is a default system database. Dedicated isolated test DB required.`,
      };
    }
    return {
      isValid: true,
      info: {
        protocol: parsed.protocol,
        hostname,
        port: parsed.port || '5432',
        database: dbName,
        sanitizedUrl,
      },
    };
  }

  // Remote targets: Strictly allowlisted only. Substring matches like 'test' or 'dev' are NOT accepted.
  const allowlistEnv = process.env.DISPOSABLE_DATABASE_ALLOWLIST || '';
  const allowedEntries = allowlistEnv
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const targetIdentifier = `${hostname}:${parsed.port || '5432'}/${dbName}`;
  const targetHostAndDb = `${hostname}/${dbName}`;

  const isExplicitlyAllowlisted = allowedEntries.some(
    (entry) => entry === targetIdentifier || entry === targetHostAndDb || entry === hostname
  );

  if (isExplicitlyAllowlisted) {
    return {
      isValid: true,
      info: {
        protocol: parsed.protocol,
        hostname,
        port: parsed.port || '5432',
        database: dbName,
        sanitizedUrl,
      },
    };
  }

  return {
    isValid: false,
    reason: `Remote database host "${hostname}" is not in DISPOSABLE_DATABASE_ALLOWLIST. Remote restores are blocked by default.`,
  };
}

export function isDisposableDatabase(url: string): boolean {
  return validateDisposableDatabase(url).isValid;
}

export async function restoreDatabaseSnapshot(options: {
  inputFile: string;
  targetUrl?: string;
  dryRun?: boolean;
  confirmed?: boolean;
}): Promise<{ success: boolean; restoredRecords: number; error?: string }> {
  const { inputFile, targetUrl, dryRun = false, confirmed = false } = options;

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

  // 1. Verify Checksum
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

  // Validate that all expected backup tables are present
  for (const table of BACKUP_TABLES) {
    if (!(table in payload.data)) {
      throw new Error(`Compatibility Error: Backup snapshot is missing expected table "${table}".`);
    }
  }

  if (dryRun) {
    console.log('\n✅ Dry-run validation passed. Backup snapshot is valid and safe to restore.');
    return { success: true, restoredRecords: payload.metadata.totalRecords };
  }

  // 2. Strict Target Validation
  if (!targetUrl) {
    throw new Error(
      'Target database URL must be explicitly specified with --target-url to prevent accidental restoration.'
    );
  }

  const validation = validateDisposableDatabase(targetUrl);
  if (!validation.isValid || !validation.info) {
    throw new Error(
      `CRITICAL SAFETY VIOLATION:\nTarget database validation rejected!\n` +
      `Reason: ${validation.reason}\n` +
      `Target URL: ${targetUrl.replace(/:[^:@]+@/, ':***@')}`
    );
  }

  if (!confirmed) {
    throw new Error(
      `CRITICAL SAFETY CONFIRMATION:\nOperator confirmation required for live database restoration.\n` +
      `Target Database: ${validation.info.sanitizedUrl}\n` +
      `Pass --confirm to confirm destination and execute restoration.`
    );
  }

  console.log(`\n🎯 Target Database : ${validation.info.sanitizedUrl}`);
  console.log('⚡ Target verified as an isolated disposable database. Proceeding with atomic import...');

  const disposablePrisma = new PrismaClient({
    datasources: {
      db: { url: targetUrl },
    },
  });

  let restoredRecords = 0;

  try {
    // 3. Execute all restorations inside a single atomic transaction.
    // If any table fails, the entire transaction rolls back cleanly without partial state.
    await disposablePrisma.$transaction(
      async (tx) => {
        for (const [table, records] of Object.entries(payload.data)) {
          if (!Array.isArray(records)) {
            throw new Error(`Malformed data for table "${table}": expected array of records.`);
          }
          if (records.length === 0) continue;

          const delegateName = table.charAt(0).toLowerCase() + table.slice(1);
          const delegate = (tx as any)[delegateName];

          if (!delegate || typeof delegate.createMany !== 'function') {
            throw new Error(
              `Schema compatibility error: Table "${table}" from backup snapshot is not recognized in target schema.`
            );
          }

          const res = await delegate.createMany({
            data: records,
            skipDuplicates: true,
          });

          restoredRecords += res.count || 0;
          console.log(`  ✅ Restored ${res.count} record(s) into ${table}`);
        }
      },
      {
        maxWait: 10000,
        timeout: 120000,
      }
    );

    console.log(`\n🎉 Restoration completed successfully! Total imported: ${restoredRecords}`);
    return { success: true, restoredRecords };
  } catch (err: any) {
    console.error(`\n❌ [RESTORE FAILED] Transaction rolled back cleanly. No partial data committed.`);
    throw err;
  } finally {
    await disposablePrisma.$disconnect();
  }
}

const isDirectRun = process.argv[1]?.endsWith('dbRestore.ts') || process.argv[1]?.endsWith('dbRestore.js');
if (isDirectRun) {
  const dryRun = process.argv.includes('--dry-run');
  const confirmed = process.argv.includes('--confirm');
  const inputIdx = process.argv.indexOf('--input');
  const targetIdx = process.argv.indexOf('--target-url');

  const inputFile = inputIdx !== -1 && process.argv[inputIdx + 1] ? process.argv[inputIdx + 1] : '';
  const targetUrl = targetIdx !== -1 && process.argv[targetIdx + 1] ? process.argv[targetIdx + 1] : undefined;

  if (!inputFile) {
    console.error('Error: --input <path> is required.');
    process.exit(1);
  }

  restoreDatabaseSnapshot({ inputFile, targetUrl, dryRun, confirmed })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Fatal restore error:', err.message || err);
      process.exit(1);
    });
}
