# PlaySpace Phase 3 — Multiplayer REST API Reference

This document provides complete documentation for the REST API endpoints supporting real-time game sessions, state initialization, and session management.

All routes are mounted at `/api/v1/games` and require an authenticated user session (`Authorization: Bearer <supabase_access_token>`).

---

## 1. Start Game Session

Initializes a server-authoritative game session for a room that is currently in `READY_TO_START` or `WAITING` status.

- **URL**: `POST /api/v1/games/rooms/:roomId/start`
- **Auth Required**: Yes (`Bearer <token>`)
- **Authority**: Room Host only

### Request Parameters
| Parameter | Location | Type | Description |
|---|---|---|---|
| `roomId` | Path | `string` | Room UUID or 6-character room code |

### Request Body
```json
{
  "gameId": "truth-or-dare"
}
```
*(Optional if already selected in room metadata)*

### Response: `201 Created`
```json
{
  "success": true,
  "data": {
    "sessionId": "gs-1740000000-a1b2c",
    "roomCode": "COUPLE",
    "gameId": "truth-or-dare",
    "mode": "couple",
    "currentTurnUserId": "usr-1234-uuid",
    "stateVersion": 1,
    "scores": {
      "usr-1234-uuid": 0,
      "usr-5678-uuid": 0
    },
    "participants": [
      { "userId": "usr-1234-uuid", "name": "Alex", "seatIndex": 0, "isHost": true },
      { "userId": "usr-5678-uuid", "name": "Jordan", "seatIndex": 1, "isHost": false }
    ],
    "publicState": {
      "turn": 1,
      "activePlayerId": "usr-1234-uuid",
      "phase": "CATEGORY_SELECT",
      "skipsUsed": { "usr-1234-uuid": 0, "usr-5678-uuid": 0 }
    }
  }
}
```

### Errors
- `401 Unauthorized`: Missing or invalid Supabase bearer token.
- `403 Forbidden`: Authenticated user is not the room host.
- `400 Bad Request`: Room player count does not satisfy game requirements (e.g. Couple Mode requires exactly 2 players, Friend Mode requires 2–4 players, unready players).
- `404 Not Found`: Room does not exist or has expired.

---

## 2. Get Game Session Metadata

Retrieves current status, participants, and session lifecycle metadata.

- **URL**: `GET /api/v1/games/sessions/:sessionId`
- **Auth Required**: Yes (`Bearer <token>`)

### Request Parameters
| Parameter | Location | Type | Description |
|---|---|---|---|
| `sessionId` | Path | `string` | Unique GameSession ID (`gs-...`) |

### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "sessionId": "gs-1740000000-a1b2c",
    "gameId": "tic-tac-toe",
    "mode": "couple",
    "status": "ACTIVE",
    "isPaused": false,
    "version": 3,
    "currentTurnUserId": "usr-1234-uuid",
    "scores": {
      "usr-1234-uuid": 1,
      "usr-5678-uuid": 0
    },
    "participants": [
      { "userId": "usr-1234-uuid", "name": "Alex", "seatIndex": 0, "isHost": true },
      { "userId": "usr-5678-uuid", "name": "Jordan", "seatIndex": 1, "isHost": false }
    ]
  }
}
```

---

## 3. Get Authoritative State Snapshot

Fetches the complete public projection of the game session alongside the requesting user's private state projection.

- **URL**: `GET /api/v1/games/sessions/:sessionId/state`
- **Auth Required**: Yes (`Bearer <token>`)

### Request Parameters
| Parameter | Location | Type | Description |
|---|---|---|---|
| `sessionId` | Path | `string` | Unique GameSession ID (`gs-...`) |

### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "sessionId": "gs-1740000000-a1b2c",
    "gameId": "original-card-game",
    "version": 5,
    "publicState": {
      "activePlayerId": "usr-1234-uuid",
      "direction": "CW",
      "topCard": { "id": "card-red-7-1", "color": "red", "value": "7" },
      "currentColor": "red",
      "drawPileCount": 42,
      "cardCounts": {
        "usr-1234-uuid": 6,
        "usr-5678-uuid": 7
      }
    },
    "privateState": {
      "hand": [
        { "id": "card-blue-7-2", "color": "blue", "value": "7" },
        { "id": "card-red-2-1", "color": "red", "value": "2" },
        { "id": "card-wild-1", "color": "wild", "value": "wild" }
      ]
    }
  }
}
```

---

## 4. Request Match Rematch

Resets the active game engine state with a newly initialized seed, retaining room participants and score counters.

- **URL**: `POST /api/v1/games/sessions/:sessionId/rematch`
- **Auth Required**: Yes (`Bearer <token>`)

### Request Parameters
| Parameter | Location | Type | Description |
|---|---|---|---|
| `sessionId` | Path | `string` | Unique GameSession ID (`gs-...`) |

### Response: `200 OK`
```json
{
  "success": true,
  "data": {
    "sessionId": "gs-1740000000-a1b2c",
    "version": 1,
    "status": "ACTIVE",
    "publicState": { ... }
  }
}
```
*(Also broadcasts `game:state` to all room sockets)*

