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
import { Prisma, PrismaClient } from '@prisma/client';
import { BACKUP_TABLES, type BackupPayload } from './dbBackup.js';

export interface ParsedTargetInfo {
  protocol: string;
  hostname: string;
  port: string;
  database: string;
  sanitizedUrl: string;
}

function redactDatabaseUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  } catch {
    return '[REDACTED DATABASE URL]';
  }
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
    return { isValid: false, reason: 'Invalid database URL protocol. Expected postgres: or postgresql:.' };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
  let database: string;
  try {
    database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
  } catch {
    return { isValid: false, reason: 'Database name in target URL is not valid URL encoding.' };
  }

  if (!hostname || !database || database.includes('/')) {
    return { isValid: false, reason: 'Target URL must contain exactly one database name and a hostname.' };
  }

  const port = parsed.port || '5432';
  const sanitizedUrl = `${parsed.protocol}//${hostname}:${port}/${database}`;

  // Block known hosted application database providers even if an allowlist entry is supplied.
  const hasDomainSuffix = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);
  const isHostedDatabase =
    hasDomainSuffix(hostname, 'supabase.co') ||
    hasDomainSuffix(hostname, 'supabase.com') ||
    hasDomainSuffix(hostname, 'render.com') ||
    hasDomainSuffix(hostname, 'onrender.com') ||
    hasDomainSuffix(hostname, 'amazonaws.com') ||
    hasDomainSuffix(hostname, 'azure.com') ||
    hasDomainSuffix(hostname, 'neon.tech') ||
    hasDomainSuffix(hostname, 'cockroachlabs.cloud') ||
    hostname.includes('.pooler.');

  if (isHostedDatabase) {
    return {
      isValid: false,
      reason: `Host "${hostname}" is a hosted-provider database and is forbidden for disposable restores.`,
    };
  }

  const isLocalHost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]';

  if (isLocalHost) {
    if (['postgres', 'template0', 'template1'].includes(database.toLowerCase())) {
      return {
        isValid: false,
        reason: `Target database "${database}" is a default system database. Use a dedicated disposable database.`,
      };
    }
    return {
      isValid: true,
      info: { protocol: parsed.protocol, hostname, port, database, sanitizedUrl },
    };
  }

  // Remote allowlist entries must match the complete destination identity.
  // Host-only and substring entries are not accepted.
  const allowedEntries = (process.env.DISPOSABLE_DATABASE_ALLOWLIST || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const targetIdentity = `${hostname}:${port}/${database}`;

  if (!allowedEntries.includes(targetIdentity)) {
    return {
      isValid: false,
      reason:
        `Remote target "${targetIdentity}" is not explicitly allowlisted. ` +
        'Use an exact hostname:port/database entry in DISPOSABLE_DATABASE_ALLOWLIST.',
    };
  }

  return {
    isValid: true,
    info: { protocol: parsed.protocol, hostname, port, database, sanitizedUrl },
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

  // Validate snapshot integrity and exact schema contents before contacting the target database.
  if (typeof payload.metadata.checksum !== 'string' || !/^[a-f0-9]{64}$/i.test(payload.metadata.checksum)) {
    throw new Error('Backup snapshot is missing a valid SHA-256 checksum.');
  }

  const dataStr = JSON.stringify(payload.data);
  const calculatedChecksum = crypto.createHash('sha256').update(dataStr).digest('hex');
  if (calculatedChecksum !== payload.metadata.checksum) {
    throw new Error(
      `CHECKSUM INTEGRITY MISMATCH! Expected: ${payload.metadata.checksum}; computed: ${calculatedChecksum}`
    );
  }
  console.log(`🔒 Checksum verified successfully (SHA256: ${payload.metadata.checksum.slice(0, 16)}...)`);

  const expectedTables = new Set<string>(BACKUP_TABLES);
  const suppliedTables = Object.keys(payload.data);
  const unknownTables = suppliedTables.filter((table) => !expectedTables.has(table));
  if (unknownTables.length > 0) {
    throw new Error(`Compatibility Error: Backup contains unrecognized tables: ${unknownTables.join(', ')}.`);
  }

  let validatedRecordTotal = 0;
  for (const table of BACKUP_TABLES) {
    if (!Object.prototype.hasOwnProperty.call(payload.data, table)) {
      throw new Error(`Compatibility Error: Backup snapshot is missing expected table "${table}".`);
    }
    const records = payload.data[table];
    if (!Array.isArray(records)) {
      throw new Error(`Malformed backup data for table "${table}": expected an array.`);
    }
    const declaredCount = payload.metadata.tableCounts?.[table];
    if (!Number.isSafeInteger(declaredCount) || declaredCount !== records.length) {
      throw new Error(
        `Backup metadata mismatch for "${table}": declared ${String(declaredCount)} record(s), found ${records.length}.`
      );
    }
    validatedRecordTotal += records.length;
  }

  if (!Number.isSafeInteger(payload.metadata.totalRecords) || payload.metadata.totalRecords !== validatedRecordTotal) {
    throw new Error(
      `Backup metadata total mismatch: declared ${String(payload.metadata.totalRecords)}, found ${validatedRecordTotal}.`
    );
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
      `Target URL: ${redactDatabaseUrl(targetUrl)}`
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
    // 3. Verify the target is empty and restore atomically. Serializable isolation
    // protects the preflight against concurrent writes; duplicates are never skipped.
    await disposablePrisma.$transaction(
      async (tx) => {
        const delegates = new Map<string, any>();

        // Validate every expected model and reject non-empty targets before inserting.
        for (const table of BACKUP_TABLES) {
          const delegateName = table.charAt(0).toLowerCase() + table.slice(1);
          const delegate = (tx as any)[delegateName];
          if (!delegate || typeof delegate.count !== 'function' || typeof delegate.createMany !== 'function') {
            throw new Error(
              `Schema compatibility error: Required table "${table}" is unavailable in the target Prisma schema.`
            );
          }

          const existingCount = await delegate.count();
          if (existingCount !== 0) {
            throw new Error(
              `Restore target is not empty: table "${table}" already contains ${existingCount} record(s). Use a fresh disposable database.`
            );
          }
          delegates.set(table, delegate);
        }

        for (const table of BACKUP_TABLES) {
          const records = payload.data[table];
          if (records.length === 0) continue;

          const delegate = delegates.get(table);
          const result = await delegate.createMany({
            data: records,
            skipDuplicates: false,
          });

          if (result.count !== records.length) {
            throw new Error(
              `Restore count mismatch for "${table}": inserted ${result.count} of ${records.length} record(s).`
            );
          }

          restoredRecords += result.count;
          console.log(`  ✅ Restored ${result.count} record(s) into ${table}`);
        }

        if (restoredRecords !== payload.metadata.totalRecords) {
          throw new Error(
            `Restore total mismatch: inserted ${restoredRecords}, expected ${payload.metadata.totalRecords}.`
          );
        }
      },
      {
        maxWait: 10000,
        timeout: 120000,
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
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
