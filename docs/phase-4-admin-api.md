# PlaySpace — Phase 4 Admin API Reference
**System Overview, User Moderation, Game Availability, Question Library & Audit Logging**

---

## 1. Overview & Access Control

All endpoints under `/api/v1/admin` require authenticated administrator or moderator privileges:
- **`requireAdmin`**: Required for role assignment, game configuration, stats reconciliation, and question seeding.
- **`requireModerator`**: Required for user status updates, warnings, and question catalog maintenance.
- Unauthorized callers receive HTTP `403 Forbidden` (`FORBIDDEN_ADMIN_REQUIRED` or `FORBIDDEN_MODERATOR_REQUIRED`).

---

## 2. API Endpoints

### 2.1 Platform Overview Metrics
- **Method**: `GET`
- **Path**: `/api/v1/admin/overview`
- **Role**: Moderator or Admin

```json
{
  "success": true,
  "data": {
    "totalUsers": 128,
    "activeRooms": 4,
    "activeSessions": 2,
    "matchesCompleted": 342,
    "gameConfigurations": 11,
    "questionLibrarySize": 265,
    "serviceHealth": "OPERATIONAL"
  }
}
```

---

### 2.2 User Moderation & Status Management

#### `GET /api/v1/admin/users`
Lists user accounts with role badges, status, and last active timestamp.

#### `PATCH /api/v1/admin/users/:userId/status`
Updates account status (`ACTIVE`, `SUSPENDED`).
- **Safety Rule**: Administrators cannot suspend their own accounts.
- **Enforcement**: Suspending a user immediately terminates any active WebSocket connection.

**Request Body**:
```json
{
  "status": "SUSPENDED",
  "reason": "Violating terms of service and disruptive chat behavior",
  "note": "Reported by room participants"
}
```

#### `POST /api/v1/admin/users/:userId/roles`
Grants or revokes administrative roles (`ADMIN`, `MODERATOR`).
- **Role**: Admin only.

**Request Body**:
```json
{
  "role": "MODERATOR",
  "action": "GRANT"
}
```

---

### 2.3 Game Catalog & Mode Configuration

#### `GET /api/v1/admin/games`
Lists current operational settings for all 11 games.

#### `PATCH /api/v1/admin/games/:gameId`
Updates game status and mode availability.
- **Validation Rule**: Couple-only games (`truth-or-dare`, `would-you-rather`, `between-us`) cannot have `friendModeEnabled = true`.

**Request Body**:
```json
{
  "isEnabled": true,
  "coupleModeEnabled": true,
  "friendModeEnabled": false,
  "maintenanceNotice": null
}
```

---

### 2.4 Question Library Management

#### `POST /api/v1/admin/questions/seed`
Idempotently populates the database question catalog from the canonical game question repositories (`truthOrDareQuestions.ts`, `wouldYouRatherQuestions.ts`, `betweenUsQuestions.ts`).

#### `GET /api/v1/admin/questions`
Query questions by game ID, category, or intensity.

#### `POST /api/v1/admin/questions`
Adds a new question to the library.

**Request Body (Would You Rather)**:
```json
{
  "gameId": "would-you-rather",
  "category": "Couples",
  "intensity": 2,
  "prompt": "Would you rather have a quiet dinner or go dancing?",
  "optionA": "Have a quiet candlelit dinner",
  "optionB": "Go to a vibrant dance club"
}
```

#### `DELETE /api/v1/admin/questions/:questionId`
Deactivates or deletes a question entry.

---

### 2.5 Audit Log
- **Method**: `GET`
- **Path**: `/api/v1/admin/audit-logs`
- **Role**: Admin only

Retrieves recent append-only administrative logs with actor metadata and sanitized action details.

---

## 3. Operator Bootstrap CLI Script

When initializing a new environment, no user possesses the `ADMIN` role. Operators bootstrap the initial administrator directly from the server terminal:

```bash
cd server
npm run admin:grant -- --user-id <SUPABASE_USER_UUID>
```

**Options**:
- `--user-id <UUID>`: Specific Supabase User UUID to grant `ADMIN` role.
- If omitted, the script lists the 10 most recent user profiles in the database for selection.

