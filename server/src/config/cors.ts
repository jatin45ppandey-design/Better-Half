import { env } from './env.js';

/**
 * Validates whether an incoming HTTP or WebSocket origin is permitted.
 * - Non-browser clients (no origin) are allowed.
 * - Production strictly allows only explicitly configured frontend origins.
 * - Development and test allow configured origins plus local development hosts.
 * - Unknown browser origins are strictly rejected.
 */
export function isOriginAllowed(origin?: string): boolean {
  if (!origin) {
    // Allow non-browser clients (e.g. mobile apps, curl, server-to-server)
    return true;
  }

  const configuredOrigins = [env.FRONTEND_URL].filter(Boolean);

  if (env.NODE_ENV === 'production') {
    return configuredOrigins.includes(origin);
  }

  // Development and test origins
  const devAllowedOrigins = [
    ...configuredOrigins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  return devAllowedOrigins.includes(origin);
}

