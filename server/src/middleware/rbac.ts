import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma.js';

export async function checkAccountStatus(
  req: Request,
  res: Response,
  next: NextFunction,
  options: { allowMissingProfile?: boolean } = {}
): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) {
    return next();
  }

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { id: true, accountStatus: true, username: true, displayName: true },
    });

    if (!profile) {
      // A newly authenticated Google user must be allowed through only the
      // dedicated GET /profiles/me bootstrap route so its profile can be created.
      // All other authenticated endpoints continue to fail closed.
      if (options.allowMissingProfile) {
        next();
        return;
      }

      res.status(403).json({
        success: false,
        error: 'User profile not found. Access denied.',
        code: 'PROFILE_NOT_FOUND',
      });
      return;
    }

    if (profile.accountStatus === 'SUSPENDED') {
      res.status(403).json({
        success: false,
        error: 'Your account has been suspended. Please contact platform support.',
        code: 'ACCOUNT_SUSPENDED',
      });
      return;
    }

    (req as any).userProfile = profile;
    next();
  } catch (_err: any) {
    res.status(503).json({
      success: false,
      error: 'Account verification service unavailable. Please retry.',
      code: 'DATABASE_UNAVAILABLE',
    });
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

