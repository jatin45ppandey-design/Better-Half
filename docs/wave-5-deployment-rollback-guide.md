# PlaySpace — Deployment & Rollback Guide (Wave 5)

## 1. Overview & Architecture

PlaySpace is structured as a decoupled full-stack platform:
- **Frontend:** Single-Page React 19 application built with Vite and Tailwind CSS. Hosted on edge static hosting (e.g. Vercel, Netlify, Cloudflare Pages).
- **Backend:** Node.js Express + Socket.IO server running in containers.
- **Database:** PostgreSQL on Supabase with Prisma ORM 6 and pgBouncer / Supavisor connection pooling.
- **Authentication:** Supabase Auth (Google OAuth + JWT verification).

---

## 2. Deployment Protocol

### A. Environment Configuration Pre-flight
Before deploying backend instances, validate runtime environment variables:
```bash
npm run env:validate --prefix server
```
Required Production Variables:
- `NODE_ENV=production`
- `PORT=4000`
- `DATABASE_URL=postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15`
- `DIRECT_URL=postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
- `SUPABASE_URL=https://<project-ref>.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY=<supabase-anon-or-publishable-key>`
- `FRONTEND_URL=https://playspace.com`

### B. Database Migration Procedure
Prisma migrations must be applied using the direct connection (`DIRECT_URL`) before launching updated backend servers:
```bash
cd server
npx prisma migrate deploy
```
> [!IMPORTANT]
> Never run `prisma migrate dev` or `prisma db push` in production. Only `prisma migrate deploy` is sanctioned.

### C. Backend Zero-Downtime Rolling Update
1. Deploy new container image revisions behind load balancer.
2. The orchestrator polls `/api/v1/ready` until instances return `200 OK`.
3. Signal old containers with `SIGTERM`.
4. Old containers trigger the graceful shutdown handler:
   - Emits `'server_shutdown'` to connected Socket.IO clients (`{ reason: 'server_restarting' }`).
   - Closes WebSocket server to initiate client reconnection to new instances.
   - Waits up to 10 seconds for in-flight game transactions to commit.
   - Disconnects Prisma client pool.
   - Exits with code 0.

---

## 3. Rollback Procedures

### Scenario A: Frontend Failure / Visual Regression
**Condition:** Frontend asset corruption or routing regression. Backend and database remain healthy.
**Action:**
1. In Vercel / edge hosting dashboard, promote previous deployment instant-alias to production.
2. Edge CDN invalidates `index.html` cache immediately.
3. Zero database impact.

### Scenario B: Backend Service Crash / API Regression
**Condition:** High error rates, crash loops, or unhandled exceptions on backend.
**Action:**
1. Switch container service deployment target back to previous Docker image tag.
2. If new database columns were added via backward-compatible migrations, no database rollback is necessary (all Wave 1–5 schema changes are strictly additive).
3. Verify `/api/v1/health` and `/api/v1/ready` on rolled-back containers.

### Scenario C: Destructive Database Migration Failure
**Condition:** Failed migration or corrupted table state.
**Action:**
1. Put application into maintenance mode:
   ```bash
   # Route traffic to static maintenance page via edge reverse proxy
   ```
2. Restore database from latest pre-migration point-in-time recovery (PITR) or automated snapshot:
   ```bash
   bash server/scripts/restore-database.sh <pre_migration_backup.sql>
   ```
3. Re-point backend instances to restored database.
4. Validate schema status:
   ```bash
   npm run prisma:validate --prefix server
   ```
5. Remove maintenance mode.

---

## 4. Branch Protection & GitHub Settings

To ensure CI gates are strictly enforced before pull requests can be merged into `main`:
1. Navigate to **GitHub Repository Settings** > **Branches** > **Branch protection rules**.
2. Add rule for pattern: `main`.
3. Require status checks to pass before merging:
   - `Backend Test, Validate & Build` (from `.github/workflows/backend-ci.yml`)
   - `Frontend Lint, Typecheck & Build` (from `.github/workflows/frontend-ci.yml`)
4. Require branches to be up to date before merging.
5. Require pull request reviews before merging.
6. If repository administrative permissions are unavailable to configure this rule directly via API, the repository owner must toggle this once in the GitHub repository web settings.
