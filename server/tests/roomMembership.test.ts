import { beforeEach, describe, expect, it, vi } from 'vitest';
import { revokeRoomMembership } from '../src/socket/roomMembership.js';
import { presenceManager } from '../src/socket/presence.js';

describe('Room membership revocation across tabs', () => {
  beforeEach(() => {
    presenceManager.reset();
  });

  it('notifies and removes every active socket for a room leave', async () => {
    const socketA = { emit: vi.fn(), leave: vi.fn().mockResolvedValue(undefined) };
    const socketB = { emit: vi.fn(), leave: vi.fn().mockResolvedValue(undefined) };
    const sockets = new Map([
      ['socket-a', socketA],
      ['socket-b', socketB],
    ]);
    const io = { sockets: { sockets } } as any;

    presenceManager.trackConnect('player-a', 'socket-a');
    presenceManager.trackConnect('player-a', 'socket-b');
    presenceManager.joinRoom('room-1', 'player-a');

    const onlineUserIds = await revokeRoomMembership(io, 'room-1', 'player-a', 'LEFT');

    for (const socket of [socketA, socketB]) {
      expect(socket.emit).toHaveBeenCalledWith('room:membership:revoked', {
        roomId: 'room-1',
        userId: 'player-a',
        reason: 'LEFT',
      });
      expect(socket.leave).toHaveBeenCalledWith('room:room-1');
    }
    expect(presenceManager.getUserRooms('player-a')).not.toContain('room-1');
    expect(onlineUserIds).not.toContain('player-a');
  });

  it('also sends the kicked event directly to every active target socket', async () => {
    const socketA = { emit: vi.fn(), leave: vi.fn().mockResolvedValue(undefined) };
    const socketB = { emit: vi.fn(), leave: vi.fn().mockResolvedValue(undefined) };
    const sockets = new Map([
      ['socket-a', socketA],
      ['socket-b', socketB],
    ]);
    const io = { sockets: { sockets } } as any;

    presenceManager.trackConnect('player-b', 'socket-a');
    presenceManager.trackConnect('player-b', 'socket-b');
    presenceManager.joinRoom('room-2', 'player-b');

    await revokeRoomMembership(io, 'room-2', 'player-b', 'KICKED');

    for (const socket of [socketA, socketB]) {
      expect(socket.emit).toHaveBeenCalledWith('room:membership:revoked', {
        roomId: 'room-2',
        userId: 'player-b',
        reason: 'KICKED',
      });
      expect(socket.emit).toHaveBeenCalledWith('room:player:kicked', {
        targetUserId: 'player-b',
        roomId: 'room-2',
      });
      expect(socket.leave).toHaveBeenCalledWith('room:room-2');
    }
  });
});
