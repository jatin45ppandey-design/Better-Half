import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';

export async function checkAccountStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    return next();
  }

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { accountStatus: true },
    });

    if (profile && profile.accountStatus === 'SUSPENDED') {
      res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact platform support.',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }
    next();
  } catch {
    next();
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }

  try {
    const roleRecord = await prisma.appRole.findFirst({
      where: {
        userId,
        role: 'ADMIN',
      },
    });

    if (!roleRecord) {
      res.status(403).json({
        success: false,
        error: 'Access denied. Administrator privileges required.',
        code: 'FORBIDDEN_ADMIN_REQUIRED',
      });
      return;
    }

    next();
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Authorization check failed.' });
  }
}

export async function requireModerator(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }

  try {
    const roleRecord = await prisma.appRole.findFirst({
      where: {
        userId,
        role: { in: ['ADMIN', 'MODERATOR'] },
      },
    });

    if (!roleRecord) {
      res.status(403).json({
        success: false,
        error: 'Access denied. Moderator privileges required.',
        code: 'FORBIDDEN_MODERATOR_REQUIRED',
      });
      return;
    }

    next();
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Authorization check failed.' });
  }
}

