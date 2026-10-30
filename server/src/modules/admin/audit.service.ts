import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';

export interface AuditLogOptions {
  action?: string;
  actorUserId?: string;
  targetType?: string;
  cursor?: string;
  limit?: number;
}

function sanitizeAuditMetadata(meta: any): any {
  if (!meta || typeof meta !== 'object') return meta;
  const sanitized = { ...meta };
  delete sanitized.password;
  delete sanitized.token;
  delete sanitized.secret;
  delete sanitized.answerText;
  delete sanitized.answer;
  delete sanitized.answers;
  return sanitized;
}

export class AuditService {
  async logAction(
    actorUserId: string | null,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const sanitized = sanitizeAuditMetadata(metadata);
      await prisma.auditLog.create({
        data: {
          actorUserId,
          action,
          targetType,
          targetId,
          metadata: sanitized ? (sanitized as any) : undefined,
        },
      });
    } catch (err: any) {
      logger.warn(`Failed to create audit log entry: ${err?.message || err}`);
    }
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

