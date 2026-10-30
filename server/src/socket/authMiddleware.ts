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

  let userId: string;
  let email: string;

  if (process.env.NODE_ENV === 'test' && token.startsWith('test-mock-token-')) {
    userId = token.replace('test-mock-token-', '');
    email = `${userId}@example.com`;
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
    next();
  } catch (_err) {
    return next(new Error('Authentication failed: Account verification service unavailable'));
  }
}
