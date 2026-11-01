import http from 'node:http';
import { createApp } from './app.js';
import { assertValidEnvironment } from './config/envValidator.js';
import { env } from './config/env.js';

// Fail fast before accepting traffic if mandatory production configuration is missing or invalid
assertValidEnvironment();

// Strict single-instance deployment enforcement:
// PlaySpace uses in-memory presence and room state. Scaling horizontally across multiple
// Node instances without a distributed Redis adapter would cause split-brain room state.
if (
  process.env.CLUSTER_MODE === 'true' ||
  (process.env.NODE_APP_INSTANCE !== undefined && process.env.NODE_APP_INSTANCE !== '0') ||
  (process.env.WEB_CONCURRENCY !== undefined && Number(process.env.WEB_CONCURRENCY) > 1)
) {
  const errMsg =
    '❌ [FATAL SCALING CONSTRAINT] Multiple Node cluster instances detected without distributed Socket.IO Redis adapter.\n' +
    '   PlaySpace authoritatively operates as a single-instance deployment (e.g. Render Web Service).\n' +
    '   Horizontal multi-instance scaling requires Redis adapter for Socket.IO and distributed rate limiting.\n' +
    '   Aborting startup to prevent split-brain room state, desynced presence, and uncoordinated timers.';
  console.error(errMsg);
  if (env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

import { prisma } from './config/prisma.js';
import { createSocketServer } from './socket/index.js';
import { gameSessionService } from './modules/games/core/gameSession.service.js';
import { roomsService } from './modules/rooms/rooms.service.js';
import { adminService } from './modules/admin/admin.service.js';
import { seedPlatformDefaults } from './lifecycle/bootstrapData.js';
import { createShutdownHandler, registerShutdownSignals } from './lifecycle/shutdown.js';
import { acquireInstanceLock, type InstanceLockHandle } from './lifecycle/instanceLock.js';
import { presenceManager } from './socket/presence.js';
import { cleanupSnatchTimers } from './socket/gameHandlers.js';
import { gameStateService } from './modules/games/core/gameState.service.js';
import { resetSocketRateLimits } from './socket/roomHandlers.js';
import { resetRoomLookupTracker } from './middleware/rateLimiter.js';
import { markServerShuttingDown } from './modules/health/health.controller.js';

const app = createApp();
const httpServer = http.createServer(app);
const io = createSocketServer(httpServer);
app.set('io', io);

const PORT = env.PORT;
const HOST = '0.0.0.0';

let cleanupTimer: NodeJS.Timeout | null = null;
let instanceLockHandle: InstanceLockHandle | null = null;

async function bootstrap() {
  // Acquire authoritative single-instance database lease BEFORE opening traffic
  if (env.NODE_ENV === 'production') {
    if (!env.DIRECT_URL) {
      console.error('❌ [FATAL DEPLOYMENT CONSTRAINT] DIRECT_URL must be configured for session-affine advisory lock in production.');
      process.exit(1);
    }
    instanceLockHandle = await acquireInstanceLock(env.DIRECT_URL);
  }

  // Seed the catalog before accepting API traffic. The upserts are idempotent
  // and preserve administrator edits; production fails closed if the required
  // content/configuration cannot be initialized.
  try {
    await seedPlatformDefaults();
    console.log('🎮 Platform game configuration and question library are ready.');
  } catch (err) {
    console.warn('Could not initialize platform game configuration/content:', err);
    if (env.NODE_ENV === 'production') {
      throw err;
    }
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`===============================================`);
    console.log(`🎮 PlaySpace API + Socket.IO Server running in ${env.NODE_ENV} mode`);
    console.log(`📡 URL: http://${HOST}:${PORT}/api/v1`);
    console.log(`🔌 Socket.IO: http://${HOST}:${PORT}`);
    console.log(`🩺 Health: http://${HOST}:${PORT}/api/v1/health`);
    console.log(`🗄️ Ready:  http://${HOST}:${PORT}/api/v1/ready`);
    console.log(`===============================================`);

    // Restore any active or paused sessions from DB on startup (bounded)
    gameSessionService.restoreActiveSessions().then((count) => {
      if (count > 0) {
        console.log(`🔄 Restored ${count} active/paused game session(s) from database.`);
      }
    }).catch((err) => {
      console.warn('Could not restore sessions on startup:', err);
    });

    // Periodic idempotent cleanup of expired rooms and invitations (every 5 minutes)
    const EXPIRY_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
    const runCleanup = async () => {
      try {
        const { expiredCount } = await roomsService.cleanupExpiredRooms();
        if (expiredCount > 0) {
          console.log(`🧹 Cleaned up ${expiredCount} expired room(s).`);
        }
      } catch (err) {
        console.warn('Expired rooms cleanup task error:', err);
      }
    };

    runCleanup();
    cleanupTimer = setInterval(runCleanup, EXPIRY_CLEANUP_INTERVAL_MS);
    cleanupTimer.unref();
  });

  // Robust graceful shutdown handling with domain cleanup lifecycle
  const shutdownHandler = createShutdownHandler({
    httpServer,
    io,
    prisma,
    getCleanupTimers: () => [cleanupTimer],
    cleanupCallbacks: [
      () => markServerShuttingDown(),
      () => presenceManager.shutdown(),
      () => cleanupSnatchTimers(),
      () => gameStateService.shutdown(),
      () => resetSocketRateLimits(),
      () => resetRoomLookupTracker(),
      async () => {
        if (instanceLockHandle) {
          await instanceLockHandle.release();
        }
      },
    ],
    forceTimeoutMs: 10000,
  });

  registerShutdownSignals(shutdownHandler);
}

bootstrap().catch((err) => {
  console.error('❌ [FATAL] Server bootstrap failed:', err);
  process.exit(1);
});
