# PlaySpace — Backend Architecture & System Design
## Phase 1 & Phase 2: Backend Foundation + Real Multiplayer Rooms + Socket.IO

---

## 1. System Overview

PlaySpace is a real-time multiplayer gaming platform designed for couples and friends.
- **Phase 1** established the production backend foundation with Supabase Auth, Prisma ORM, PostgreSQL, user profiles, and social relationships.
- **Phase 2** integrates real-time multiplayer rooms, Socket.IO bidirectional communication, server-authoritative room state, game voting/selection allowlists, room invitations, room chat, and in-memory presence tracking with reconnection grace periods.

```
┌─────────────────────────────────────────────────────────────┐
│                  PlaySpace Frontend (Vite + React 19)       │
│  - Supabase OAuth Client SDK                                │
│  - Typesafe API Client (`src/services/api.ts`)              │
│  - Socket.IO Client Singleton (`src/services/socket.ts`)    │
│  - Real-time RoomContext & Live Lobby                       │
└──────────────────────────────┬──────────────────────────────┘
                               │
               HTTPS / Bearer  │ Supabase Access Token
               WSS / Handshake │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│       PlaySpace Express + Socket.IO Backend (Node.js)       │
│  - Single Port (0.0.0.0:4000) for REST + WebSockets         │
│  - Helmet Security Headers & CORS                           │
│  - Rate Limiting Middleware                                 │
│  - Supabase Token Verification (REST + Socket Handshake)    │
│  - Server-Authoritative Allowlist & Capacity Enforcement     │
│  - In-Memory PresenceManager (15s Reconnect Grace Period)   │
│  - Unified Error Handler & Zod Validation                   │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌──────────────────────────────┐ ┌─────────────────────────────┐
│      Supabase Auth API       │ │    Supabase PostgreSQL       │
│  - Google OAuth Authority    │ │  - Prisma ORM 6.x           │
│  - Cryptographic token issue │ │  - PgBouncer Pooled Runtime │
│  - User UUID authority       │ │  - Direct Migration Channel │
└──────────────────────────────┘ └─────────────────────────────┘
```

---

## 2. Core Architectural Decisions

| Layer | Technology | Rationale & Responsibility |
|---|---|---|
| **Frontend** | React 19 + TypeScript + Vite | High-performance SPA, lavender & white brand identity. |
| **Authentication** | Supabase Auth (Google OAuth) | OAuth redirection, PKCE, token refresh, and user UUID identity. |
| **Backend API** | Node.js + Express + TypeScript | REST API located in `server/`, binds to `0.0.0.0:4000`. |
| **Real-time WebSockets** | Socket.IO (v4.x) | Bidirectional room state, presence, chat, and event sync on same HTTP server. |
| **Database** | Supabase PostgreSQL | Managed relational database with ACID guarantees and relational integrity. |
| **ORM** | Prisma 6.x | Schema management, typesafe queries, and automated SQL migrations. |
| **Presence & Cache** | In-Memory PresenceManager | 15s disconnect grace period, online user tracking without Redis overhead. |
| **Validation** | Zod | Runtime contract validation for request parameters, bodies, and environment variables. |
| **Backend Hosting** | Render | Docker/Node Web Service with health check monitoring and zero-downtime deploys. |

---

## 3. Security & Integrity Invariants

1. **Sole Authentication Authority:**
   All authentication is mediated by Supabase Auth with Google OAuth. Neither frontend nor backend stores passwords.
2. **Cryptographic Token Verification:**
   Every protected endpoint and every Socket.IO handshake strictly validates the `Authorization: Bearer <supabase_access_token>` against Supabase Auth.
3. **No Client-Supplied Identity Trust:**
   The backend derives `req.user.id` and `socket.data.userId` purely from the verified JWT.
4. **Server-Authoritative Room Capacity:**
   - **Couple Mode**: Exactly 2 players. Max capacity: 2.
   - **Friend Mode**: Up to 4 players. Minimum 2 to start.
   All joins, invites, and launches are checked in PostgreSQL transactions.
5. **Server Game Mode Allowlist:**
   - `truth-or-dare`, `would-you-rather`, `between-us`: Couple Mode exclusive.
   - `blind-ranking`, `uno-style`, `tic-tac-toe`, `pen-fight`, `kabza`, `basketball-rivalry`, `snatch-the-fries`, `aloo-golf`: Both modes.
6. **Presence Grace Period:**
   Disconnects initiate an in-memory 15-second grace period timer. Reconnections within 15 seconds prevent disruptive offline flicker.
7. **Host Migration & Room Lifecycle:**
   When the host disconnects or leaves, host privileges automatically transfer to the oldest remaining participant. If all participants leave, the room automatically closes.

---

## 4. Prisma Database Models

### Phase 1 Models:
- `UserProfile`: User metadata, username, display name, avatar configuration.
- `UserSettings`: Audio preferences, privacy flags, motion settings.
- `FriendRequest`: Directed friendship requests.
- `Friendship`: Mutual verified friendships.
- `BlockedUser`: User blocks with cascading unfriend/request cancellation.

### Phase 2 Models:
- `Room`:
  - `id`: UUID primary key.
  - `code`: 6-character uppercase room code (e.g. `LOVE22`, `PLAY69`).
  - `hostId`: Foreign key to `UserProfile.id`.
  - `name`: Display room name.
  - `mode`: `"COUPLE"` or `"FRIEND"`.
  - `status`: `"WAITING"`, `"READY_TO_START"`, `"IN_PROGRESS"`, `"COMPLETED"`, `"CLOSED"`, `"EXPIRED"`.
  - `selectedGameId`: Selected game ID from allowlist.
  - `maxPlayers`: Capacity constraint (2 for Couple, 4 for Friend).
  - `expiresAt`: Room expiration timestamp.
- `RoomParticipant`:
  - `roomId` + `userId` (unique composite index).
  - `role`: `"HOST"` or `"PLAYER"`.
  - `isReady`: Participant readiness flag.
  - `joinedAt` / `leftAt`: Temporal tracking for leaves and re-joins.
- `RoomInvitation`:
  - `roomId`, `senderId`, `receiverId`.
  - `status`: `"PENDING"`, `"ACCEPTED"`, `"DECLINED"`, `"CANCELLED"`, `"EXPIRED"`.
  - `expiresAt`: 15-minute expiration timestamp.
- `RoomMessage`:
  - `roomId`, `senderId`, `message`, `createdAt`.
- `GameVote`:
  - `roomId` + `userId` (unique composite index).
  - `gameId`: Voted game ID.
