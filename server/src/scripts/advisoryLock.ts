import pg from 'pg';

export interface DedicatedAdvisoryLockHandle {
  release(): Promise<void>;
}

export interface DedicatedAdvisoryLockOptions {
  connectionString: string;
  lockId: number;
  taskName: string;
}

/**
 * Holds a session-level PostgreSQL advisory lock on one dedicated physical
 * connection. A Prisma pool backed by transaction pooling cannot guarantee
 * session affinity for this lock.
 */
export async function tryAcquireDedicatedAdvisoryLock(
  options: DedicatedAdvisoryLockOptions
): Promise<DedicatedAdvisoryLockHandle | null> {
  const { connectionString, lockId, taskName } = options;
  if (!connectionString) {
    throw new Error(`${taskName}: DIRECT_URL is required; refusing to run without a dedicated lock connection.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error(`${taskName}: DIRECT_URL is not a valid PostgreSQL URL.`);
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`${taskName}: DIRECT_URL must use postgres: or postgresql:.`);
  }
  if (parsed.port === '6543' || parsed.searchParams.get('pgbouncer')?.toLowerCase() === 'true') {
    throw new Error(
      `${taskName}: DIRECT_URL points to a transaction-pooling configuration. A session-affine connection is required.`
    );
  }

  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  let lockHeld = false;
  let closing = false;
  const failClosedOnConnectionLoss = (reason: string) => {
    if (!lockHeld || closing) return;
    console.error(`❌ [FATAL] ${taskName} advisory-lock connection lost (${reason}). Terminating to prevent concurrent execution.`);
    process.exit(1);
  };

  client.on('error', (error) => {
    // Avoid logging the driver error object, which may include connection details.
    failClosedOnConnectionLoss(error?.message || 'PostgreSQL client error');
  });
  client.on('end', () => failClosedOnConnectionLoss('connection ended unexpectedly'));

  try {
    await client.connect();
    const result = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [lockId]
    );

    if (result.rows[0]?.acquired !== true) {
      closing = true;
      await client.end();
      return null;
    }

    lockHeld = true;
    console.log(`🔒 ${taskName} advisory lock acquired on a dedicated PostgreSQL session.`);

    return {
      release: async () => {
        if (closing) return;
        closing = true;

        let releaseError: unknown;
        try {
          const result = await client.query<{ unlocked: boolean }>(
            'SELECT pg_advisory_unlock($1) AS unlocked',
            [lockId]
          );
          if (result.rows[0]?.unlocked !== true) {
            throw new Error('PostgreSQL did not confirm advisory-lock release.');
          }
        } catch (error) {
          releaseError = error;
        }

        try {
          await client.end();
        } catch (error) {
          releaseError ??= error;
        } finally {
          lockHeld = false;
        }

        if (releaseError) {
          // Closing this owning session releases any session-level locks it still owns.
          throw new Error(`${taskName}: advisory-lock release failed; the owning connection was closed.`);
        }
        console.log(`🔓 ${taskName} advisory lock released.`);
      },
    };
  } catch {
    closing = true;
    await client.end().catch(() => {});
    throw new Error(`${taskName}: could not acquire the dedicated PostgreSQL advisory lock; operation aborted.`);
  }
}
