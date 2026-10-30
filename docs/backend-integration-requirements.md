# PlaySpace — Backend Integration Requirements Specification
## Architectural Contracts, WebSocket Protocols & Data Models for Future Backend Implementation

**Notice:** This document defines the backend interface requirements and data contracts necessary to transition PlaySpace from the Phase 3 frontend prototype to a live, multi-device production gaming platform. **These backend services are intentionally NOT implemented in Phase 3**, preserving the frontend-only scope of the project.

---

## 1. System Architecture Overview

```
                      ┌─────────────────────────────────────────┐
                      │          PlaySpace Frontend Client      │
                      │    (React + Vite + Web Audio API)       │
                      └────────────┬───────────────┬────────────┘
                                   │               │
                     HTTPS / JSON  │               │ WSS / Socket.IO
                                   ▼               ▼
                      ┌────────────────────┐ ┌────────────────────┐
                      │  REST API Gateway  │ │ Realtime Gateway   │
                      │  (Node / Express   │ │ (WebSockets /      │
                      │   or Fastify)      │ │  Socket.IO / Redis)│
                      └────────────┬───────┘ └───────────┬────────┘
                                   │                     │
                                   ▼                     ▼
                      ┌─────────────────────────────────────────┐
                      │          Data & State Layer             │
                      │    - PostgreSQL (Users, History, Stats) │
                      │    - Redis (Rooms, Presence, Realtime)  │
                      └─────────────────────────────────────────┘
```

---

## 2. Authentication & Session Contracts

### A. Endpoints
- `POST /api/v1/auth/signup`
  - **Request:** `{ email: string, passwordHash: string, name: string, preferredMode: 'couple' | 'friend' }`
  - **Response (201):** `{ token: string, user: UserProfile }`
- `POST /api/v1/auth/login`
  - **Request:** `{ email: string, passwordHash: string }`
  - **Response (200):** `{ token: string, user: UserProfile }`
- `POST /api/v1/auth/refresh`
  - **Request:** `{ refreshToken: string }`
  - **Response (200):** `{ token: string }`
- `POST /api/v1/auth/logout`
  - **Request:** `Bearer <token>`
  - **Response (200):** `{ success: true }`

### B. Session Security
- JWT Bearer tokens in `Authorization: Bearer <token>` header with 15-minute expiration.
- Secure, HTTP-only, SameSite refresh cookie for background token renewals.

---

## 3. Player Profiles & Career Statistics

### A. Endpoints
- `GET /api/v1/profile/me` -> Current authenticated user profile and career stats.
- `PATCH /api/v1/profile/me` -> Update bio, display name, avatar color, favorite games, and privacy preferences.
- `GET /api/v1/profile/:username` -> Public profile (respects user privacy flags: `publicMatchHistory`, `showOnlineStatus`).

### B. Data Model
```typescript
interface UserProfile {
  id: string;
  email: string;
  username: string;
  name: string;
  avatarInitials: string;
  avatarColor: string;
  bio: string;
  createdAt: string;
  favouriteGames: string[];
  privacy: {
    showOnlineStatus: boolean;
    allowDirectInvites: boolean;
    publicMatchHistory: boolean;
  };
  stats: {
    totalMatches: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    gameBreakdown: Record<string, { played: number; won: number; highscore?: number }>;
  };
}
```

---

## 4. Friends & Real-time Presence

### A. Endpoints
- `GET /api/v1/friends` -> List friends with real-time status.
- `POST /api/v1/friends/requests` -> Send friend request by username.
- `POST /api/v1/friends/requests/:id/accept` -> Accept friend request.
- `POST /api/v1/friends/requests/:id/decline` -> Decline request.
- `DELETE /api/v1/friends/:id` -> Remove friend.
- `POST /api/v1/friends/:id/block` -> Block user.

### B. Real-time Presence (Redis Heartbeat)
- **Heartbeat:** Clients emit `presence:heartbeat` every 30 seconds over WebSocket.
- **Statuses:** `'online' | 'in-lobby' | 'in-game' | 'offline'`
- **Event: `presence:update`**
  - **Payload:** `{ userId: string, status: string, currentGame?: string, roomCode?: string }`

---

## 5. Room Creation, Joining & Synchronization

### A. REST Endpoints
- `POST /api/v1/rooms`
  - **Payload:** `{ mode: 'couple' | 'friend', selectedGameId: string, name?: string }`
  - **Response (201):** `{ roomCode: string, room: RoomState }`
- `GET /api/v1/rooms/:code` -> Check room availability and player count.

