# PlaySpace Wave 4 — Database Operations Runbook & Operational Architecture

## 1. Supabase Dual-Connection Architecture

PlaySpace utilizes Supabase PostgreSQL with distinct connection topologies for transactional operations vs database migrations.

```
                           +--------------------------------------+
                           |          PlaySpace Backend           |
                           +--------------------------------------+
                                      /                \
                    (Runtime Queries)                  (Prisma Migrations)
                                    /                    \
                                   v                      v
        +-----------------------------------+    +----------------------------------+
        |   Supabase Connection Pooler      |    |      Direct PostgreSQL Node      |
        |   Host: aws-0-eu-west-1...        |    |      Host: aws-0-eu-west-1...    |
        |   Port: 6543                      |    |      Port: 5432                  |
        |   Mode: Transaction Pooler        |    |      Mode: Direct TCP            |
        |   Param: ?pgbouncer=true          |    |      Usage: prisma migrate       |
        +-----------------------------------+    +----------------------------------+
                                   \                      /
                                    v                    v
                               +------------------------------+
                               |     PostgreSQL 15 Engine     |
                               +------------------------------+
```

### 1.1 Configuration Parameters
- **Runtime Pooler URL (`DATABASE_URL`)**:
  - `postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15`
  - Transaction-mode connection pooler designed to absorb high-concurrency client requests, game action commits, and socket session queries without exhausting database connection limits.
- **Direct Migration URL (`DIRECT_URL`)**:
  - `postgresql://postgres.[ref]:[password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`
  - Dedicated direct port used exclusively by Prisma CLI (`npx prisma migrate deploy` / `prisma db push`) because DDL schema migrations require advisory locks and prepared statements unsupported by PgBouncer transaction mode.

---

## 2. Backup & Disaster Recovery Runbook

### 2.1 Automated Supabase Backups
- Supabase automatically captures daily full logical backups retained for 7 to 30 days depending on plan tier.
- Point-In-Time-Recovery (PITR) enables restoring the database to any specified second within the backup window.

### 2.2 Manual Logical Backups (`pg_dump`)
Before running any major schema migration or data remediation, create an offline dump:

```bash
# Export schema + data
pg_dump "postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=backup_playspace_$(date +%Y%m%d_%H%M%S).dump

# Export plain SQL for inspection
pg_dump "postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --file=backup_playspace_$(date +%Y%m%d_%H%M%S).sql
```

### 2.3 Disaster Recovery Restore Procedure (`pg_restore`)
To restore from a backup file into a fresh or recovered database:

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" \
  backup_playspace_YYYYMMDD_HHMMSS.dump
```

---

## 3. Deployment Architecture & Single-Instance Decision

### 3.1 Architecture Model
- **Current Model**: Single-instance Node.js + Express + Socket.IO process hosted on Render.
- **State Handling**:
  - In-memory session tracking (`GameStateService`) guarantees microsecond state synchronization for active game rooms.
  - Periodic background state synchronization flushes durable state to PostgreSQL via Prisma.
  - Rate limiting is handled in-process via `MemoryRateLimitStore` with zero network overhead.

### 3.2 Horizontal Scaling Path (Wave 5 Ready)
- When horizontal scaling across multiple dynos/instances is required:
  1. Attach `@socket.io/redis-adapter` to distribute WebSocket events across cluster instances.
  2. Implement `IRateLimitStore` with a Redis backend (`RedisRateLimitStore`) using the pre-existing interface in `server/src/middleware/rateLimiter.ts`.
  3. Offload game state snapshots to distributed Redis caches.

---

## 4. Wave 1 RLS Privilege Boundary Audit Status

- **Specification**: Complete Row-Level Security policies and privilege boundaries are specified in `docs/phase-1-rls-privilege-boundary.md` and database schema.
- **Audit Status**:
  - Live staging verification script: `server/src/scripts/verifyDbSecurity.ts`
  - Automated CI deployment verification: `.github/workflows/backend-ci.yml`

---

## 5. Automated Data Retention & Archival Runbook

### 5.1 Retention Policy Specification
PlaySpace operates non-destructive automated retention via `server/src/scripts/dbRetention.ts`:
- **Default Mode**: Simulation / dry-run (`npm run db:retention`).
- **Execution Mode**: Live pruning with explicit flag (`npm run db:retention -- --execute`).
- **Configurable Retention Periods**:
  - Expired / cancelled room invitations: 14 days
  - Abandoned / completed sessions (non-match): 30 days
  - Ephemeral turn-by-turn game actions: 30 days
  - Closed / expired rooms (non-match): 30 days
  - Audit logs: 90 days
- **Batch Processing**: Configurable batch size (default: 100 records per batch) to prevent table locks and transaction log spikes.
- **Match History Preservation**:
  - `Match`, `MatchParticipant`, `UserGameStats`, and `RivalryStats` are permanent and **never pruned**.
  - Any `Room` or `GameSession` linked to historical matches is preserved to prevent cascade deletion.
- **Concurrency Protection**: Uses PostgreSQL session-level advisory lock (`847291048`) to ensure only one retention process runs at a time.
  - The backend server enforces application-level RBAC and tenant authorization at every API endpoint (`authenticateToken`, `requireActiveAccount`, `requireRole`).
  - Staging RLS verification execution is documented as **pending live staging database migration execution** prior to production deployment cutover.
