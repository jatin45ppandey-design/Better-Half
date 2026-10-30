# PlaySpace — Phase 4 Security & RBAC Reference
**Access Control Architecture, Account Lifecycle, Ephemeral Privacy & Audit Integrity**

---

## 1. Role-Based Access Control (RBAC) Architecture

PlaySpace implements a multi-tiered security model governing all HTTP routes, WebSocket interactions, and database entities.

### 1.1 Role Hierarchy

| Role | Permissions |
|---|---|
| `USER` | Standard player access: Profile management, friend social graph, room creation/joining, matchmaking, and gameplay synchronization. |
| `MODERATOR` | Inherits `USER` permissions. User moderation: account suspensions, disciplinary warnings, question library editing, and platform metrics viewing. |
| `ADMIN` | Inherits `MODERATOR` permissions. Full system administration: role assignment (`ADMIN`, `MODERATOR`), game availability management, question seeding, database stats reconciliation, and audit log inspection. |

---

## 2. Enforcement Mechanisms

### 2.1 Route Middleware
- **`requireAuth`**: Validates Supabase JWT, resolves user identity, and blocks suspended accounts (`403 Forbidden`).
- **`requireAdmin`**: Verifies caller holds an active `ADMIN` role in `AppRole` table (`403 FORBIDDEN_ADMIN_REQUIRED`).
- **`requireModerator`**: Verifies caller holds an active `ADMIN` or `MODERATOR` role (`403 FORBIDDEN_MODERATOR_REQUIRED`).
- **`checkAccountStatus`**: Secondary interceptor that blocks accounts with `accountStatus === 'SUSPENDED'`.

### 2.2 WebSocket Handshake & Active Disconnect
1. **Connection Rejection**: In `server/src/socket/authMiddleware.ts`, incoming socket connections check user profile account status. If suspended, the socket handshake is rejected immediately with:
   `next(new Error('Account is suspended. Access denied.'));`
2. **Active Disconnect**: When an administrator suspends a user via `PATCH /api/v1/admin/users/:userId/status`, the backend immediately iterates connected sockets for that user ID and calls `socket.disconnect(true)`.

### 2.3 Self-Moderation Safeguards
To prevent accidental operator lockout, the system strictly forbids administrators from suspending their own accounts. Attempting to moderate one's own account status results in `400 Bad Request` ("Administrators cannot moderate their own account").

---

## 3. Ephemeral Privacy Design

PlaySpace features intimate couple games designed for vulnerable, private conversation. To preserve trust:

```
┌────────────────────────────────────────────────────────┐
│                   BETWEEN US ARCHITECTURE              │
├────────────────────────────────────────────────────────┤
│ Partner A Answer ───┐                                  │
│                     ▼                                  │
│         [ Node.js Memory RAM (Volatile) ]              │
│                     ▲                                  │
│ Partner B Answer ───┘                                  │
│         │                                              │
│         ▼                                              │
│ [ Simultaneous Reveal via WebSocket ]                  │
│         │                                              │
│         ▼                                              │
│ [ RAM Flushed & Cleaned Immediately ]                  │
│         │                                              │
│         ❌ NEVER WRITTEN TO POSTGRESQL / LOGS          │
└────────────────────────────────────────────────────────┘
```

- **Zero Answers in Persistence**: Neither the `Match` table, `MatchParticipant` table, `GameAction` table, nor `AuditLog` ever record the textual contents of BETWEEN US player answers or Would You Rather dilemma choices.
- **Sanitized Action Logs**: Game actions logged during Phase 3 transactional persistence strip sensitive private fields before writing to PostgreSQL.

---

## 4. Audit Trail Integrity

The `AuditLog` table serves as an append-only legal and diagnostic record of all administrative interventions:
- Actor ID, action type, target type, target ID, metadata, and IP address.
- Database constraints and service methods provide no `UPDATE` or `DELETE` interfaces for audit logs.
- Sensitive credentials, authorization tokens, and personal answers are completely scrubbed before recording audit metadata.

