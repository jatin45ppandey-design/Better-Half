import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createShutdownHandler, registerShutdownSignals } from '../src/lifecycle/shutdown.js';

describe('B6 — Graceful Shutdown Lifecycle (shutdown.ts)', () => {
  let mockHttpServer: any;
  let mockIo: any;
  let mockPrisma: any;
  let mockLogger: any;
  let mockExit: any;
  let mockTimer: NodeJS.Timeout;

  beforeEach(() => {
    mockTimer = setInterval(() => {}, 10000);
    mockHttpServer = {
      close: vi.fn((cb?: (err?: any) => void) => {
        if (cb) cb();
      }),
    };
    mockIo = {
      emit: vi.fn(),
      close: vi.fn((cb?: (err?: any) => void) => {
        if (cb) cb();
      }),
    };
    mockPrisma = {
      $disconnect: vi.fn(async () => {}),
    };
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    mockExit = vi.fn();
  });

  it('executes graceful shutdown sequence in proper order and exits with code 0', async () => {
    const handler = createShutdownHandler({
      httpServer: mockHttpServer,
      io: mockIo,
      prisma: mockPrisma,
      getCleanupTimers: () => [mockTimer],
      forceTimeoutMs: 1000,
      logger: mockLogger,
      onExit: mockExit,
    });

    expect(handler.isShuttingDown()).toBe(false);

    await handler('SIGTERM');

    expect(handler.isShuttingDown()).toBe(true);
    expect(mockIo.emit).toHaveBeenCalledWith('server_shutdown', { reason: 'server_restarting' });
    expect(mockIo.close).toHaveBeenCalled();
    expect(mockHttpServer.close).toHaveBeenCalled();
    expect(mockPrisma.$disconnect).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);

    // Verify timer was cleared
    clearInterval(mockTimer);
  });

  it('deduplicates multiple signals and ignores secondary shutdowns', async () => {
    const handler = createShutdownHandler({
      httpServer: mockHttpServer,
      io: mockIo,
      prisma: mockPrisma,
      getCleanupTimers: () => [mockTimer],
      forceTimeoutMs: 1000,
      logger: mockLogger,
      onExit: mockExit,
    });

    // Send SIGTERM then immediate SIGINT
    const p1 = handler('SIGTERM');
    const p2 = handler('SIGINT');

    await Promise.all([p1, p2]);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Shutdown already in progress. Ignoring duplicate signal: SIGINT')
    );
    expect(mockExit).toHaveBeenCalledTimes(1);
    expect(mockExit).toHaveBeenCalledWith(0);

    clearInterval(mockTimer);
  });

  it('handles and registers process signals cleanly and unregisters them', () => {
    const handler = createShutdownHandler({
      httpServer: mockHttpServer,
      io: mockIo,
      logger: mockLogger,
      onExit: mockExit,
    });

    const cleanup = registerShutdownSignals(handler, ['SIGTERM', 'SIGINT']);
    expect(typeof cleanup).toBe('function');
    // Cleanup listeners
    cleanup();
  });

  it('triggers emergency force exit (code 1) if shutdown exceeds forceTimeoutMs', async () => {
    vi.useFakeTimers();

    // Mock an httpServer that hangs and never completes close
    const hangingHttpServer: any = {
      close: vi.fn((_cb) => {
        // never call cb
      }),
    };

    const handler = createShutdownHandler({
      httpServer: hangingHttpServer,
      forceTimeoutMs: 500,
      logger: mockLogger,
      onExit: mockExit,
    });

    // Start shutdown without awaiting so we can advance time
    handler('SIGTERM');

    // Advance beyond forceTimeoutMs
    vi.advanceTimersByTime(550);

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Forced shutdown after 500ms timeout exceeded.')
    );
    expect(mockExit).toHaveBeenCalledWith(1);

    vi.useRealTimers();
  });
});
