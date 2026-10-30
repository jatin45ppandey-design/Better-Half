import { z } from 'zod';

export const sendRoomInvitationSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
  receiverId: z.string().uuid('Invalid receiver ID'),
});

export type SendRoomInvitationInput = z.infer<typeof sendRoomInvitationSchema>;

