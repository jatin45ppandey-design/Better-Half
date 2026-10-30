# PlaySpace — Phase 1 REST API Reference

Base URL: `http://localhost:4000/api/v1` (or production Render URL)

All protected endpoints require the HTTP header:
```http
Authorization: Bearer <supabase_access_token>
```

---

## 1. System & Health

### `GET /health`
Returns service status, uptime, and timestamp.
- **Auth:** Not required.
- **Response (200):**
```json
{
  "status": "ok",
  "service": "playspace-api",
  "uptime": 124,
  "timestamp": "2026-10-30T14:40:00.000Z"
}
```

### `GET /ready`
Performs readiness verification against Supabase PostgreSQL without exposing database host or credentials.
- **Auth:** Not required.
- **Response (200 OK / 503 Service Unavailable):**
```json
{
  "status": "ready",
  "database": "connected",
  "timestamp": "2026-10-30T14:40:00.000Z"
}
```

---

## 2. Profiles

### `GET /profiles/me`
Fetches or bootstraps the authenticated user's profile and settings.
- **Auth:** Required.
- **Response (200):**
```json
{
  "id": "c1f7b74e-7b70-4d56-834c-6a7f85859e9a",
  "username": "alex_rivera",
  "displayName": "Alex Rivera",
  "avatarUrl": "https://lh3.googleusercontent.com/...",
  "avatarInitials": "AR",
  "avatarColor": "#9670E8",
  "bio": "Ready for couple showdowns!",
  "createdAt": "2026-10-30T14:00:00.000Z",
  "updatedAt": "2026-10-30T14:00:00.000Z",
  "settings": {
    "showOnlineStatus": true,
    "allowDirectInvites": true,
    "publicMatchHistory": true,
    "ghostMode": false,
    "soundMuted": false,
    "volume": 0.8,
    "reducedMotion": false
  }
}
```

### `PATCH /profiles/me`
Updates editable fields on the authenticated user's profile.
- **Auth:** Required.
- **Request Body (JSON):**
```json
{
  "displayName": "Alex Rivera Pro",
  "username": "alex_r",
  "bio": "Master of Aloo Golf and Card Games",
  "avatarColor": "#593B91",
  "avatarInitials": "AP"
}
```
- **Response (200):** Updated `UserProfile` object.
- **Errors:**
  - `400`: Invalid parameters (e.g. invalid username format).
  - `409`: Username already taken.

### `GET /profiles/search?q={query}`
Searches users by username or display name. Never returns email. Excludes blocked users and current user.
- **Auth:** Required.
- **Response (200):**
```json
{
  "results": [
    {
      "id": "d2f8c85f-8c81-5e67-945d-7b8f96960f0b",
      "username": "jordan_t",
      "displayName": "Jordan Taylor",
      "avatarUrl": null,
      "avatarInitials": "JT",
      "avatarColor": "#593B91",
      "bio": "Couple game champion",
      "createdAt": "2026-10-30T14:00:00.000Z"
    }
  ]
}
```

### `GET /profiles/:username`
Fetches public profile by username.
- **Auth:** Optional.
- **Response (200):** Public profile payload.
- **Response (404):** User not found.

---

## 3. Settings

### `GET /settings`
Fetches current user's preferences.
- **Auth:** Required.
- **Response (200):** `UserSettings` object.

### `PATCH /settings`
Updates preferences.
- **Auth:** Required.
- **Request Body (JSON):**
```json
{
  "showOnlineStatus": true,
  "allowDirectInvites": true,
  "publicMatchHistory": true,
  "ghostMode": false,
  "soundMuted": false,
  "volume": 0.85,
  "reducedMotion": false
}
```
- **Response (200):** Updated `UserSettings` object.

---

## 4. Friends & Social

### `GET /friends`
Lists all confirmed friends.
- **Auth:** Required.
- **Response (200):**
```json
{
  "friends": [
    {
      "id": "d2f8c85f-8c81-5e67-945d-7b8f96960f0b",
      "username": "jordan_t",
      "displayName": "Jordan Taylor",
      "avatarUrl": null,
      "avatarInitials": "JT",
      "avatarColor": "#593B91",
      "bio": "Couple game champion",
      "showOnlineStatus": true,
      "since": "2026-10-30T14:15:00.000Z"
    }
  ]
}
```

### `GET /friends/requests`
Lists pending friend requests.
- **Auth:** Required.
- **Response (200):**
```json
{
  "incoming": [
    {
      "id": "e3a9d97a-9d92-6f78-056e-8c0a07071a1c",
      "createdAt": "2026-10-30T14:10:00.000Z",
      "user": {
        "id": "...",
        "username": "elena_r",
        "displayName": "Elena Rostova",
        "avatarUrl": null,
        "avatarInitials": "ER",
        "avatarColor": "#EC4899"
      }
    }
  ],
  "outgoing": []
}
```

### `POST /friends/requests`
Sends a friend request by `receiverId` (UUID) or `username`.
- **Auth:** Required.
- **Request Body (JSON):**
```json
{
  "receiverId": "d2f8c85f-8c81-5e67-945d-7b8f96960f0b"
}
```
*OR*
```json
{
  "username": "jordan_t"
}
```
- **Response (201):** `{ "id": "...", "status": "PENDING", "message": "Friend request sent" }`
- **Errors:**
  - `400`: Attempting to add oneself.
  - `403`: Blocked interaction.
  - `409`: Already friends or request already pending.

### `POST /friends/requests/:requestId/accept`
Accepts an incoming friend request. Only the receiver can accept.
- **Auth:** Required.
- **Response (200):** `{ "success": true, "message": "Friend request accepted" }`

### `POST /friends/requests/:requestId/reject`
Declines an incoming friend request. Only the receiver can decline.
- **Auth:** Required.
- **Response (200):** `{ "success": true, "message": "Friend request declined" }`

### `DELETE /friends/requests/:requestId`
Cancels an outgoing friend request. Only the sender can cancel.
- **Auth:** Required.
- **Response (200):** `{ "success": true, "message": "Friend request cancelled" }`

### `DELETE /friends/:friendId`
Removes an established friend.
- **Auth:** Required.
- **Response (200):** `{ "success": true, "message": "Friend removed" }`

---

## 5. Blocks

### `GET /blocks`
Lists all users blocked by the authenticated user.
- **Auth:** Required.
- **Response (200):** `{ "blocked": [...] }`

### `POST /blocks/:userId`
Blocks a user. Automatically dissolves existing friendship and cancels pending friend requests in a transaction.
- **Auth:** Required.
- **Response (200):** `{ "success": true, "message": "User blocked" }`

### `DELETE /blocks/:userId`
Unblocks a previously blocked user.
- **Auth:** Required.
- **Response (200):** `{ "success": true, "message": "User unblocked" }`