### B. WebSocket Connection & Room Events
- **Connect:** `ws://api.playspace.com/socket.io?token=<JWT>`
- **Client Emit: `room:join`**
  - **Payload:** `{ roomCode: string }`
  - **Server ACK:** `{ success: boolean, room: RoomState }` or `{ error: string }`
- **Client Emit: `room:leave`**
  - **Payload:** `{ roomCode: string }`
- **Client Emit: `room:ready`**
  - **Payload:** `{ isReady: boolean }`
- **Client Emit: `room:set_game`** (Host or Friend Mode vote)
  - **Payload:** `{ gameId: string }`
- **Server Broadcast: `room:updated`**
  - Broadcast to all sockets in the room whenever players join, leave, ready, or change games.

---

## 6. Real-time Lobby Chat & Emoji Reactions

### A. WebSocket Events
- **Client Emit: `chat:send`**
  - **Payload:** `{ roomCode: string, text: string }`
- **Server Broadcast: `chat:message`**
  - **Payload:** `{ id: string, senderId: string, senderName: string, text: string, timestamp: string }`
- **Client Emit: `reaction:send`**
  - **Payload:** `{ roomCode: string, emoji: string }`
- **Server Broadcast: `reaction:broadcast`**
  - **Payload:** `{ senderId: string, emoji: string, timestamp: number }`

---

## 7. Turn-Based & Real-time Game Synchronization

### A. Authoritative Game Engine Architecture
For multiplayer gameplay across distinct physical devices:
1. **Turn-Based Games (Original Card Game, Tic Tac Toe, Blind Ranking, Kabza):**
   - Client sends proposed move (`game:move`).
   - Server validates legality (e.g. valid card color/value, unoccupied grid cell, valid territory expansion).
   - Server applies state transition and broadcasts `game:state_sync` to all clients.
2. **Physics & Reflex Showdowns (Pen Fight, Basketball Rivalry, Snatch the Fries, Aloo Golf):**
   - Client sends vector parameters: `{ angle: number, power: number, strokeId: string }` or tap timestamp.
   - Server calculates trajectory, detects collisions/outcomes deterministically, and broadcasts outcome events to eliminate desync.
3. **Conversational Games (Truth or Dare, Would You Rather):**
   - Server synchronizes prompt card index, timer start, and completion acknowledgement across devices.

---

## 8. Match Persistence & History

### A. Endpoints
- `POST /api/v1/matches` (Internal or Host validated)
  - **Payload:**
    ```typescript
    interface MatchRecordPayload {
      roomCode: string;
      gameId: string;
      mode: 'couple' | 'friend';
      durationSeconds: number;
      roundsPlayed: number;
      winnerUserId: string | null; // null for draw
      participants: Array<{
        userId: string;
        score: number;
        isWinner: boolean;
      }>;
    }
    ```
- `GET /api/v1/matches/history` -> Paginated user match logs with filters for `gameId` and `mode`.
- `GET /api/v1/rivalry/:rivalUserId` -> Aggregated head-to-head metrics, win distributions, and streaks.

---

## 9. Admin Authorization & Moderation

### A. Security Guard
- Access to `/api/v1/admin/*` must require `role: 'admin'` verified via cryptographic JWT claim.
- Rate limiting and IP throttling on all admin endpoints.

### B. Endpoints
- `GET /api/v1/admin/overview` -> Live metrics (concurrent users, active rooms, match throughput).
- `GET /api/v1/admin/users` -> Paginated user management table.
- `POST /api/v1/admin/users/:id/status` -> Suspend or reinstate user accounts.
- `GET /api/v1/admin/games` & `PATCH /api/v1/admin/games/:id` -> Toggle game availability.
- `POST /api/v1/admin/questions` & `DELETE /api/v1/admin/questions/:id` -> Question library CRUD.
- `GET /api/v1/admin/audit-logs` -> Immutable system audit trail.

---

## 10. Private Game Answers & Adult Privacy (BETWEEN US)

### Strict Privacy Guarantee:
- **Zero Server Answer Persistence:** User answers to BETWEEN US prompts must NEVER be written to the database or logged in server request logs.
- **Ephemeral WebSockets:** In remote couple play, answers must be stored in volatile RAM until both partners submit, emitted once for simultaneous reveal, and immediately wiped from memory.
- **No Relationship Compatibility Scoring:** The backend must not analyze or score couple answers.
- **Adult Consent Verification:** Rooms launching BETWEEN US or Wild (18+) categories must verify that both participants have consented to the adult content prompt.
