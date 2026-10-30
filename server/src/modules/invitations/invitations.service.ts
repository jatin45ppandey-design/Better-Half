import { prisma } from '../../config/prisma.js';
import { AppError, NotFoundError, ForbiddenError, ConflictError } from '../../utils/errors.js';
import { roomsService } from '../rooms/rooms.service.js';

export class InvitationsService {
  /**
   * Send an invitation to a user to join a room.
   */
  async sendInvitation(senderId: string, roomId: string, receiverId: string) {
    if (senderId === receiverId) {
      throw new AppError('You cannot invite yourself', 400);
    }

    // Check if blocked in either direction
    const isBlocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: senderId, blockedUserId: receiverId },
          { blockerId: receiverId, blockedUserId: senderId },
        ],
      },
    });

    if (isBlocked) {
      throw new ForbiddenError('Cannot invite this user');
    }

    // Verify room exists and sender is an active participant
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        participants: {
          where: { leftAt: null },
        },
      },
    });

    if (!room) {
      throw new NotFoundError('Room not found');
    }

    if (room.status === 'CLOSED' || room.status === 'EXPIRED') {
      throw new AppError('Room is no longer active', 400);
    }

    if (room.expiresAt < new Date()) {
      throw new AppError('Room has expired', 400);
    }

    const isSenderParticipant = room.participants.some((p: { userId: string }) => p.userId === senderId);
    if (!isSenderParticipant) {
      throw new ForbiddenError('You must be in the room to send an invite');
    }

    if (room.participants.length >= room.maxPlayers) {
      throw new AppError('Room is already at maximum capacity', 400);
    }

    // Check receiver is not already in the room
    const isReceiverInRoom = room.participants.some((p: { userId: string }) => p.userId === receiverId);
    if (isReceiverInRoom) {
      throw new ConflictError('User is already in this room');
    }

    // Check for existing pending invitation
    const existingInvite = await prisma.roomInvitation.findFirst({
      where: {
        roomId,
        receiverId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvite) {
      throw new ConflictError('A pending invitation already exists for this user');
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const invitation = await prisma.roomInvitation.create({
      data: {
        roomId,
        senderId,
        receiverId,
        status: 'PENDING',
        expiresAt,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        room: {
          select: {
            id: true,
            code: true,
            name: true,
            mode: true,
            maxPlayers: true,
          },
        },
      },
    });

    return invitation;
  }

  /**
   * Get active pending invitations received by the user.
   */
  async getReceivedInvitations(userId: string) {
    const invitations = await prisma.roomInvitation.findMany({
      where: {
        receiverId: userId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
        room: {
          status: { in: ['WAITING', 'READY_TO_START'] },
          expiresAt: { gt: new Date() },
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        room: {
          select: {
            id: true,
            code: true,
            name: true,
            mode: true,
            maxPlayers: true,
            status: true,
            host: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            participants: {
              where: { leftAt: null },
              select: {
                id: true,
                userId: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  /**
   * Accept an invitation and join the room.
   */
  async acceptInvitation(invitationId: string, userId: string) {
    const invite = await prisma.roomInvitation.findUnique({
      where: { id: invitationId },
      include: { room: true },
    });

    if (!invite) {
      throw new NotFoundError('Invitation not found');
    }

    if (invite.receiverId !== userId) {
      throw new ForbiddenError('You cannot accept this invitation');
    }

    if (invite.status !== 'PENDING') {
      throw new AppError(`Invitation is already ${invite.status.toLowerCase()}`, 400);
    }

    if (invite.expiresAt < new Date()) {
      await prisma.roomInvitation.update({
        where: { id: invitationId },
        data: { status: 'EXPIRED' },
      });
      throw new AppError('This invitation has expired', 400);
    }

    // Join room using roomsService
    const joinedRoom = await roomsService.joinRoom(userId, invite.room.code);

    // Update invitation status
    await prisma.roomInvitation.update({
      where: { id: invitationId },
      data: { status: 'ACCEPTED' },
    });

    return joinedRoom;
  }

  /**
   * Decline an invitation.
   */
  async declineInvitation(invitationId: string, userId: string) {
    const invite = await prisma.roomInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invite) {
      throw new NotFoundError('Invitation not found');
    }

    if (invite.receiverId !== userId) {
      throw new ForbiddenError('You cannot decline this invitation');
    }

    if (invite.status !== 'PENDING') {
      throw new AppError(`Invitation is already ${invite.status.toLowerCase()}`, 400);
    }

    const updated = await prisma.roomInvitation.update({
      where: { id: invitationId },
      data: { status: 'DECLINED' },
    });

    return updated;
  }

  /**
   * Cancel an invitation (by sender or room host).
   */
  async cancelInvitation(invitationId: string, userId: string) {
    const invite = await prisma.roomInvitation.findUnique({
      where: { id: invitationId },
      include: { room: true },
    });

    if (!invite) {
      throw new NotFoundError('Invitation not found');
    }

    if (invite.senderId !== userId && invite.room.hostId !== userId) {
      throw new ForbiddenError('You cannot cancel this invitation');
    }

    if (invite.status !== 'PENDING') {
      throw new AppError(`Invitation is already ${invite.status.toLowerCase()}`, 400);
    }

    const updated = await prisma.roomInvitation.update({
      where: { id: invitationId },
      data: { status: 'CANCELLED' },
    });

    return updated;
  }
}

export const invitationsService = new InvitationsService();
