# PlaySpace Wave 4 — Incident Response & Privacy Operations Manual

This document outlines the standard operating procedures (SOPs) for handling security incidents, privacy requests, and data governance for PlaySpace.

---

## 1. Incident Response Playbooks

### 1.1 Leaked Secret / Key Procedure
- **Trigger**: Any API key, database password, or service role key committed to source control or detected in application logs.
- **Immediate Containment**:
  1. **Revoke and Rotate**: Follow the zero-downtime rotation protocol in `docs/wave-4-credential-rotation.md`.
  2. **Audit Exposure**: Inspect Supabase and Render access logs for suspicious IP addresses during the exposure window.
  3. **Invalidate Active Sessions**: If `SUPABASE_JWT_SECRET` or `SESSION_SECRET` was exposed, trigger user session invalidation.
  4. **Post-Mortem**: Document exposure root cause and update pre-commit secret scanning hooks.

### 1.2 Compromised Administrator Account
- **Trigger**: Unauthorized administrative action detected in `AuditLog` table or alert of unusual admin login.
- **Immediate Containment**:
  1. **Immediate Revocation**: A second active administrator executes:
     ```sql
     DELETE FROM "AppRole" WHERE "userId" = 'compromised_user_id';
     UPDATE "UserProfile" SET "accountStatus" = 'SUSPENDED' WHERE "id" = 'compromised_user_id';
     ```
  2. **Active Disconnect**: The user's active sockets will be disconnected and further API calls blocked via `requireAuth` (`403 Forbidden`).
  3. **Audit Log Inspection**: Review all entries in `AuditLog` where `actorUserId = 'compromised_user_id'`. Revert any unauthorized game configuration changes or unsanctioned user status changes.

### 1.3 Database Exposure / Data Breach
- **Trigger**: Notification of exposed database endpoint, leaked connection string, or unauthorized data dump.
- **Immediate Containment**:
  1. **Rotate Credentials**: Immediately reset the Supabase database password, rotating `DATABASE_URL` and `DIRECT_URL`.
  2. **Network Isolation**: Ensure database access is restricted via Supabase IP allowlisting and SSL-only connections (`sslmode=require`).
  3. **Impact Assessment**: Note that sensitive *Between Us* game answers are never persisted to action audit logs (`GameAction` metadata strips answer text). In-flight answers are scoped strictly to per-participant private records (`GameSessionParticipant.privateState`) during the answering phase solely for restart durability, and private buffers are cleared upon reveal.
  4. **Regulatory Notification**: If personal user profile data (emails, display names) was accessed, notify users and relevant supervisory authorities within 72 hours under GDPR Article 33.

### 1.4 Abusive User / Harassment Procedure
- **Trigger**: Report of abusive user behavior, offensive usernames, room chat harassment, or rate-limit probing.
- **Immediate Containment**:
  1. **Account Suspension**: An administrator or moderator suspends the offending user via the Admin Dashboard (`PATCH /api/v1/admin/users/:userId/status` -> `SUSPENDED`).
  2. **Realtime Disconnect**: The server automatically closes the user's active WebSocket connection and closes/transfers hosted rooms (`handleUserSuspension`).
  3. **Social Graph Isolation**: Offended users can invoke `POST /api/v1/users/block/:targetUserId` to instantly suppress incoming invitations, chat messages, and rivalry stats.

### 1.5 Service Outage & Degradation Procedure
- **Trigger**: `/api/v1/health` or `/api/v1/ready` reporting degraded status (e.g. database pooler timeout).
- **Immediate Containment**:
  1. **Inspect Readiness Probe**: Check `/api/v1/ready` response payload (`status: degraded, database: disconnected`).
  2. **Check Supabase Pooler**: Verify status of `aws-0-eu-west-1.pooler.supabase.com:6543`.
  3. **Graceful Restart**: Send `SIGTERM` to the container to invoke `createShutdownHandler`, draining in-flight requests before container replacement.

---

## 2. Privacy & Data Governance

### 2.1 Encryption Standards
- **Data in Transit**: Enforced TLS 1.3 for all HTTP REST traffic, WebSocket connections (`wss://`), and database connections (`sslmode=require`).
- **Data at Rest**: Supabase PostgreSQL volumes and automated daily backups are encrypted with AES-256.
- **Intimate Conversation Protection**: *Between Us* questions and answers are protected by a multi-layered privacy model:
  - During the `ANSWERING` phase, answers are scoped strictly to the author's `GameSessionParticipant.privateState` to prevent loss during server restarts/crashes.
  - Action audit logs (`GameAction`) strip all answer text (`sanitizeActionMetadata`).
  - Public projections conceal all answer text (`revealedAnswers: null`), revealing only participant submission presence (`submittedUserIds`).
  - Private projections reveal pending text only to the authenticated author.
  - Upon mutual reveal (`REVEAL` phase), participant private buffers are cleared (`pendingAnswer: null`).

### 2.2 Data Retention Policies

| Entity | Retention Period | Purge Mechanism |
|:---|:---:|:---|
| Active Game Rooms | 24 Hours | Handled automatically every 5 minutes by `cleanupExpiredRooms()`. |
| Room Messages (Chat) | Lifetime of Room (24h) | Cascading foreign key delete when room is purged. |
| Match Records & History | Indefinite (User Lifetime) | Retained for lifetime statistics and rivalry records. |
| Audit Logs | 365 Days | Retained for compliance and audit trail integrity. |
| Between Us Answers | In-Flight Session Only | Scoped to participant privateState during answering; cleared upon reveal (`pendingAnswer: null`); purged on room expiry. |

### 2.3 Account Deletion (GDPR / CCPA Right to Erasure)
Upon user request for account deletion:
1. Delete user profile record in `UserProfile`.
2. Database cascading deletes automatically remove:
   - `RoomParticipant` records.
   - `UserSettings` records.
   - `Friend` relationships.
   - `BlockedUser` records.
   - `AppRole` assignments.
3. Match history participants retain anonymized historical placement and scores with `userId = NULL` or `playerNameSnapshot` to preserve statistical integrity for remaining players without storing personal identifiers.

### 2.4 User Data Export (Right to Access)
Users may export their personal profile, match history, and aggregated statistics via the profile settings interface (`GET /api/v1/users/profile` and `GET /api/v1/matches/history`).
