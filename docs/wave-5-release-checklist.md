# PlaySpace — Release Checklist (Wave 5)

**Target Release:** Release Candidate 1.0.0 (RC-1)  
**Target Environment:** Staging & Production  
**Scope:** Waves 1 through 5 (B1–B7, S1–S5, F1–F5)

---

## 1. Pre-Deployment Automation & Quality Gates

| Check | Required Command / Action | Passing Criteria | Status |
|---|---|---|---|
| **Environment Variable Validation** | `npm run env:validate --prefix server` | Passes without missing keys; DB & Supabase URLs validated | [x] PASS |
| **Prisma Schema Validation** | `npm run prisma:validate --prefix server` | `schema.prisma` is syntactically & relationally valid | [x] PASS |
| **Backend TypeScript Compiler** | `npm run typecheck --prefix server` | 0 errors under `strict: true` | [x] PASS |
| **Backend Production Build** | `npm run build --prefix server` | Client generated & transpiles to `dist/` | [x] PASS |
| **Backend Automated Tests** | `npm test --prefix server` | **177 / 177 tests passing** (14 test files) | [x] PASS |
| **Frontend Production Build** | `npm run build` | All chunks under 250 kB; 0 TS/bundling errors | [x] PASS |
| **Frontend Lint** | `npm run lint` | 0 errors across 191 files (Oxlint) | [x] PASS |
| **CI Workflows Configured** | Inspect `.github/workflows/` | `backend-ci.yml` and `frontend-ci.yml` present | [x] PASS |
| **Secret Scan Cleanliness** | Automated git secret audit | 0 unmasked credentials committed | [x] PASS |

---

## 2. Infrastructure & Database Release Gates

| Step | Owner | Description | Release Blocker? |
|---|---|---|---|
| **Isolated Test Container Verification** | CI Runner | Run migrations and tests against isolated PostgreSQL container | No (automated in CI) |
| **Live Staging Database Migration** | Platform Team | Apply pending migrations via `npx prisma migrate deploy` in staging Supabase | **YES** |
| **Supabase RLS Staging Verification** | Security Team | Execute `SUPABASE_SECURITY_ADVISOR.md` queries on staging to verify tenant boundaries | **YES** |
| **Staging Penetration Smoke Test** | QA / Security | Execute non-destructive API boundary tests and Socket.IO connection stress test | **YES** |
| **Backup / Restore Drill** | DevOps Team | Execute a dry-run test restoring staging dump into an isolated test instance | **YES** |
| **Alert Webhook Delivery** | DevOps Team | Configure `SLACK_ALERT_WEBHOOK_URL` in production secret manager | No |

---

## 3. Deployment Execution Steps

1. **GitHub PR Merge**:
   - Merge `wave-5/b7-s5` into `main` after all GitHub Actions checks pass.
2. **Tag Release**:
   - `git tag -a v1.0.0-rc1 -m "Release Candidate 1.0.0"`
   - `git push origin v1.0.0-rc1`
3. **Database Migration Phase**:
   - Ensure primary connection pool is configured via Supabase Transaction Pooler (port 6543) for application queries.
   - Run `prisma migrate deploy` through Direct Connection (port 5432) from deployment runner.
4. **Backend Service Deployment**:
   - Deploy container to container runner / ECS / Render / Cloud Run.
   - Verify `/api/v1/health` returns `200 OK`.
   - Verify `/api/v1/ready` returns `200 OK`.
5. **Frontend Edge Deployment**:
   - Deploy static assets to Vercel / Cloudflare Pages / edge CDN.
   - Verify CSP headers, caching rules (`index.html` `no-cache`, `/assets/` 1-year immutable cache).
6. **Post-Deployment Verification**:
   - Perform end-to-end user login with Google OAuth.
   - Create a Couple Mode room and launch a session.
   - Create a Friend Mode room (3–4 players) and verify Tic Tac Toe rotation queue.
   - Verify real-time presence, chat delivery, and game action updates.

---

## 4. Rollback Readiness

If any critical post-deployment check fails:
1. Revert edge CDN frontend pointer to previous stable release build.
2. Route traffic back to previous backend container revision.
3. Consult [`DEPLOYMENT_ROLLBACK_GUIDE.md`](./wave-5-deployment-rollback-guide.md) for schema rollback procedures.
