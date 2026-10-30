import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive in dev, or can restrict if needed
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // Request body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Development logger (redacts authorization headers and passwords)
  if (env.NODE_ENV === 'development') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  // API Routes mounted under /api/v1
  app.use('/api/v1', apiRouter);

  // Catch-all 404 handler for unmatched API routes
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Cannot ${req.method} ${req.originalUrl}`,
    });
  });

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}

