export interface LogMetadata {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  roomId?: string;
  [key: string]: any;
}

export const SENSITIVE_LOG_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'answer',
  'answers',
  'answertext',
  'unrevealedanswer',
  'apikey',
  'privatekey',
  'sessiontoken',
  'authorization',
  'cookie',
  'credential',
]);

/**
 * Recursively redacts sensitive values from log metadata.
 * Prevents credential leakage and protects sensitive in-game data
 * such as Between Us answers and unrevealed prompts.
 */
export function sanitizeLogMetadata(meta: any, depth = 0): any {
  if (!meta || typeof meta !== 'object' || depth > 5) return meta;
  if (Array.isArray(meta)) {
    return meta.map((item) => sanitizeLogMetadata(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_LOG_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeLogMetadata(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class Logger {
  private format(level: string, message: string, meta?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const sanitized = meta ? sanitizeLogMetadata(meta) : undefined;

    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...(sanitized || {}),
      });
    }

    const metaStr = sanitized ? ` ${JSON.stringify(sanitized)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  info(message: string, meta?: LogMetadata): void {
    if (process.env.NODE_ENV !== 'test') {
      console.log(this.format('info', message, meta));
    }
  }

  warn(message: string, meta?: LogMetadata): void {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(this.format('warn', message, meta));
    }
  }

  error(message: string, meta?: LogMetadata): void {
    console.error(this.format('error', message, meta));
  }

  debug(message: string, meta?: LogMetadata): void {
    if (process.env.DEBUG || process.env.NODE_ENV === 'development') {
      console.debug(this.format('debug', message, meta));
    }
  }

  formatOutput(level: string, message: string, meta?: LogMetadata): string {
    return this.format(level, message, meta);
  }
}

export const logger = new Logger();
