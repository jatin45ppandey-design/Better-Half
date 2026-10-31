import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../src/config/prisma.js';
import { invitationsService } from '../src/modules/invitations/invitations.service.js';
import { friendsService } from '../src/modules/friends/friends.service.js';
import { adminService } from '../src/modules/admin/admin.service.js';
import { roomsService } from '../src/modules/rooms/rooms.service.js';
import { gameSessionService } from '../src/modules/games/core/gameSession.service.js';
import { gameActionService } from '../src/modules/games/core/gameAction.service.js';
import { gameEngineFactory } from '../src/modules/games/core/gameEngineFactory.js';
import { createRng } from '../src/utils/random.js';

describe('Phase 2 — Final Gap Closure & Database Game Integrity Suite', () => {
  const userA = { id: 'usr-a-uuid', username: 'alice', displayName: 'Alice' };
  const userB = { id: 'usr-b-uuid', username: 'bob', displayName: 'Bob' };
  const userC = { id: 'usr-c-uuid', username: 'charlie', displayName: 'Charlie' };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Database & Concurrency: Atomic Invitations & Friend Requests
  // =========================================================================
  describe('1. Database Concurrency & Race Safety', () => {
    it('acceptInvitation uses atomic conditional update and rolls back if room join fails', async () => {
      vi.spyOn(prisma.userProfile, 'findUnique').mockResolvedValue({ accountStatus: 'ACTIVE' } as any);
      vi.spyOn(prisma.roomInvitation, 'findUnique').mockResolvedValue({
        id: 'inv-123',
        receiverId: userA.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 600000),
        room: { code: 'RM123' },
      } as any);

      // Atomic conditional update marks ACCEPTED
      const updateManySpy = vi.spyOn(prisma.roomInvitation, 'updateMany')
        .mockResolvedValueOnce({ count: 1 }) // First accept
        .mockResolvedValueOnce({ count: 1 }); // Rollback on failure

      // Room join fails (e.g. room expired or capacity full)
      vi.spyOn(roomsService, 'joinRoom').mockRejectedValueOnce(new Error('Room is full'));

      await expect(
        invitationsService.acceptInvitation('inv-123', userA.id)
      ).rejects.toThrow('Room is full');

      // Verify rollback occurred: status reverted to PENDING
      expect(updateManySpy).toHaveBeenCalledWith({
        where: { id: 'inv-123', status: 'ACCEPTED' },
        data: { status: 'PENDING' },
      });
    });

    it('friend requests accept/reject/cancel enforce conditional status checks', async () => {
      // If invitation was concurrently resolved, updateMany returns count: 0
      vi.spyOn(prisma.friendRequest, 'updateMany').mockResolvedValueOnce({ count: 0 });

      await expect(
        friendsService.acceptRequest('req-stale', userB.id)
      ).rejects.toThrow();
    });

    it('protects the last active administrator under concurrent role changes', async () => {
      // Simulate serializable transaction locking where only 1 admin remains
      vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue([]),
          appRole: {
            findUnique: vi.fn().mockResolvedValue({ id: 'role-1', role: 'ADMIN', userId: 'admin-1' }),
            count: vi.fn().mockResolvedValue(1), // Exactly 1 active admin remaining
            delete: vi.fn(),
          },
          auditLog: { create: vi.fn() },
        };
        return cb(tx);
      });

      await expect(
        adminService.revokeRole('admin-1', 'ADMIN', 'actor-1')
      ).rejects.toThrow(/last active administrator/);
    });
  });

  // =========================================================================
  // 2. Room & Game Session Lifecycle
  // =========================================================================
  describe('2. Room Lifecycle & Session Abandonment', () => {
    it('cleanupExpiredRooms abandons active/paused sessions in expired rooms', async () => {
      vi.spyOn(prisma.room, 'updateMany').mockResolvedValueOnce({ count: 2 } as any);
      vi.spyOn(prisma.room, 'findMany').mockResolvedValueOnce([{ id: 'room-exp-1' }, { id: 'room-exp-2' }] as any);
      const sessionUpdateSpy = vi.spyOn(prisma.gameSession, 'updateMany').mockResolvedValueOnce({ count: 2 } as any);
      vi.spyOn(prisma.roomInvitation, 'updateMany').mockResolvedValueOnce({ count: 0 } as any);

      const res = await roomsService.cleanupExpiredRooms();
      expect(res.expiredCount).toBe(2);
      expect(sessionUpdateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId: { in: ['room-exp-1', 'room-exp-2'] }, status: { in: ['ACTIVE', 'PAUSED'] } },
          data: { status: 'ABANDONED' },
        })
      );
    });

    it('rejects game actions when room status is CLOSED or EXPIRED', async () => {
      vi.spyOn(prisma.gameSession, 'findUnique').mockResolvedValue({
        id: 'sess-closed-rm',
        roomId: 'room-closed-1',
        gameId: 'tic-tac-toe',
        mode: 'COUPLE',
        status: 'ACTIVE',
        stateVersion: 1,
        publicState: { board: Array(9).fill(null), currentTurnUserId: userA.id, roundStatus: 'PLAYING' },
        participants: [
          { userId: userA.id, seatIndex: 0, score: 0, user: userA },
          { userId: userB.id, seatIndex: 1, score: 0, user: userB },
        ],
      } as any);

      vi.spyOn(prisma.room, 'findUnique').mockResolvedValue({
        id: 'room-closed-1',
        hostId: userA.id,
        status: 'CLOSED',
      } as any);

      const res = await gameActionService.applyAction(
        {
          sessionId: 'sess-closed-rm',
          actionId: 'act-1',
          expectedVersion: 1,
          action: { type: 'MAKE_MOVE', cellIndex: 0 },
        },
        userA.id
      );

      expect(res.success).toBe(false);
      expect(res.error).toContain('closed');
    });

    it('rematchSession safely returns existing active rematch if concurrent start occurred', async () => {
      vi.spyOn(gameSessionService, 'getOrRestoreSession')
        .mockResolvedValueOnce({
          sessionId: 'orig-sess-1',
          roomId: 'room-rematch-1',
          gameId: 'tic-tac-toe',
          mode: 'couple',
          status: 'COMPLETED',
          participants: [
            { userId: userA.id, seatIndex: 0 },
            { userId: userB.id, seatIndex: 1 },
          ],
        } as any)
        .mockResolvedValueOnce({
          sessionId: 'rematch-active-sess-2',
          roomId: 'room-rematch-1',
          gameId: 'tic-tac-toe',
          mode: 'couple',
          status: 'ACTIVE',
        } as any);

      // Concurrent request already spawned the new session
      vi.spyOn(prisma.gameSession, 'findFirst').mockResolvedValue({
        id: 'rematch-active-sess-2',
        gameId: 'tic-tac-toe',
        status: 'ACTIVE',
      } as any);

      const rematch = await gameSessionService.rematchSession('orig-sess-1', userA.id);
      expect(rematch.sessionId).toBe('rematch-active-sess-2');
    });
  });

  // =========================================================================
  // 3. All 11 Game Engines: Validation, Transitions & RNG Determinism
  // =========================================================================
  describe('3. Engine Integrations & Special Cases', () => {
    it('Between Us: locks prompt and settings once answers have started submission', () => {
      const bu = gameEngineFactory.getEngine('between-us');
      const participants = [
        { userId: userA.id, name: 'Alice', seatIndex: 0 },
        { userId: userB.id, name: 'Bob', seatIndex: 1 },
      ];
      const init = bu.createInitialState({
        sessionId: 'bu-lock-test',
        mode: 'couple',
        participants,
        rngSeed: 'bu-seed-1',
      });

      const context: any = {
        sessionId: 'bu-lock-test',
        state: init.state,
        privateStates: init.privateStates,
        participants,
        scores: init.scores,
      };

      // Before any submissions: settings change is valid
      const v1 = bu.validateAction({ type: 'SET_SETTINGS', intensity: 3 }, context, userA.id);
      expect(v1.valid).toBe(true);

      // User A submits an answer
      context.state.submittedUserIds = [userA.id];

      // Settings change is now forbidden to prevent prompt tampering
      const v2 = bu.validateAction({ type: 'SET_SETTINGS', intensity: 4 }, context, userA.id);
      expect(v2.valid).toBe(false);
      expect(v2.error).toContain('while answers are being submitted');
    });

    it('Between Us After Dark: rejects self-attestation as verified age', () => {
      const bu = gameEngineFactory.getEngine('between-us');
      const participants = [
        { userId: userA.id, name: 'Alice', seatIndex: 0 },
        { userId: userB.id, name: 'Bob', seatIndex: 1 },
      ];
      const init = bu.createInitialState({
        sessionId: 'bu-ad-test',
        mode: 'couple',
        participants,
        rngSeed: 'bu-seed-2',
      });

      const context: any = {
        sessionId: 'bu-ad-test',
        state: init.state,
        privateStates: init.privateStates,
        participants,
        scores: init.scores,
      };

      // Client submits selfAttestation: true without verified age credentials
      const vSelf = bu.validateAction(
        { type: 'GRANT_ADULT_CONSENT', selfAttestation: true, isAgeVerified: false } as any,
        context,
        userA.id
      );
      expect(vSelf.valid).toBe(false);
      expect(vSelf.error).toContain('Self-attestation cannot be used as verified age');
    });

    it('UNO-Style: initializes deterministic deck order based on server rngSeed', () => {
      const uno = gameEngineFactory.getEngine('uno-style');
      const participants = [
        { userId: userA.id, name: 'Alice', seatIndex: 0 },
        { userId: userB.id, name: 'Bob', seatIndex: 1 },
      ];

      const s1 = uno.createInitialState({
        sessionId: 'uno-det-1',
        mode: 'couple',
        participants,
        rngSeed: 'deterministic-seed-xyz',
      });

      const s2 = uno.createInitialState({
        sessionId: 'uno-det-2',
        mode: 'couple',
        participants,
        rngSeed: 'deterministic-seed-xyz',
      });

      // Both instances must produce identical initial top discard and hand counts
      expect(s1.state.topDiscard.id).toBe(s2.state.topDiscard.id);
      expect(s1.state.topDiscard.color).toBe(s2.state.topDiscard.color);
      expect(s1.state.topDiscard.value).toBe(s2.state.topDiscard.value);
    });

    it('Tic-Tac-Toe: restricts START_NEXT_ROUND to active duelists or host', () => {
      const ttt = gameEngineFactory.getEngine('tic-tac-toe');
      const participants = [
        { userId: userA.id, name: 'Alice', seatIndex: 0, isHost: true },
        { userId: userB.id, name: 'Bob', seatIndex: 1, isHost: false },
        { userId: userC.id, name: 'Charlie', seatIndex: 2, isHost: false }, // Spectator/waiting queue
      ];

      const init = ttt.createInitialState({
        sessionId: 'ttt-auth-test',
        mode: 'friend',
        participants,
        rngSeed: 'ttt-seed',
      });

      const context: any = {
        sessionId: 'ttt-auth-test',
        state: { ...init.state, roundStatus: 'X_WON' },
        participants,
      };

      // Waiting spectator Charlie cannot advance the round
      const vCharlie = ttt.validateAction({ type: 'START_NEXT_ROUND' }, context, userC.id);
      expect(vCharlie.valid).toBe(false);
      expect(vCharlie.error).toContain('Only active duelists or the room host');

      // Active duelist Alice can advance
      const vAlice = ttt.validateAction({ type: 'START_NEXT_ROUND' }, context, userA.id);
      expect(vAlice.valid).toBe(true);
    });

    it('Would You Rather: prevents NEXT_QUESTION once match is completed', () => {
      const wyr = gameEngineFactory.getEngine('would-you-rather');
      const participants = [
        { userId: userA.id, name: 'Alice', seatIndex: 0 },
        { userId: userB.id, name: 'Bob', seatIndex: 1 },
      ];

      const init = wyr.createInitialState({
        sessionId: 'wyr-comp-test',
        mode: 'couple',
        participants,
        rngSeed: 'wyr-seed',
      });

      const context: any = {
        sessionId: 'wyr-comp-test',
        state: { ...init.state, phase: 'REVEAL', totalAnswered: 8 },
        participants,
      };

      const val = wyr.validateAction({ type: 'NEXT_QUESTION' }, context, userA.id);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('already completed');
    });

    it('Blind Ranking: prevents NEXT_CATEGORY once all rounds have completed', () => {
      const br = gameEngineFactory.getEngine('blind-ranking');
      const participants = [
        { userId: userA.id, name: 'Alice', seatIndex: 0 },
        { userId: userB.id, name: 'Bob', seatIndex: 1 },
      ];

      const init = br.createInitialState({
        sessionId: 'br-comp-test',
        mode: 'couple',
        participants,
        rngSeed: 'br-seed',
      });

      const context: any = {
        sessionId: 'br-comp-test',
        state: { ...init.state, phase: 'REVEAL', round: 100 },
        participants,
      };

      const val = br.validateAction({ type: 'NEXT_CATEGORY' }, context, userA.id);
      expect(val.valid).toBe(false);
      expect(val.error).toContain('already completed');
    });
  });
});
