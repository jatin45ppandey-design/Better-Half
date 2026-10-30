import { prisma } from '../../config/prisma.js';

export interface AuditLogOptions {
  action?: string;
  actorUserId?: string;
  targetType?: string;
  cursor?: string;
  limit?: number;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accesstoken',
  'refreshtoken',
  'secret',
  'answer',
  'answers',
  'answertext',
  'apikey',
  'privatekey',
  'sessiontoken',
]);

/**
 * Recursively redacts sensitive values from audit log metadata.
 */
function sanitizeAuditMetadata(meta: any, depth = 0): any {
  if (!meta || typeof meta !== 'object' || depth > 5) return meta;
  if (Array.isArray(meta)) {
    return meta.map((item) => sanitizeAuditMetadata(item, depth + 1));
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeAuditMetadata(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export class AuditService {
  async logAction(
    actorUserId: string | null,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata?: Record<string, any>,
    tx?: any
  ): Promise<void> {
    const db = tx || prisma;
    const sanitized = sanitizeAuditMetadata(metadata);
    await db.auditLog.create({
      data: {
        actorUserId,
        action,
        targetType,
        targetId,
        metadata: sanitized ? (sanitized as any) : undefined,
      },
    });
  }

  async listAuditLogs(options: AuditLogOptions = {}) {
    const limit = Math.min(Math.max(options.limit || 25, 1), 100);

    const where: any = {};
    if (options.action) where.action = options.action;
    if (options.actorUserId) where.actorUserId = options.actorUserId;
    if (options.targetType) where.targetType = options.targetType;

    const logs = await prisma.auditLog.findMany({
      where,
      take: limit + 1,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = logs.length > limit;
    const items = hasMore ? logs.slice(0, limit) : logs;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      logs: items,
      nextCursor,
      hasMore,
    };
  }

  async getAuditLogById(id: string) {
    const log = await prisma.auditLog.findUnique({
      where: { id },
    });
    if (!log) throw new Error('Audit log record not found.');
    return log;
  }
}

export const auditService = new AuditService();

