import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation Error',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // 2. Custom Application Errors
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  // 3. Prisma Known Request Errors (without leaking DB secrets or connection strings)
  if (err?.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
    res.status(409).json({
      error: 'Conflict',
      message: `A record with this ${target} already exists.`,
    });
    return;
  }

  if (err?.code === 'P2025') {
    res.status(404).json({
      error: 'Not Found',
      message: 'Requested record does not exist.',
    });
    return;
  }

  if (err?.code === 'P2003') {
    res.status(400).json({
      error: 'Foreign Key Constraint',
      message: 'Referenced user or record does not exist.',
    });
    return;
  }

  // 4. Generic 500 Server Error
  // Log securely without leaking passwords or tokens
  const safeMessage = err instanceof Error ? err.message : String(err);
  console.error('[Internal Error]:', safeMessage);

  res.status(500).json({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred. Please try again later.',
  });
}

