import pg from 'pg';

export const ADVISORY_LOCK_ID = 583920192;

export interface InstanceLockHandle {
  client: pg.Client;
  release: () => Promise<void>;
}

/**
 * Acquires an authoritative single-instance advisory lock over a dedicated,
 * session-affine PostgreSQL connection using DIRECT_URL (bypassing transaction poolers).
 */
export async function acquireInstanceLock(directUrl: string): Promise<InstanceLockHandle> {
  const client = new pg.Client({ connectionString: directUrl });
  let isReleased = false;

  client.on('error', (err) => {
    if (isReleased) return;
    console.error('❌ [FATAL] Dedicated database lock connection error/lost:', err);
    process.exit(1);
  });

  client.on('end', () => {
    if (isReleased) return;
    console.error('❌ [FATAL] Dedicated database lock connection closed unexpectedly.');
    process.exit(1);
  });

  try {
    await client.connect();
    const res = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [ADVISORY_LOCK_ID]);
    const acquired = Boolean(res.rows[0]?.acquired);

    if (!acquired) {
      console.error(
        '❌ [FATAL DEPLOYMENT CONSTRAINT] Another PlaySpace server instance is already running against this database.\n' +
        '   Single-instance mode is strictly enforced. Multiple instances cannot run concurrently\n' +
        '   without a distributed Socket.IO Redis adapter.\n' +
        '   Terminating this process to prevent split-brain room state and desynced presence.'
      );
      isReleased = true;
      await client.end().catch(() => {});
      process.exit(1);
    }

    console.log('🔒 Authoritative single-instance database lease acquired via dedicated PostgreSQL session.');

    return {
      client,
      release: async () => {
        if (isReleased) return;
        isReleased = true;
        try {
          await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]);
          console.log('🔓 Single-instance database lease released.');
        } catch (err: any) {
          console.warn('Warning during advisory unlock:', err?.message || err);
        } finally {
          await client.end().catch(() => {});
        }
      },
    };
  } catch (err: any) {
    isReleased = true;
    console.error('❌ [FATAL] Failed to establish dedicated database lock connection:', err?.message || err);
    await client.end().catch(() => {});
    process.exit(1);
  }
}

