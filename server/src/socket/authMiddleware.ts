import type { Socket } from 'socket.io';
import { supabase } from '../config/supabase.js';
import { prisma } from '../config/prisma.js';

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

  // Fast-path test token for automated testing
  if (process.env.NODE_ENV === 'test' && token.startsWith('test-mock-token-')) {
    const testUserId = token.replace('test-mock-token-', '');
    socket.data.userId = testUserId;
    socket.data.email = `${testUserId}@example.com`;

    try {
      const profile = await prisma.userProfile.findUnique({
        where: { id: testUserId },
        select: { accountStatus: true },
      });
      if (profile && profile.accountStatus === 'SUSPENDED') {
        return next(new Error('Authentication failed: Account has been suspended'));
      }
    } catch {
      // Continue in isolated tests
    }

    return next();
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return next(new Error('Authentication failed: Invalid, expired, or revoked token'));
    }

    // Verify account status
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { id: data.user.id },
        select: { accountStatus: true },
      });
      if (profile && profile.accountStatus === 'SUSPENDED') {
        return next(new Error('Authentication failed: Account has been suspended'));
      }
    } catch {
      // Continue if DB unavailable
    }

    socket.data.userId = data.user.id;
    socket.data.email = data.user.email;
    socket.data.user = data.user;
    next();
  } catch (err: any) {
    return next(new Error(`Authentication error: ${err?.message || 'Unknown error'}`));
  }
}

