import type http from 'node:http';

export interface ShutdownLogger {
  info: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
}

export interface ShutdownDependencies {
  httpServer?: http.Server;
  io?: {
    emit?: (...args: any[]) => any;
    close: (callback?: (err?: any) => void) => void;
  };
  prisma?: {
    $disconnect: () => Promise<void>;
  };
  getCleanupTimers?: () => Array<NodeJS.Timeout | null | undefined>;
  cleanupCallbacks?: Array<() => Promise<void> | void>;
  forceTimeoutMs?: number;
  logger?: ShutdownLogger;
  onExit?: (code: number) => void;
}

export interface ShutdownHandler {
  (signal: string): Promise<void>;
  isShuttingDown: () => boolean;
}

/**
 * Creates an idempotent, robust graceful shutdown handler for PlaySpace.
 * Ensures HTTP connections drain, Socket.IO clients are notified and disconnected,
 * background timers are cleared, and the database pool is safely disconnected.
 */
export function createShutdownHandler(deps: ShutdownDependencies): ShutdownHandler {
  const {
    httpServer,
    io,
    prisma,
    getCleanupTimers,
    cleanupCallbacks,
    forceTimeoutMs = 10000,
    logger = console,
    onExit = (code: number) => process.exit(code),
  } = deps;

  let shuttingDown = false;

  const handler = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      logger.warn(`Shutdown already in progress. Ignoring duplicate signal: ${signal}`);
      return;
    }
    shuttingDown = true;
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);

    // Safety fallback: force exit if shutdown hangs beyond the timeout threshold
    const forceTimer = setTimeout(() => {
      logger.error(`Forced shutdown after ${forceTimeoutMs}ms timeout exceeded.`);
      onExit(1);
    }, forceTimeoutMs);

    if (typeof forceTimer.unref === 'function') {
      forceTimer.unref();
    }

    try {
      // 1. Run all registered domain cleanup callbacks (timers, presence, rate-limits)
      if (cleanupCallbacks && cleanupCallbacks.length > 0) {
        for (const cb of cleanupCallbacks) {
          try {
            await cb();
          } catch (err) {
            logger.warn('Error in shutdown cleanup callback:', err);
          }
        }
        logger.info('Registered cleanup callbacks executed.');
      }

      // 2. Clear background intervals and scheduled cleanup tasks
      if (getCleanupTimers) {
        const timers = getCleanupTimers();
        for (const timer of timers) {
          if (timer) {
            clearInterval(timer);
          }
        }
        logger.info('Background cleanup timers cleared.');
      }

      // 3. Notify connected Socket.IO clients and close WebSocket server
      if (io) {
        try {
          if (typeof io.emit === 'function') {
            io.emit('server_shutdown', { reason: 'server_restarting' });
          }
        } catch (err) {
          logger.warn('Failed to emit shutdown message to sockets:', err);
        }

        await new Promise<void>((resolve) => {
          io.close((err) => {
            if (err) {
              logger.warn('Error while closing Socket.IO server:', err);
            } else {
              logger.info('Socket.IO server closed.');
            }
            resolve();
          });
        });
      }

      // 4. Stop accepting new HTTP connections and finish in-flight requests
      if (httpServer) {
        await new Promise<void>((resolve) => {
          httpServer.close((err) => {
            if (err) {
              logger.warn('Error while closing HTTP server:', err);
            } else {
              logger.info('HTTP server closed.');
            }
            resolve();
          });
        });
      }

      // 5. Safely disconnect Prisma database connection pool
      if (prisma) {
        try {
          await prisma.$disconnect();
          logger.info('Prisma database connection pool disconnected.');
        } catch (err) {
          logger.error('Error disconnecting Prisma:', err);
        }
      }

      clearTimeout(forceTimer);
      logger.info('Graceful shutdown completed successfully.');
      onExit(0);
    } catch (fatalErr) {
      clearTimeout(forceTimer);
      logger.error('Fatal error during graceful shutdown:', fatalErr);
      onExit(1);
    }
  };

  (handler as ShutdownHandler).isShuttingDown = () => shuttingDown;

  return handler as ShutdownHandler;
}

/**
 * Registers process signal listeners for the shutdown handler.
 * Returns an unregister callback to cleanly detach listeners.
 */
export function registerShutdownSignals(
  handler: ShutdownHandler,
  signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT']
): () => void {
  const listeners: Array<{ signal: NodeJS.Signals; fn: () => void }> = [];

  for (const signal of signals) {
    const fn = () => {
      handler(signal).catch((err) => {
        console.error(`Unhandled error during ${signal} shutdown:`, err);
      });
    };
    process.on(signal, fn);
    listeners.push({ signal, fn });
  }

  return () => {
    for (const { signal, fn } of listeners) {
      process.removeListener(signal, fn);
    }
  };
}
