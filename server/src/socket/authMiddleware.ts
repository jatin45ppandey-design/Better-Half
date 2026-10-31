import type { Socket } from 'socket.io';
import { supabase } from '../config/supabase.js';
import { prisma } from '../config/prisma.js';
import { presenceManager } from './presence.js';
import { getInjectedMockAuthVerifier } from '../middleware/auth.js';

export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const token =
    socket.handshake.auth?.token ||
    socket.handshake.auth?.accessToken ||
    (socket.handshake.headers?.authorization?.startsWith('Bearer ')
      ? socket.handshake.headers.authorization.split(' ')[1]
      : null);

  if (!token) {
    return next(new Error('Authentication failed: Missing token in handshake'));
  }

  let userId: string;
  let email: string;

  if (token.startsWith('test-mock-token-')) {
    const mockVerifier = getInjectedMockAuthVerifier();
    if (!mockVerifier) {
      return next(new Error('Authentication failed: Mock tokens are strictly forbidden (no test provider injected)'));
    }
    const mockUser = mockVerifier(token);
    if (!mockUser) {
      return next(new Error('Authentication failed: Mock token rejected by injected test verifier'));
    }
    userId = mockUser.id;
    email = mockUser.email;
  } else {
    try {
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data?.user) {
        return next(new Error('Authentication failed: Invalid, expired, or revoked token'));
      }
      userId = data.user.id;
      email = data.user.email || `${data.user.id}@example.com`;
      socket.data.user = data.user;
    } catch (err: any) {
      return next(new Error(`Authentication error: ${err?.message || 'Unknown error'}`));
    }
  }

  // Account status verification against database
  try {
    const profile = await prisma.userProfile.findUnique({
      where: { id: userId },
      select: { id: true, accountStatus: true },
    });

    if (!profile) {
      return next(new Error('Authentication failed: Profile not found'));
    }

    if (profile.accountStatus === 'SUSPENDED') {
      return next(new Error('Authentication failed: Account has been suspended'));
    }

    socket.data.userId = userId;
    socket.data.email = email;
    socket.data.accountStatus = profile.accountStatus;

    // Extract token expiration if standard JWT
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload && typeof payload.exp === 'number') {
          const expMs = payload.exp * 1000;
          if (Date.now() >= expMs) {
            return next(new Error('Authentication failed: Token has expired'));
          }
          socket.data.tokenExp = expMs;

          // Proactive disconnection when token expires during live connection
          const timeToExpiry = expMs - Date.now();
          if (timeToExpiry > 0) {
            const timer = setTimeout(() => {
              socket.emit('room:error', {
                code: 'TOKEN_EXPIRED',
                message: 'Authentication token has expired. Please re-authenticate.',
              });
              socket.disconnect(true);
            }, timeToExpiry);
            socket.on('disconnect', () => clearTimeout(timer));
          }
        }
      }
    } catch {
      // Non-JWT token (e.g. test token)
    }

    // Load user privacy settings for presence
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
        select: { showOnlineStatus: true, ghostMode: true },
      });
      if (settings) {
        presenceManager.setUserPrivacy(userId, settings);
      }
    } catch {
      // Non-fatal fallback to defaults
    }

    next();
  } catch (_err) {
    return next(new Error('Authentication failed: Account verification service unavailable'));
  }
}
