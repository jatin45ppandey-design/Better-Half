import { prisma } from '../../config/prisma.js';
import { NotFoundError, ConflictError, ForbiddenError, AppError } from '../../utils/errors.js';

export class FriendsService {
  /**
   * List all confirmed friends of the user
   */
  async listFriends(userId: string) {
    const friendships = await prisma.friendship.findMany({
      where: { userId },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            avatarInitials: true,
            avatarColor: true,
            bio: true,
            settings: {
              select: {
                showOnlineStatus: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return friendships.map((f) => ({
      id: f.friend.id,
      username: f.friend.username,
      displayName: f.friend.displayName,
      avatarUrl: f.friend.avatarUrl,
      avatarInitials: f.friend.avatarInitials,
      avatarColor: f.friend.avatarColor,
      bio: f.friend.bio,
      showOnlineStatus: f.friend.settings?.showOnlineStatus ?? true,
      since: f.createdAt,
    }));
  }

  /**
   * List pending friend requests (both incoming and outgoing)
   */
  async listRequests(userId: string) {
    const [incoming, outgoing] = await Promise.all([
      prisma.friendRequest.findMany({
        where: {
          receiverId: userId,
          status: 'PENDING',
        },
        include: {
          sender: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              avatarInitials: true,
              avatarColor: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendRequest.findMany({
        where: {
          senderId: userId,
          status: 'PENDING',
        },
        include: {
          receiver: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              avatarInitials: true,
              avatarColor: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      incoming: incoming.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.sender,
      })),
      outgoing: outgoing.map((r) => ({
        id: r.id,
        createdAt: r.createdAt,
        user: r.receiver,
      })),
    };
  }

  /**
   * Send a friend request by receiverId or username
   */
  async sendRequest(senderId: string, input: { receiverId?: string; username?: string }) {
    let targetUserId = input.receiverId;

    if (!targetUserId && input.username) {
      const cleanUsername = input.username.startsWith('@')
        ? input.username.slice(1)
        : input.username;

      const target = await prisma.userProfile.findFirst({
        where: {
          username: {
            equals: cleanUsername,
            mode: 'insensitive',
          },
        },
      });

      if (!target) {
        throw new NotFoundError(`User '@${cleanUsername}' not found`);
      }
      targetUserId = target.id;
    }

    if (!targetUserId) {
      throw new AppError('Target user must be specified');
    }

    // 1. Prevent self-requests
    if (senderId === targetUserId) {
      throw new AppError('You cannot send a friend request to yourself');
    }

    // 2. Prevent blocked interactions
    const block = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedUserId: targetUserId },
          { blockerId: targetUserId, blockedUserId: senderId },
        ],
      },
    });

    if (block) {
      throw new ForbiddenError('Unable to send friend request to this user');
    }

    // 3. Prevent duplicate friendship
    const alreadyFriends = await prisma.friendship.findFirst({
      where: {
        userId: senderId,
        friendId: targetUserId,
      },
    });

    if (alreadyFriends) {
      throw new ConflictError('You are already friends with this user');
    }

    // 4. Check opposite direction pending request
    const oppositeRequest = await prisma.friendRequest.findFirst({
      where: {
        senderId: targetUserId,
        receiverId: senderId,
        status: 'PENDING',
      },
    });

    if (oppositeRequest) {
      // Automatically accept in a transaction with race-safe conditional update!
      return prisma.$transaction(async (tx) => {
        const updateOpposite = await tx.friendRequest.updateMany({
          where: { id: oppositeRequest.id, status: 'PENDING' },
          data: { status: 'ACCEPTED' },
        });

        if (updateOpposite.count === 0) {
          throw new ConflictError('Mutual friend request status changed concurrently.');
        }

        await tx.friendship.createMany({
          data: [
            { userId: senderId, friendId: targetUserId },
            { userId: targetUserId, friendId: senderId },
          ],
          skipDuplicates: true,
        });

        return {
          status: 'ACCEPTED_MUTUAL',
          message: 'Mutual friend request detected and connected automatically',
        };
      });
    }

    // 5. Check if request already pending
    const existing = await prisma.friendRequest.findFirst({
      where: {
        senderId,
        receiverId: targetUserId,
      },
    });

    if (existing) {
      if (existing.status === 'PENDING') {
        throw new ConflictError('Friend request is already pending');
      }

      // Re-open rejected / cancelled request
      const updated = await prisma.friendRequest.update({
        where: { id: existing.id },
        data: { status: 'PENDING' },
      });

      return {
        id: updated.id,
        status: updated.status,
        message: 'Friend request sent',
      };
    }

    const created = await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId: targetUserId,
        status: 'PENDING',
      },
    });

    return {
      id: created.id,
      status: created.status,
      message: 'Friend request sent',
    };
  }

