import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';

let serverIsShuttingDown = false;

export function markServerShuttingDown(): void {
  serverIsShuttingDown = true;
}

export function resetServerShuttingDown(): void {
  serverIsShuttingDown = false;
}

export function isServerShuttingDown(): boolean {
  return serverIsShuttingDown;
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'ok',
    service: 'playspace-api',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}

export async function getReadiness(_req: Request, res: Response): Promise<void> {
  if (serverIsShuttingDown) {
    res.status(503).json({
      status: 'shutting_down',
      database: 'draining',
      message: 'Server is undergoing graceful shutdown and not accepting new traffic.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  try {
    // Verify database connectivity safely with a 2-second timeout
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database check timeout')), 2000)
    );
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);

    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Do not leak database credentials, hosts, or connection errors
    res.status(503).json({
      status: 'degraded',
      database: 'disconnected',
      message: 'Database connection is unavailable or not yet configured.',
    });
  }
}
