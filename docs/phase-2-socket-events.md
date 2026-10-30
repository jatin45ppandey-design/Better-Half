# PlaySpace Phase 2 — Socket.IO Real-Time Events Reference

PlaySpace uses Socket.IO v4.x running on the same HTTP server (`0.0.0.0:4000`).

---

## 1. Authentication Handshake

Clients must provide their Supabase access token during the Socket.IO connection handshake:

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: {
    token: supabaseAccessToken,
  },
  transports: ['websocket', 'polling'],
});
```

Connections lacking a valid token or carrying an expired token are rejected with:
`Error: Authentication failed: Invalid, expired, or revoked token`

---

## 2. Client-to-Server Events (`ClientToServerEvents`)

| Event Name | Payload | Callback Signature | Description |
|---|---|---|---|
| `room:join` | `{ roomId?: string; code?: string }` | `(res: { success: boolean; error?: string; room?: RoomSnapshot }) => void` | Joins a room, joins socket room channel, tracks presence. |
| `room:leave` | `{ roomId: string }` | `(res: { success: boolean; error?: string }) => void` | Leaves room and broadcasts updated room/host. |
| `room:ready:update` | `{ roomId: string; isReady: boolean }` | `(res: { success: boolean; error?: string; isReady?: boolean }) => void` | Updates ready status and recalculates room readiness. |
| `room:game:vote` | `{ roomId: string; gameId: string }` | `(res: { success: boolean; error?: string; votes?: Record<string, string[]> }) => void` | Submits vote for a game from allowlist. |
| `room:game:select` | `{ roomId: string; gameId: string }` | `(res: { success: boolean; error?: string }) => void` | (Host) Selects primary game. |
| `room:start:prepare` | `{ roomId: string }` | `(res: { success: boolean; error?: string }) => void` | (Host) Validates readiness and triggers launch sequence. |
| `room:host:transfer` | `{ roomId: string; newHostId: string }` | `(res: { success: boolean; error?: string }) => void` | (Host) Reassigns host to participant. |
| `room:player:kick` | `{ roomId: string; targetUserId: string }` | `(res: { success: boolean; error?: string }) => void` | (Host) Removes participant. |
| `room:chat:send` | `{ roomId: string; message: string }` | `(res: { success: boolean; error?: string; message?: RoomMessageSnapshot }) => void` | Sends chat message; persisted to DB. |
| `room:reaction:send` | `{ roomId: string; reaction: string }` | `(res: { success: boolean; error?: string }) => void` | Transient reaction/emoji with rate limiting. |

---

## 3. Server-to-Client Events (`ServerToClientEvents`)

Broadcasts target the channel `room:${roomId}`.

| Event Name | Payload | Description |
|---|---|---|
| `room:state` | `RoomSnapshot` | Full room snapshot (emitted on join, game select, vote updates, etc.). |
| `room:player:joined` | `{ participant: RoomParticipantSnapshot }` | Emitted when a new player connects to the room. |
| `room:player:left` | `{ userId: string; newHostId?: string; roomClosed?: boolean }` | Emitted when a player leaves or is disconnected past grace period. |
| `room:player:ready` | `{ userId: string; isReady: boolean; roomStatus: string }` | Emitted when a player toggles their ready status. |
| `room:game:voted` | `{ userId: string; gameId: string; votes: Record<string, string[]> }` | Emitted when a game vote is recorded. |
| `room:game:selected` | `{ selectedGameId: string }` | Emitted when the host selects a game. |
| `room:start:launch` | `{ gameId: string; launchedAt: string }` | Emitted when the match begins, instructing clients to transition. |
| `room:host:changed` | `{ hostId: string; hostName?: string }` | Emitted when the host role transfers. |
| `room:player:kicked` | `{ targetUserId: string }` | Emitted when a player is removed by the host. |
| `room:chat:new` | `RoomMessageSnapshot` | Emitted when a chat message is sent. |
| `room:reaction:new` | `{ senderId: string; reaction: string; timestamp: string }` | Transient floating emoji reaction. |
| `room:presence:update` | `{ onlineUserIds: string[] }` | Real-time list of participants currently online. |
| `room:error` | `{ code: string; message: string }` | Direct error message emitted to a specific socket. |

---

## 4. Presence & Grace Period Invariants

- Socket disconnects do NOT instantly flash players as offline.
- A **15-second grace period timer** is initiated in `presenceManager`.
- If the socket reconnects (e.g., page navigation, reload, or temporary network blip) within 15 seconds, the timer is cleared and the player remains continuously online.
- If 15 seconds elapse without reconnection, `presenceManager` broadcasts `room:presence:update` with the updated list of online users.