  /**
   * Accept an incoming friend request
   */
  async acceptRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundError('Friend request not found');
    }

    if (request.receiverId !== userId) {
      throw new ForbiddenError('You can only accept requests addressed to you');
    }

    if (request.status !== 'PENDING') {
      throw new AppError(`Cannot accept a request with status ${request.status}`);
    }

    return prisma.$transaction(async (tx) => {
      // Conditional atomic status check: only proceed if status is still PENDING
      const updateResult = await tx.friendRequest.updateMany({
        where: { id: requestId, receiverId: userId, status: 'PENDING' },
        data: { status: 'ACCEPTED' },
      });

      if (updateResult.count === 0) {
        throw new ConflictError('Friend request is no longer pending or has already been resolved.');
      }

      await tx.friendship.createMany({
        data: [
          { userId: request.senderId, friendId: request.receiverId },
          { userId: request.receiverId, friendId: request.senderId },
        ],
        skipDuplicates: true,
      });

      return { success: true, message: 'Friend request accepted' };
    });
  }

  /**
   * Reject an incoming friend request
   */
  async rejectRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundError('Friend request not found');
    }

    if (request.receiverId !== userId) {
      throw new ForbiddenError('You can only reject requests addressed to you');
    }

    const updateResult = await prisma.friendRequest.updateMany({
      where: { id: requestId, receiverId: userId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });

    if (updateResult.count === 0) {
      throw new ConflictError('Friend request is no longer pending or has already been resolved.');
    }

    return { success: true, message: 'Friend request declined' };
  }

  /**
   * Cancel an outgoing friend request
   */
  async cancelRequest(userId: string, requestId: string) {
    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundError('Friend request not found');
    }

    if (request.senderId !== userId) {
      throw new ForbiddenError('You can only cancel requests you created');
    }

    const updateResult = await prisma.friendRequest.updateMany({
      where: { id: requestId, senderId: userId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    if (updateResult.count === 0) {
      throw new ConflictError('Friend request is no longer pending or has already been resolved.');
    }

    return { success: true, message: 'Friend request cancelled' };
  }

  /**
   * Remove an existing friend
   */
  async removeFriend(userId: string, friendId: string) {
    const deleted = await prisma.friendship.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });

    if (deleted.count === 0) {
      throw new NotFoundError('Friendship not found');
    }

    return { success: true, message: 'Friend removed' };
  }

  /**
   * Block a user
   */
  async blockUser(blockerId: string, blockedUserId: string) {
    if (blockerId === blockedUserId) {
      throw new AppError('Cannot block yourself');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Remove existing friendships
      await tx.friendship.deleteMany({
        where: {
          OR: [
            { userId: blockerId, friendId: blockedUserId },
            { userId: blockedUserId, friendId: blockerId },
          ],
        },
      });

      // 2. Remove or cancel pending friend requests
      await tx.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: blockerId, receiverId: blockedUserId },
            { senderId: blockedUserId, receiverId: blockerId },
          ],
        },
      });

      // 3. Record block
      const block = await tx.blockedUser.upsert({
        where: {
          blockerId_blockedUserId: {
            blockerId,
            blockedUserId,
          },
        },
        update: {},
        create: {
          blockerId,
          blockedUserId,
        },
      });

      return { success: true, blockId: block.id, message: 'User blocked' };
    });
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId: string, blockedUserId: string) {
    const res = await prisma.blockedUser.deleteMany({
      where: {
        blockerId,
        blockedUserId,
      },
    });

    if (res.count === 0) {
      throw new NotFoundError('Block record not found');
    }

    return { success: true, message: 'User unblocked' };
  }

  /**
   * List blocked users
   */
  async listBlocked(userId: string) {
    const blocks = await prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: {
        blockedUser: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            avatarInitials: true,
            avatarColor: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return blocks.map((b) => ({
      id: b.id,
      blockedUser: b.blockedUser,
      createdAt: b.createdAt,
    }));
  }
}

export const friendsService = new FriendsService();

