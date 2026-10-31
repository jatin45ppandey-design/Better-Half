import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { createSocketServer } from './socket/index.js';
import { gameSessionService } from './modules/games/core/gameSession.service.js';
import { roomsService } from './modules/rooms/rooms.service.js';
import { adminService } from './modules/admin/admin.service.js';
import { createShutdownHandler, registerShutdownSignals } from './lifecycle/shutdown.js';

const app = createApp();
const httpServer = http.createServer(app);
const io = createSocketServer(httpServer);
app.set('io', io);

const PORT = env.PORT;
const HOST = '0.0.0.0';

let cleanupTimer: NodeJS.Timeout | null = null;

httpServer.listen(PORT, HOST, () => {
  console.log(`===============================================`);
  console.log(`🎮 PlaySpace API + Socket.IO Server running in ${env.NODE_ENV} mode`);
  console.log(`📡 URL: http://${HOST}:${PORT}/api/v1`);
  console.log(`🔌 Socket.IO: http://${HOST}:${PORT}`);
  console.log(`🩺 Health: http://${HOST}:${PORT}/api/v1/health`);
  console.log(`🗄️ Ready:  http://${HOST}:${PORT}/api/v1/ready`);
  console.log(`===============================================`);

  // Restore any active or paused sessions from DB on startup
  gameSessionService.restoreActiveSessions().then((count) => {
    if (count > 0) {
      console.log(`🔄 Restored ${count} active/paused game session(s) from database.`);
    }
  }).catch((err) => {
    console.warn('Could not restore sessions on startup:', err);
  });

  // Seed default game configurations if unseeded
  prisma.gameConfiguration.count().then((count) => {
    if (count === 0) {
      adminService.seedInitialGameConfigs().then(() => {
        console.log('🎮 Seeded initial game configurations.');
      }).catch((err) => {
        console.warn('Could not seed game configurations on startup:', err);
      });
    }
  }).catch((err) => {
    console.warn('Could not check game configuration count on startup:', err);
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

// Robust graceful shutdown handling
const shutdownHandler = createShutdownHandler({
  httpServer,
  io,
  prisma,
  getCleanupTimers: () => [cleanupTimer],
  forceTimeoutMs: 10000,
});

registerShutdownSignals(shutdownHandler);
