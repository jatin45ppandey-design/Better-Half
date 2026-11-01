# PlaySpace — Production Deployment Readiness Guide
**Production Hosting, Environment Configurations, Migration Deployments & Operational Runbook**

---

## 1. Production Architecture Overview

| Component | Provider | Configuration |
|---|---|---|
| **Frontend** | Vercel | Vite SPA, React 19, TypeScript, Tailwind CSS 4 |
| **Backend** | Render | Node.js 20+, Express, Socket.IO, Prisma 6, TypeScript |
| **Database** | Supabase | PostgreSQL 15+ (Transaction Pooler port 6543 / Session port 5432) |
| **Authentication** | Supabase Auth | Google OAuth provider, JWT issuance |

---

## 2. Environment Variables Checklist

### 2.1 Backend (Render Environment)
```ini
# Application
NODE_ENV=production
PORT=10000

# CORS & Client URLs
FRONTEND_URL=https://playspace-app.vercel.app

# Supabase Auth Integration
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>

# Database (Supabase PostgreSQL)
# Note: Ensure special characters in password (such as '@') are URL-encoded (%40)
DATABASE_URL=postgresql://postgres.<project-ref>:<URL_ENCODED_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15
DIRECT_URL=postgresql://postgres.<project-ref>:<URL_ENCODED_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:5432/postgres
```

### 2.2 Frontend (Vercel Environment)
```ini
# API & WebSocket Connections
VITE_API_URL=https://playspace-backend.onrender.com/api/v1
VITE_SOCKET_URL=https://playspace-backend.onrender.com

# Supabase Public Keys
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

---

## 3. Database Migration Deployment Runbook

### 3.1 Migration File Verification
The Phase 4 migration SQL is located at:
`server/prisma/migrations/20261030030000_phase4_match_history_stats_admin/migration.sql`

This migration is non-destructive, creates new Phase 4 tables, adds `accountStatus` with default `'ACTIVE'`, and preserves all existing Phase 1, 2, and 3 data.

### 3.2 Executing Migration in Production
Deploy migrations using Prisma's migration engine:
```bash
cd server
npx prisma migrate deploy
```

> [!IMPORTANT]
> Never run `prisma db push` or `prisma migrate reset` in a production environment. `prisma migrate deploy` executes only unapplied migrations safely.

---

## 4. First-Time Platform Bootstrap Sequence

Once the backend is deployed on Render and migrations are applied:

### Step 1: Initial Administrator Bootstrap
Run the operator bootstrap CLI script from the Render shell:
```bash
npm run admin:grant -- --user-id <SUPABASE_AUTH_USER_UUID>
```
Verify output confirms:
```
[Admin Bootstrap] Successfully granted ADMIN role to user: <UUID>
```

### Step 2: Seed Canonical Question Library
Trigger the idempotent question library seed endpoint (authenticated as the new admin):
```bash
curl -X POST https://playspace-backend.onrender.com/api/v1/admin/questions/seed \
  -H "Authorization: Bearer <ADMIN_SUPABASE_JWT>"
```
Expected output:
```json
{
  "success": true,
  "message": "Question library seeded successfully.",
  "seededCount": 265
}
```

### Step 3: Validate Platform Health
Query the public health and admin overview endpoints:
```bash
curl https://playspace-backend.onrender.com/api/v1/health
```

---

## 5. Security & Reliability Checklist

1. **Strict Single-Instance Deployment Enforcement & Dedicated Advisory Lock**:
   - The PlaySpace backend runs as a single-instance container (Render Web Service `instances = 1`).
   - **Enforcement Mechanisms**:
     - At startup, Node.js checks `CLUSTER_MODE`, `NODE_APP_INSTANCE`, and `WEB_CONCURRENCY`; if clustering or multi-instance concurrency is detected, it terminates (`process.exit(1)`).
     - Prior to opening HTTP/Socket.IO traffic, the server establishes a dedicated, session-affine PostgreSQL connection using `DIRECT_URL` (port 5432, completely bypassing transaction poolers).
     - It acquires an authoritative advisory lock: `SELECT pg_try_advisory_lock(583920192)`. If another container or instance holds the lock, startup immediately fails with a fatal error and terminates (`process.exit(1)`).
     - The dedicated database connection is kept alive for the entire process lifetime. If the connection drops or errors unexpectedly, the server fails closed (`process.exit(1)`) to guarantee single-instance invariants.
     - Upon graceful shutdown, the lease is released through the same PostgreSQL session (`SELECT pg_advisory_unlock(583920192)`) and the connection is cleanly closed.
   - **Horizontal Scaling Prerequisites**: Scaling beyond 1 container requires:
     - Redis-backed Socket.IO adapter (`@socket.io/redis-adapter`) for cross-instance WebSocket broadcasting.
     - Centralized distributed rate limiting.
     - Distributed job/timer scheduling for server-owned game mechanics (e.g., Snatch the Fries drops).
2. **CORS Restrictions**: `FRONTEND_URL` on Render must match the production Vercel domain.
3. **Between Us Privacy Architecture**:
   - In-flight answers are scoped strictly to the author's `GameSessionParticipant.privateState` JSON column during the `ANSWERING` phase for restart durability.
   - Action audit logs (`GameAction`) strip all answer text (`sanitizeActionMetadata`).
   - Public projections conceal all answer text (`revealedAnswers: null`), revealing only participant submission presence (`submittedUserIds`).
   - Private projections reveal pending text only to the authenticated author.
   - Upon mutual reveal (`REVEAL` phase), participant private buffers are cleared (`pendingAnswer: null`).
   - Sockets implement a 15-second grace period for temporary reconnections before marking a participant departed.
4. **Audit Trail**: Every role grant, account suspension, game config change, and question update is automatically recorded in the append-only `AuditLog` table.
5. **Rate Limiting**: Rate limiters are configured on authentication, room creation, and profile mutation endpoints.

