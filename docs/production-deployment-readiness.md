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

1. **CORS Restrictions**: `FRONTEND_URL` on Render must match the production Vercel domain.
2. **Ephemeral Memory Hygiene**:
   - BETWEEN US answers are stored exclusively in memory and garbage-collected upon round reveal.
   - Sockets implement a 15-second grace period for temporary reconnections before marking a participant departed.
3. **Audit Trail**: Every role grant, account suspension, game config change, and question update is automatically recorded in the append-only `AuditLog` table.
4. **Rate Limiting**: Rate limiters are configured on authentication and profile mutation endpoints.

