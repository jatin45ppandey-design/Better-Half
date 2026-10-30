# PlaySpace — Phase 4 Statistics & Rivalry System Reference
**Player Statistics, Longitudinal Aggregates, Canonical Rivalries & Reconciliation Engine**

---

## 1. Player Statistics System

The statistics subsystem aggregates individual player records across all 11 games. Statistics are updated transactionally upon each match finalization and protected by user privacy settings.

### 1.1 Privacy & Visibility
Users can configure their stats visibility in `UserSettings`:
- If `publicMatchHistory: false`, requests from other users to `GET /api/v1/stats/users/:userId` or `GET /api/v1/stats/users/:userId/games` return HTTP `403 Forbidden` (`STATS_PRIVATE`).
- Authenticated users always have full access to their own statistics via `/api/v1/stats/me`.

---

### 1.2 Statistics Endpoints

#### `GET /api/v1/stats/me`
Retrieves overall cumulative performance statistics for the authenticated player.

**Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid-1",
    "totalMatches": 48,
    "totalWins": 32,
    "totalLosses": 14,
    "totalTies": 2,
    "winRate": 0.696,
    "currentStreak": 4,
    "streakType": "WIN",
    "bestStreak": 8,
    "favoriteGame": "basketball-rivalry",
    "totalPlayTimeSeconds": 14400,
    "topGames": [
      {
        "gameId": "basketball-rivalry",
        "matchesPlayed": 20,
        "wins": 15,
        "winRate": 0.75
      },
      {
        "gameId": "uno-style",
        "matchesPlayed": 12,
        "wins": 8,
        "winRate": 0.667
      }
    ]
  }
}
```

#### `GET /api/v1/stats/me/games`
Retrieves a detailed per-game breakdown of all games the player has participated in.

**Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "gameId": "basketball-rivalry",
      "matchesPlayed": 20,
      "wins": 15,
      "losses": 5,
      "ties": 0,
      "winRate": 0.75,
      "currentStreak": 3,
      "bestStreak": 7,
      "streakType": "WIN",
      "highestScore": 21,
      "averageScore": 14.5,
      "lastPlayedAt": "2026-10-30T10:20:00.000Z"
    },
    {
      "gameId": "aloo-golf",
      "matchesPlayed": 8,
      "wins": 5,
      "losses": 3,
      "ties": 0,
      "winRate": 0.625,
      "currentStreak": 1,
      "bestStreak": 3,
      "streakType": "WIN",
      "highestScore": null,
      "averageScore": null,
      "lastPlayedAt": "2026-10-29T16:40:00.000Z"
    }
  ]
}
```

#### `GET /api/v1/stats/me/recent`
Retrieves quick summary stats alongside the player's last 5 matches.

#### `GET /api/v1/stats/users/:userId` & `GET /api/v1/stats/users/:userId/games`
Retrieves another player's stats (subject to their `publicMatchHistory` privacy preference).

---

## 2. Rivalry & Head-to-Head System

The Rivalry System tracks head-to-head performance between pairs of players who have competed in 2-player matches.

### 2.1 Canonical Pair Ordering Invariant
To guarantee data consistency, avoid race conditions, and eliminate duplicate records:
$$\text{userLowId} = \min(\text{userIdA}, \text{userIdB})$$
$$\text{userHighId} = \max(\text{userIdA}, \text{userIdB})$$

The database enforces a composite unique constraint:
`@@unique([userLowId, userHighId, gameId])`

When queries are executed by either player, the API projects the response from the perspective of the requesting user (`myWins` vs `theirWins`).

---

### 2.2 Rivalry Endpoints

#### `GET /api/v1/rivalry`
Lists all active rivalries for the authenticated user, sorted by recency and match frequency.

**Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "rivalUserId": "user-uuid-2",
      "rivalDisplayName": "Taylor",
      "rivalUsername": "taylor_player",
      "rivalAvatarUrl": "https://api.dicebear.com/7.x/bottts/svg?seed=Taylor",
      "matchesPlayed": 14,
      "myWins": 9,
      "theirWins": 5,
      "ties": 0,
      "leadType": "I_LEAD",
      "leadMargin": 4,
      "currentStreakLeader": "ME",
      "currentStreakCount": 3,
      "lastPlayedAt": "2026-10-30T10:20:00.000Z"
    }
  ]
}
```

#### `GET /api/v1/rivalry/:rivalUserId`
Fetches in-depth head-to-head metrics against a specific opponent, including per-game rivalry breakdowns.

#### `GET /api/v1/rivalry/:rivalUserId/history`
Fetches paginated past matches played exclusively between the authenticated player and the given rival.

---

## 3. Reconciliation Engine

If system errors or edge conditions create drift between raw match participants and statistical aggregates, administrators can invoke the authoritative reconciliation engine:

- **Method**: `POST /api/v1/admin/stats/reconcile/:userId`
- **Mechanism**:
  1. Queries all immutable `MatchParticipant` records where `userId = targetUserId`.
  2. Aggregates true matches played, wins (`isWinner = true` or `outcome = 'WIN'`), losses, ties, and streaks by ordered completion timestamp.
  3. Atomically upserts the calculated values into `UserGameStats`.
  4. Records the repair event in the immutable `AuditLog`.

