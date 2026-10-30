import http from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { createSocketServer } from './socket/index.js';
import { gameSessionService } from './modules/games/core/gameSession.service.js';

const app = createApp();
const httpServer = http.createServer(app);
const io = createSocketServer(httpServer);
app.set('io', io);

const PORT = env.PORT;
const HOST = '0.0.0.0';

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
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);

  // Close socket server
  io.close(() => {
    console.log('Socket.IO server closed.');
  });

  // Close HTTP server
  httpServer.close(async () => {
    console.log('HTTP server closed.');
    try {
      await prisma.$disconnect();
      console.log('Prisma disconnected.');
    } catch (err) {
      console.error('Error disconnecting Prisma:', err);
    }
    process.exit(0);
  });

  // Force close after 10s
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
