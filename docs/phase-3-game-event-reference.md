# PlaySpace Phase 3 — Game Socket.IO Event Reference

This document details all real-time Socket.IO client-to-server and server-to-client events used by the PlaySpace game engines during active matches.

Every connected socket is authenticated using the Supabase JWT handshake (`auth: { token: <jwt> }`).

---

## 1. Socket Rooms & Subscription

Upon joining a game session, sockets join a private session room:
`session:<sessionId>`

Private user events (such as hand distributions) are routed directly to the authenticated user's individual socket ID (`getUserSockets(userId)`).

---

## 2. Client-to-Server Events

### 2.1. `game:session:join`
Subscribes the socket to the game session room and triggers an immediate snapshot delivery.

- **Payload**:
  ```typescript
  {
    sessionId: string;
  }
  ```
- **Acknowledgement**:
  ```typescript
  {
    success: boolean;
    publicState?: any;
    privateState?: any;
    error?: string;
  }
  ```

---

### 2.2. `game:action`
Submits an in-game move or choice to the authoritative engine.

- **Payload**:
  ```typescript
  {
    sessionId: string;
    actionId: string; // Unique client action ID for deduplication
    expectedVersion: number; // Current stateVersion known to client
    action: {
      type: string; // e.g. 'PLAY_CARD', 'CLAIM_CELL', 'LAUNCH_PEN', 'SNATCH'
      [key: string]: any;
    };
  }
  ```
- **Acknowledgement**:
  ```typescript
  {
    success: boolean;
    version?: number;
    error?: string;
  }
  ```

---

### 2.3. `game:pause`
Pauses the active match (stops tick intervals and timers).

- **Payload**:
  ```typescript
  {
    sessionId: string;
  }
  ```
- **Acknowledgement**: `{ success: boolean; error?: string }`

---

### 2.4. `game:resume`
Resumes a previously paused match.

- **Payload**:
  ```typescript
  {
    sessionId: string;
  }
  ```
- **Acknowledgement**: `{ success: boolean; error?: string }`

---

### 2.5. `game:rematch:request`
Initiates a rematch request for a completed game.

- **Payload**:
  ```typescript
  {
    sessionId: string;
  }
  ```
- **Acknowledgement**: `{ success: boolean; error?: string }`

---

### 2.6. `game:session:leave`
Leaves the game session room.

- **Payload**:
  ```typescript
  {
    sessionId: string;
  }
  ```

---

## 3. Server-to-Client Events

### 3.1. `game:session:started`
Broadcast when the room host starts a match. Notifies lobby participants to transition to the Game Arena.

- **Audience**: Broadcast to `room:<roomId>`
- **Payload**:
  ```typescript
  {
    sessionId: string;
    roomCode: string;
    gameId: string;
    mode: 'couple' | 'friend';
    publicState: any;
    participants: {
      userId: string;
      name: string;
      seatIndex: number;
      isHost: boolean;
    }[];
  }
  ```

---

### 3.2. `game:state`
Broadcast whenever authoritative public state mutates after an action or timer tick.

- **Audience**: Broadcast to `session:<sessionId>`
- **Payload**:
  ```typescript
  {
    sessionId: string;
    version: number;
    publicState: any;
    scores?: Record<string, number>;
  }
  ```

---

### 3.3. `game:state:private`
Directly transmitted to an individual player when their secret data updates.

- **Audience**: Single user socket(s)
- **Payload**:
  ```typescript
  {
    sessionId: string;
    privateState: any; // e.g. UNO hand, pending dilemma choice, hidden prompt
  }
  ```

---

### 3.4. `game:action:accepted`
Acknowledgement sent to the action dispatcher confirming state commit.

- **Audience**: Action dispatcher socket
- **Payload**:
  ```typescript
  {
    actionId: string;
    version: number;
  }
  ```

---

### 3.5. `game:action:rejected`
Sent when an action is invalid, out of turn, or has a version conflict.

- **Audience**: Action dispatcher socket
- **Payload**:
  ```typescript
  {
    actionId: string;
    error: string;
    currentVersion: number;
  }
  ```

---

### 3.6. `game:event`
Broadcasts domain-specific ephemeral visual/audio events to synchronize animations and sound effects across clients.

- **Audience**: Broadcast to `session:<sessionId>`
- **Payload Examples**:
  - UNO Wild color selected: `{ type: 'uno:wildColor', payload: { color: 'green', userId: '...' } }`
  - Fry Snatch: `{ type: 'fries:snatched', payload: { actorUserId: '...', reactionMs: 240, points: 250 } }`
  - Basketball Swish: `{ type: 'basketball:shot', payload: { result: 'SWISH', points: 3, streak: 2 } }`
  - Pen Collision: `{ type: 'pen:turnEnd', payload: { shooterId: '...', penAId: '...', penBId: '...' } }`

---

### 3.7. `game:paused` / `game:resumed`
Broadcast when any participant pauses or resumes the match.

- **Payload (`game:paused`)**:
  ```typescript
  {
    sessionId: string;
    pausedBy: string;
  }
  ```
- **Payload (`game:resumed`)**:
  ```typescript
  {
    sessionId: string;
  }
  ```

---

### 3.8. `game:completed`
Broadcast when the match concludes, announcing winner and final score tallies.

- **Audience**: Broadcast to `session:<sessionId>`
- **Payload**:
  ```typescript
  {
    sessionId: string;
    winnerUserId: string | null; // null indicates draw/tie
    isDraw: boolean;
    finalScores: Record<string, number>;
  }
  ```

