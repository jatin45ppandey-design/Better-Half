import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import http from 'node:http';
import { io as ClientSocket, type Socket as ClientSocketType } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { createSocketServer } from '../src/socket/index.js';
import { prisma } from '../src/config/prisma.js';
import { presenceManager } from '../src/socket/presence.js';
import { gameStateService } from '../src/modules/games/core/gameState.service.js';
import { gameSessionService } from '../src/modules/games/core/gameSession.service.js';
import { enableTestAuth } from '../src/middleware/auth.js';
import { SERVER_GAMES } from '../src/modules/games/core/gameRegistry.js';
import { GameEngineFactory } from '../src/modules/games/core/gameEngineFactory.js';
import type { GameEngineContext } from '../src/modules/games/core/gameEngine.types.js';

enableTestAuth();

const gameEngineFactory = new GameEngineFactory();

describe('PlaySpace — Multiplayer Coverage, Reconnect, Rematch & Load Benchmark Suite', () => {
  let httpServer: http.Server;
  let ioServer: any;
  let serverPort: number;
  const activeSockets: ClientSocketType[] = [];

  const createClient = (userId: string): Promise<ClientSocketType> => {
    return new Promise((resolve, reject) => {
      const client = ClientSocket(`http://127.0.0.1:${serverPort}`, {
        auth: { token: `test-mock-token-${userId}` },
        transports: ['websocket'],
        reconnection: false,
        timeout: 5000,
      });

      client.on('connect', () => {
        activeSockets.push(client);
        resolve(client);
      });

      client.on('connect_error', (err) => {
        client.disconnect();
        reject(err);
      });
    });
  };

  beforeAll(async () => {
    enableTestAuth();

    // Stub profile lookups for all test users so socket auth succeeds instantly
    vi.spyOn(prisma.userProfile, 'findUnique').mockImplementation(async ({ where }: any) => {
      return {
        id: where.id,
        accountStatus: 'ACTIVE',
        displayName: `TestUser_${where.id}`,
      } as any;
    });

    const app = createApp();
    httpServer = http.createServer(app);
    ioServer = createSocketServer(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as any;
        serverPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    activeSockets.forEach((s) => s.disconnect());
    activeSockets.length = 0;
    ioServer?.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    presenceManager.reset();
  });

  beforeEach(() => {
    gameStateService.reset();
  });

  describe('1. Two-Participant Reconnect & State Resynchronization Across All 11 Games', () => {
    const allGameIds = Object.keys(SERVER_GAMES);

    allGameIds.forEach((gameId) => {
      it(`synchronizes state upon socket reconnection for ${gameId}`, async () => {
        const sessionId = `reconn-sess-${gameId}`;
        const userA = `p1-${gameId}`;
        const userB = `p2-${gameId}`;
        const participants = [
          { userId: userA, name: 'Player A', seatIndex: 0, isHost: true },
          { userId: userB, name: 'Player B', seatIndex: 1, isHost: false },
        ];

        const engine = gameEngineFactory.getEngine(gameId);
        const initial = engine.createInitialState({
          sessionId,
          mode: 'couple',
          participants,
          rngSeed: `seed-${gameId}`,
        });

        // Initialize session in memory and stub DB recovery
        const sessionContext: GameEngineContext = {
          sessionId,
          gameId,
          mode: 'couple',
          participants,
          state: initial.state,
          privateStates: initial.privateStates,
          version: 1,
          isPaused: false,
          status: 'ACTIVE',
          scores: initial.scores,
        };

        gameStateService.setSession(sessionId, sessionContext);

        // Connect client A
        const clientA = await createClient(userA);

        // Client A joins session
        const joinAck = await new Promise<any>((resolve) => {
          clientA.emit('game:session:join', { sessionId }, (res: any) => resolve(res));
        });

        expect(joinAck.success).toBe(true);
        expect(joinAck.publicState).toBeDefined();

        // Simulate client A disconnect
        clientA.disconnect();

        // Client A reconnects with fresh socket
        const reconnectedClientA = await createClient(userA);

        // Reconnect join: must retrieve current state without error
        const reconnAck = await new Promise<any>((resolve) => {
          reconnectedClientA.emit('game:session:join', { sessionId }, (res: any) => resolve(res));
        });

        expect(reconnAck.success).toBe(true);
        expect(reconnAck.publicState).toBeDefined();
        expect(reconnAck.publicState.sessionId).toBe(sessionId);
        expect(reconnAck.publicState.gameId).toBe(gameId);

        reconnectedClientA.disconnect();
      });
    });
  });

  describe('2. Rematch Lifecycle Across All 11 Games', () => {
    const allGameIds = Object.keys(SERVER_GAMES);

    allGameIds.forEach((gameId) => {
      it(`handles rematch request cleanly for ${gameId}`, async () => {
        const oldSessionId = `rematch-old-${gameId}`;
        const newSessionId = `rematch-new-${gameId}`;
        const userA = `host-${gameId}`;
        const userB = `guest-${gameId}`;
        const roomId = `room-${gameId}`;

        const completedSession: GameEngineContext = {
          sessionId: oldSessionId,
          gameId,
          mode: 'couple',
          participants: [
            { userId: userA, name: 'Host', seatIndex: 0, isHost: true },
            { userId: userB, name: 'Guest', seatIndex: 1, isHost: false },
          ],
          state: { completed: true },
          privateStates: {},
          version: 5,
          isPaused: false,
          status: 'COMPLETED',
          scores: { [userA]: 1, [userB]: 0 },
        };

        gameStateService.setSession(oldSessionId, completedSession);

        // Stub gameSessionService.rematchSession
        vi.spyOn(gameSessionService, 'rematchSession').mockResolvedValueOnce({
          sessionId: newSessionId,
          gameId,
        });

        const hostClient = await createClient(userA);

        // Join old session room to listen for rematch broadcast
        await new Promise<void>((resolve) => {
          hostClient.emit('game:session:join', { sessionId: oldSessionId }, () => resolve());
        });

        const rematchPromise = new Promise<any>((resolve) => {
          hostClient.on('game:session:started', (evt: any) => resolve(evt));
        });

        const ack = await new Promise<any>((resolve) => {
          hostClient.emit('game:rematch:request', { sessionId: oldSessionId }, (res: any) => resolve(res));
        });

        expect(ack.success).toBe(true);
        expect(ack.newSessionId).toBe(newSessionId);

        const broadcast = await rematchPromise;
        expect(broadcast.sessionId).toBe(newSessionId);
        expect(broadcast.gameId).toBe(gameId);

        hostClient.disconnect();
      });
    });
  });

  describe('3. Measurable Concurrent Load & Throughput Benchmark', () => {
    it('executes 50 concurrent socket clients across 25 rooms with measured throughput, latency and memory', async () => {
      const NUM_CLIENTS = 50;
      const NUM_SESSIONS = 25; // 2 clients per session
      const ACTIONS_PER_CLIENT = 10;
      const TOTAL_ACTIONS = NUM_CLIENTS * ACTIONS_PER_CLIENT; // 500 actions

      const initialMemory = process.memoryUsage();
      const loadSockets: ClientSocketType[] = [];

      // 1. Establish 25 test sessions in memory
      for (let s = 0; s < NUM_SESSIONS; s++) {
        const sessionId = `load-sess-${s}`;
        const p1Id = `load-user-${s * 2}`;
        const p2Id = `load-user-${s * 2 + 1}`;

        const sessionContext: GameEngineContext = {
          sessionId,
          gameId: 'tic-tac-toe',
          mode: 'couple',
          participants: [
            { userId: p1Id, name: `User_${p1Id}`, seatIndex: 0, isHost: true },
            { userId: p2Id, name: `User_${p2Id}`, seatIndex: 1, isHost: false },
          ],
          state: { board: Array(9).fill(null), turn: p1Id },
          privateStates: {},
          version: 1,
          isPaused: false,
          status: 'ACTIVE',
          scores: { [p1Id]: 0, [p2Id]: 0 },
        };

        gameStateService.setSession(sessionId, sessionContext);
      }

      // 2. Connect 50 sockets concurrently and measure connect time
      const connectStartTime = performance.now();
      const connectPromises: Promise<ClientSocketType>[] = [];

      for (let i = 0; i < NUM_CLIENTS; i++) {
        connectPromises.push(createClient(`load-user-${i}`));
      }

      const connectedClients = await Promise.all(connectPromises);
      const connectDurationMs = performance.now() - connectStartTime;
      connectedClients.forEach((c) => loadSockets.push(c));

      expect(connectedClients.length).toBe(NUM_CLIENTS);

      // 3. Concurrently join sessions
      const joinPromises = connectedClients.map((client, idx) => {
        const sessionIdx = Math.floor(idx / 2);
        const sessionId = `load-sess-${sessionIdx}`;
        return new Promise<void>((resolve, reject) => {
          client.emit('game:session:join', { sessionId }, (res: any) => {
            if (res?.success) resolve();
            else reject(new Error(res?.error || 'Join failed'));
          });
        });
      });

      await Promise.all(joinPromises);

      // 4. Dispatch 500 actions concurrently and record round-trip latencies
      const latencies: number[] = [];
      const actionStartTime = performance.now();

      const actionBatches = connectedClients.map((client, clientIdx) => {
        const sessionIdx = Math.floor(clientIdx / 2);
        const sessionId = `load-sess-${sessionIdx}`;

        return (async () => {
          for (let a = 0; a < ACTIONS_PER_CLIENT; a++) {
            const actionId = `act-${clientIdx}-${a}-${Date.now()}`;
            const t0 = performance.now();

            await new Promise<void>((resolve) => {
              client.emit(
                'game:action',
                {
                  sessionId,
                  actionId,
                  expectedVersion: 1,
                  action: { type: 'MAKE_MOVE', position: (clientIdx + a) % 9 },
                },
                () => {
                  const t1 = performance.now();
                  latencies.push(t1 - t0);
                  resolve();
                }
              );
            });
          }
        })();
      });

      await Promise.all(actionBatches);
      const totalActionDurationMs = performance.now() - actionStartTime;

      const finalMemory = process.memoryUsage();
      const heapUsedDeltaMb = (finalMemory.heapUsed - initialMemory.heapUsed) / (1024 * 1024);

      // Calculate statistical metrics
      latencies.sort((a, b) => a - b);
      const minLatency = latencies[0];
      const medianLatency = latencies[Math.floor(latencies.length * 0.5)];
      const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
      const p99Latency = latencies[Math.floor(latencies.length * 0.99)];
      const maxLatency = latencies[latencies.length - 1];
      const throughput = (TOTAL_ACTIONS / (totalActionDurationMs / 1000)).toFixed(2);

      // Empirical report for release gate documentation
      console.log('=== MULTIPLAYER LOAD BENCHMARK RESULTS ===');
      console.log(`Concurrent Sockets:       ${NUM_CLIENTS}`);
      console.log(`Active Game Sessions:     ${NUM_SESSIONS}`);
      console.log(`Total Actions Dispatched: ${TOTAL_ACTIONS}`);
      console.log(`Total Connection Time:    ${connectDurationMs.toFixed(2)} ms`);
      console.log(`Total Action Time:        ${totalActionDurationMs.toFixed(2)} ms`);
      console.log(`Action Throughput:        ${throughput} actions/sec`);
      console.log(`Latency Min:              ${minLatency.toFixed(2)} ms`);
      console.log(`Latency p50 (Median):     ${medianLatency.toFixed(2)} ms`);
      console.log(`Latency p95:              ${p95Latency.toFixed(2)} ms`);
      console.log(`Latency p99:              ${p99Latency.toFixed(2)} ms`);
      console.log(`Latency Max:              ${maxLatency.toFixed(2)} ms`);
      console.log(`Heap Delta:               ${heapUsedDeltaMb.toFixed(2)} MB`);
      console.log('==========================================');

      // Assert SLA performance standards
      expect(connectedClients.length).toBe(NUM_CLIENTS);
      expect(latencies.length).toBe(TOTAL_ACTIONS);
      expect(p95Latency).toBeLessThan(100); // 95% of socket actions acknowledged under 100ms
      expect(heapUsedDeltaMb).toBeLessThan(50); // Memory leak bound under load

      // Disconnect all sockets
      loadSockets.forEach((s) => s.disconnect());
    }, 30000);
  });
});
