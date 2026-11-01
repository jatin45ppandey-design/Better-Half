import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pgMocks = vi.hoisted(() => ({
  Client: vi.fn(),
}));

vi.mock('pg', () => ({
  default: { Client: pgMocks.Client },
}));

import { BACKUP_TABLES, createDatabaseBackup, type BackupPayload } from '../src/scripts/dbBackup.js';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/config/prisma.js';
import { restoreDatabaseSnapshot, validateDisposableDatabase } from '../src/scripts/dbRestore.js';
import { tryAcquireDedicatedAdvisoryLock } from '../src/scripts/advisoryLock.js';

function createValidPayload(): BackupPayload {
  const data = Object.fromEntries(BACKUP_TABLES.map((table) => [table, []])) as Record<string, any[]>;
  const tableCounts = Object.fromEntries(BACKUP_TABLES.map((table) => [table, 0]));
  const checksum = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

  return {
    metadata: {
      version: '1.0.0',
      timestamp: '2026-01-01T00:00:00.000Z',
      tableCounts,
      totalRecords: 0,
      checksum,
    },
    data,
  };
}

describe('Database operations safety validation', () => {
  let tempDirectory: string;
  let previousAllowlist: string | undefined;

  beforeEach(() => {
    tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'playspace-db-safety-'));
    previousAllowlist = process.env.DISPOSABLE_DATABASE_ALLOWLIST;
  });

  afterEach(() => {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
    if (previousAllowlist === undefined) {
      delete process.env.DISPOSABLE_DATABASE_ALLOWLIST;
    } else {
      process.env.DISPOSABLE_DATABASE_ALLOWLIST = previousAllowlist;
    }
    vi.clearAllMocks();
  });

  function writeSnapshot(payload: BackupPayload): string {
    const filePath = path.join(tempDirectory, 'snapshot.json');
    fs.writeFileSync(filePath, JSON.stringify(payload), { encoding: 'utf8', mode: 0o600 });
    return filePath;
  }

  describe('disposable restore destination validation', () => {
    it('accepts a dedicated localhost database but rejects PostgreSQL system databases', () => {
      const valid = validateDisposableDatabase(
        'postgresql://restore_user:secret@localhost:5432/playspace_restore_test'
      );
      expect(valid.isValid).toBe(true);
      expect(valid.info?.database).toBe('playspace_restore_test');
      expect(valid.info?.sanitizedUrl).not.toContain('secret');

      for (const systemDatabase of ['postgres', 'template0', 'template1']) {
        const result = validateDisposableDatabase(
          'postgresql://restore_user:secret@localhost:5432/' + systemDatabase
        );
        expect(result.isValid).toBe(false);
        expect(result.reason).toContain('system database');
      }
    });

    it('requires an exact remote hostname:port/database allowlist entry', () => {
      const target = 'postgresql://restore_user:secret@restore-db.example.test:5432/playspace_restore_test';

      process.env.DISPOSABLE_DATABASE_ALLOWLIST = 'restore-db.example.test';
      expect(validateDisposableDatabase(target).isValid).toBe(false);

      process.env.DISPOSABLE_DATABASE_ALLOWLIST = 'restore-db.example.test:5432/another_database';
      expect(validateDisposableDatabase(target).isValid).toBe(false);

      process.env.DISPOSABLE_DATABASE_ALLOWLIST = 'restore-db.example.test:5432/playspace_restore_test';
      const allowed = validateDisposableDatabase(target);
      expect(allowed.isValid).toBe(true);
      expect(allowed.info?.sanitizedUrl).toBe(
        'postgresql://restore-db.example.test:5432/playspace_restore_test'
      );
      expect(allowed.info?.sanitizedUrl).not.toContain('restore_user');
      expect(allowed.info?.sanitizedUrl).not.toContain('secret');
    });

    it('normalizes host casing but preserves the exact database-name casing', () => {
      process.env.DISPOSABLE_DATABASE_ALLOWLIST = 'restore-db.example.test:5432/PlaySpace_Restore';
      const matching = validateDisposableDatabase(
        'postgresql://user:secret@RESTORE-DB.EXAMPLE.TEST:5432/PlaySpace_Restore'
      );
      const wrongCase = validateDisposableDatabase(
        'postgresql://user:secret@restore-db.example.test:5432/playspace_restore'
      );

      expect(matching.isValid).toBe(true);
      expect(wrongCase.isValid).toBe(false);
    });

    it('blocks hosted application database providers even when they are allowlisted', () => {
      process.env.DISPOSABLE_DATABASE_ALLOWLIST =
        'db.project.supabase.co:5432/playspace_restore_test';
      const result = validateDisposableDatabase(
        'postgresql://user:secret@db.project.supabase.co:5432/playspace_restore_test'
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('hosted-provider');
    });

    it('rejects malformed URLs and non-PostgreSQL protocols without exposing credentials', () => {
      expect(validateDisposableDatabase('not-a-url').isValid).toBe(false);

      const result = validateDisposableDatabase(
        'https://restore_user:super_secret@example.test/database'
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('protocol');
      expect(result.reason).not.toContain('super_secret');
    });
  });

  describe('backup snapshot integrity validation', () => {
    it('accepts a complete checksum-valid snapshot in dry-run mode without a target database', async () => {
      const inputFile = writeSnapshot(createValidPayload());

      await expect(
        restoreDatabaseSnapshot({ inputFile, dryRun: true })
      ).resolves.toEqual({ success: true, restoredRecords: 0 });
    });

    it('rejects a missing SHA-256 checksum', async () => {
      const payload = createValidPayload();
      payload.metadata.checksum = undefined;
      const inputFile = writeSnapshot(payload);

      await expect(
        restoreDatabaseSnapshot({ inputFile, dryRun: true })
      ).rejects.toThrow('missing a valid SHA-256 checksum');
    });

    it('rejects a checksum mismatch before considering restore data', async () => {
      const payload = createValidPayload();
      payload.data.GameConfiguration.push({ id: 'tampered-record' });
      const inputFile = writeSnapshot(payload);

      await expect(
        restoreDatabaseSnapshot({ inputFile, dryRun: true })
      ).rejects.toThrow('CHECKSUM INTEGRITY MISMATCH');
    });

    it('rejects missing tables and unrecognized tables', async () => {
      const missingTable = createValidPayload();
      delete missingTable.data.GameConfiguration;
      missingTable.metadata.checksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(missingTable.data))
        .digest('hex');

      await expect(
        restoreDatabaseSnapshot({ inputFile: writeSnapshot(missingTable), dryRun: true })
      ).rejects.toThrow('missing expected table "GameConfiguration"');

      const unknownTable = createValidPayload();
      unknownTable.data.UnexpectedTable = [];
      unknownTable.metadata.checksum = crypto
        .createHash('sha256')
        .update(JSON.stringify(unknownTable.data))
        .digest('hex');

      await expect(
        restoreDatabaseSnapshot({ inputFile: writeSnapshot(unknownTable), dryRun: true })
      ).rejects.toThrow('unrecognized tables: UnexpectedTable');
    });

    it('rejects per-table and total record-count metadata mismatches', async () => {
      const tableCountMismatch = createValidPayload();
      tableCountMismatch.metadata.tableCounts.GameConfiguration = 1;

      await expect(
        restoreDatabaseSnapshot({ inputFile: writeSnapshot(tableCountMismatch), dryRun: true })
      ).rejects.toThrow('Backup metadata mismatch for "GameConfiguration"');

      const totalMismatch = createValidPayload();
      totalMismatch.metadata.totalRecords = 1;

      await expect(
        restoreDatabaseSnapshot({ inputFile: writeSnapshot(totalMismatch), dryRun: true })
      ).rejects.toThrow('Backup metadata total mismatch');
    });

    it('requires an explicit target and operator confirmation before a live restore', async () => {
      const inputFile = writeSnapshot(createValidPayload());

      await expect(
        restoreDatabaseSnapshot({ inputFile, dryRun: false })
      ).rejects.toThrow('must be explicitly specified');

      await expect(
        restoreDatabaseSnapshot({
          inputFile,
          targetUrl: 'postgresql://restore_user:secret@localhost:5432/playspace_restore_test',
          confirmed: false,
        })
      ).rejects.toThrow('Operator confirmation required');
    });

    it('rejects a remote target that is not exactly allowlisted before opening a database client', async () => {
      process.env.DISPOSABLE_DATABASE_ALLOWLIST = 'restore-db.example.test';
      const inputFile = writeSnapshot(createValidPayload());

      await expect(
        restoreDatabaseSnapshot({
          inputFile,
          targetUrl:
            'postgresql://restore_user:secret@restore-db.example.test:5432/playspace_restore_test',
          confirmed: true,
        })
      ).rejects.toThrow('not explicitly allowlisted');
    });
  });

  describe('dedicated advisory lock session behavior', () => {
    let client: {
      on: ReturnType<typeof vi.fn>;
      connect: ReturnType<typeof vi.fn>;
      query: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      client = {
        on: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql.includes('pg_try_advisory_lock')) {
            return { rows: [{ acquired: true }] };
          }
          return { rows: [{ unlocked: true }] };
        }),
        end: vi.fn().mockResolvedValue(undefined),
      };
      pgMocks.Client.mockImplementation(() => client as any);
    });

    it('acquires and releases the advisory lock through the same physical client', async () => {
      const lock = await tryAcquireDedicatedAdvisoryLock({
        connectionString: 'postgresql://user:secret@localhost:5432/playspace_test',
        lockId: 847291048,
        taskName: 'Test retention',
      });

      expect(lock).not.toBeNull();
      expect(client.connect).toHaveBeenCalledOnce();
      expect(client.query).toHaveBeenCalledTimes(1);
      expect(client.query.mock.calls[0][0]).toContain('pg_try_advisory_lock');

      await lock?.release();

      expect(client.query).toHaveBeenCalledTimes(2);
      expect(client.query.mock.calls[1][0]).toContain('pg_advisory_unlock');
      expect(client.end).toHaveBeenCalledOnce();
    });

    it('returns no lock and closes the client when another process owns it', async () => {
      client.query.mockResolvedValueOnce({ rows: [{ acquired: false }] });

      const lock = await tryAcquireDedicatedAdvisoryLock({
        connectionString: 'postgresql://user:secret@localhost:5432/playspace_test',
        lockId: 847291048,
        taskName: 'Test retention',
      });

      expect(lock).toBeNull();
      expect(client.end).toHaveBeenCalledOnce();
    });

    it('rejects transaction-pool URLs before creating a client', async () => {
      await expect(
        tryAcquireDedicatedAdvisoryLock({
          connectionString: 'postgresql://user:secret@localhost:6543/playspace_test',
          lockId: 847291048,
          taskName: 'Test retention',
        })
      ).rejects.toThrow('transaction-pooling configuration');

      expect(pgMocks.Client).not.toHaveBeenCalled();
    });

    it('rejects a failed connection without leaking driver details', async () => {
      client.connect.mockRejectedValueOnce(
        new Error('password=secret-password host=private-db.example.test')
      );

      await expect(
        tryAcquireDedicatedAdvisoryLock({
          connectionString: 'postgresql://user:secret@localhost:5432/playspace_test',
          lockId: 847291048,
          taskName: 'Test retention',
        })
      ).rejects.toThrow('could not acquire the dedicated PostgreSQL advisory lock');

      expect(client.end).toHaveBeenCalledOnce();
    });

    it('fails when PostgreSQL does not confirm advisory-lock release', async () => {
      client.query
        .mockResolvedValueOnce({ rows: [{ acquired: true }] })
        .mockResolvedValueOnce({ rows: [{ unlocked: false }] });

      const lock = await tryAcquireDedicatedAdvisoryLock({
        connectionString: 'postgresql://user:secret@localhost:5432/playspace_test',
        lockId: 847291048,
        taskName: 'Test retention',
      });

      await expect(lock?.release()).rejects.toThrow('advisory-lock release failed');
      expect(client.end).toHaveBeenCalledOnce();
    });
  });

  describe('isolated PostgreSQL backup/restore integration', () => {
    const integrationTest = process.env.RESTORE_TEST_DATABASE_URL ? it : it.skip;

    integrationTest('round-trips real rows and proves failed restores leave the target empty', async () => {
      const targetUrl = process.env.RESTORE_TEST_DATABASE_URL as string;
      const gameId = 'db-restore-it-' + crypto.randomUUID();
      const snapshotPath = path.join(tempDirectory, 'postgres-backup.json');
      const duplicateSnapshotPath = path.join(tempDirectory, 'duplicate-backup.json');
      const targetPrisma = new PrismaClient({ datasources: { db: { url: targetUrl } } });

      try {
        for (const table of BACKUP_TABLES) {
          const delegateName = table.charAt(0).toLowerCase() + table.slice(1);
          const delegate = (targetPrisma as any)[delegateName];
          expect(await delegate.count()).toBe(0);
        }

        await prisma.gameConfiguration.create({
          data: { gameId, isEnabled: true },
        });

        const backup = await createDatabaseBackup({ outputFile: snapshotPath });
        const backedUpConfiguration = backup.data.GameConfiguration.find(
          (record) => record.gameId === gameId
        );
        expect(backedUpConfiguration).toBeDefined();

        const duplicateBackup = structuredClone(backup);
        duplicateBackup.data.GameConfiguration.push({
          ...backedUpConfiguration,
          id: crypto.randomUUID(),
        });
        duplicateBackup.metadata.tableCounts.GameConfiguration += 1;
        duplicateBackup.metadata.totalRecords += 1;
        duplicateBackup.metadata.checksum = crypto
          .createHash('sha256')
          .update(JSON.stringify(duplicateBackup.data))
          .digest('hex');
        fs.writeFileSync(duplicateSnapshotPath, JSON.stringify(duplicateBackup), {
          encoding: 'utf8',
          mode: 0o600,
        });

        await expect(
          restoreDatabaseSnapshot({
            inputFile: duplicateSnapshotPath,
            targetUrl,
            confirmed: true,
          })
        ).rejects.toThrow();

        // A duplicate-key failure must roll the entire serializable transaction back.
        for (const table of BACKUP_TABLES) {
          const delegateName = table.charAt(0).toLowerCase() + table.slice(1);
          const delegate = (targetPrisma as any)[delegateName];
          expect(await delegate.count()).toBe(0);
        }

        const restored = await restoreDatabaseSnapshot({
          inputFile: snapshotPath,
          targetUrl,
          confirmed: true,
        });
        expect(restored.success).toBe(true);
        expect(restored.restoredRecords).toBe(backup.metadata.totalRecords);

        const restoredConfiguration = await targetPrisma.gameConfiguration.findUnique({
          where: { gameId },
        });
        expect(restoredConfiguration).not.toBeNull();

        for (const table of BACKUP_TABLES) {
          const delegateName = table.charAt(0).toLowerCase() + table.slice(1);
          const delegate = (targetPrisma as any)[delegateName];
          expect(await delegate.count()).toBe(backup.metadata.tableCounts[table]);
        }

        await expect(
          restoreDatabaseSnapshot({
            inputFile: snapshotPath,
            targetUrl,
            confirmed: true,
          })
        ).rejects.toThrow('Restore target is not empty');
      } finally {
        await prisma.gameConfiguration.deleteMany({ where: { gameId } });
        await targetPrisma.$disconnect();
      }
    });
  });

});
