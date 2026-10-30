# PlaySpace Phase 2 — REST API Reference

All room and invitation endpoints require a valid Supabase access token in the `Authorization: Bearer <token>` header.

Base URL: `http://localhost:4000/api/v1`

---

## 1. Rooms API (`/rooms`)

### `POST /api/v1/rooms`
Create a new room with the calling user as the host.

**Request Body:**
```json
{
  "name": "Friday Squad",
  "mode": "friend",
  "selectedGameId": "uno-style"
}
```

**Response (201 Created):**
```json
{
  "id": "c1f7b8f9-4670-4d87-9cb8-b0a5e8fcb4c7",
  "code": "PLAY77",
  "name": "Friday Squad",
  "mode": "friend",
  "status": "WAITING",
  "maxPlayers": 4,
  "selectedGameId": "uno-style",
  "hostId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "hostName": "Alex Rivera",
  "participants": [
    {
      "id": "part-uuid",
      "userId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "username": "alex",
      "displayName": "Alex Rivera",
      "avatarColor": "bg-[#9670E8]",
      "avatarInitials": "AR",
      "role": "HOST",
      "isReady": true,
      "isOnline": true,
      "joinedAt": "2026-10-30T10:00:00.000Z"
    }
  ],
  "gameVotes": {
    "uno-style": ["9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"]
  },
  "chatMessages": [],
  "createdAt": "2026-10-30T10:00:00.000Z",
  "expiresAt": "2026-10-30T12:00:00.000Z"
}
```

---

### `GET /api/v1/rooms/code/:code`
Look up room details and participants by 6-character room code.

**Response (200 OK):**
Returns the full room snapshot.

---

### `GET /api/v1/rooms/:id`
Look up room details by room UUID.

**Response (200 OK):**
Returns the full room snapshot.

---

### `GET /api/v1/rooms/me`
List all active rooms where the calling user is currently a participant.

**Response (200 OK):**
```json
{
  "rooms": [ /* array of room snapshots */ ]
}
```

---

### `POST /api/v1/rooms/join`
Join a room using its 6-character code.

**Request Body:**
```json
{
  "code": "PLAY77"
}
```

**Responses:**
- `200 OK`: Joined successfully; returns room snapshot.
- `400 Bad Request`: Room full or room inactive/expired.
- `404 Not Found`: Room code does not exist.

---

### `POST /api/v1/rooms/:id/leave`
Leave a room. Automatically reassigns host if the leaver was host. Closes room if empty.

**Response (200 OK):**
```json
{
  "room": { /* updated room snapshot */ },
  "hostChanged": false,
  "newHostId": null,
  "roomClosed": false,
  "leftUserId": "user-uuid"
}
```

---

### `POST /api/v1/rooms/:id/ready`
Toggle or set the participant's ready status.

**Request Body:**
```json
{
  "isReady": true
}
```

---

### `POST /api/v1/rooms/:id/vote`
Submit a vote for a game from the allowlist.

**Request Body:**
```json
{
  "gameId": "uno-style"
}
```

---

### `POST /api/v1/rooms/:id/select-game`
(Host only) Directly selects active game from allowlist.

**Request Body:**
```json
{
  "gameId": "pen-fight"
}
```

---

### `GET /api/v1/rooms/:id/can-start`
Check whether the room meets all readiness conditions to launch.

**Response (200 OK):**
```json
{
  "canStart": true
}
```
Or:
```json
{
  "canStart": false,
  "reason": "Waiting for all players to toggle Ready."
}
```

---

### `POST /api/v1/rooms/:id/transfer-host`
(Host only) Transfer host role to another active participant.

**Request Body:**
```json
{
  "newHostId": "target-user-uuid"
}
```

---

### `POST /api/v1/rooms/:id/kick`
(Host only) Remove an active participant from the room.

**Request Body:**
```json
{
  "targetUserId": "target-user-uuid"
}
```

---

### `GET /api/v1/rooms/:id/messages`
Retrieve recent chat history.

**Query Parameters:**
- `limit` (optional, default 50, max 100).

---

### `POST /api/v1/rooms/:id/messages`
Send a room chat message.

**Request Body:**
```json
{
  "message": "Let's pick Pen Fight next round!"
}
```

---

## 2. Room Invitations API (`/invitations/rooms`)

### `POST /api/v1/invitations/rooms`
Send a room invitation to a friend.

**Request Body:**
```json
{
  "roomId": "c1f7b8f9-4670-4d87-9cb8-b0a5e8fcb4c7",
  "receiverId": "target-user-uuid"
}
```

**Enforcements:**
- Caller must be an active participant in `roomId`.
- Receiver must not be blocked by sender (or vice versa).
- Room must have capacity remaining.
- Receiver must not already be in the room.
- No pending duplicate invitations.

---

### `GET /api/v1/invitations/rooms/received`
Retrieve active pending invitations for the calling user.

---

### `POST /api/v1/invitations/rooms/:id/accept`
Accept an invitation and join the room.

---

### `POST /api/v1/invitations/rooms/:id/decline`
Decline an invitation.

---

### `POST /api/v1/invitations/rooms/:id/cancel`
(Sender or Host) Cancel an active invitation.

