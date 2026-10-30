export interface LogMetadata {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  roomId?: string;
  [key: string]: any;
}

export class Logger {
  private format(level: string, message: string, meta?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
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
}

export const logger = new Logger();

