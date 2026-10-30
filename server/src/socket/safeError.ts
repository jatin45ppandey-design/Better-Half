import { AppError } from '../utils/errors.js';

/**
 * Expose only deliberate application errors to Socket.IO clients.
 * Unexpected Prisma/runtime exceptions are replaced with the operation fallback.
 */
export function safeSocketError(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (
    error instanceof Error &&
    (error.message === 'Room not found' || error.message === 'Game session not found.')
  ) {
    return error.message;
  }
  return fallback;
}
