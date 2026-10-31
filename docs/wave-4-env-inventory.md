# PlaySpace Wave 4 — Environment Variable Inventory & Exposure Audit

## 1. Environment Variable Inventory Matrix

| Variable Name | Scope | Tier / Environment | Secret? | Purpose & Safe Defaults |
|:---|:---|:---|:---|:---|
| `PORT` | Backend | Dev / Staging / Prod | No | HTTP server listen port (default: `3001` or provided by Render `$PORT`). |
| `NODE_ENV` | Backend | Dev / Staging / Prod | No | Runtime mode (`development`, `test`, `production`). Enforces strict CSP and redacting logs. |
| `FRONTEND_URL` | Backend | Dev / Staging / Prod | No | Trusted client URL for CORS and Helmet connectSrc (e.g. `http://localhost:5173` or `https://playspace.com`). |
| `DATABASE_URL` | Backend | Dev / Staging / Prod | **YES** | Supabase connection pooler URL (Port 6543, `?pgbouncer=true&connection_limit=15`). **Never expose to client.** |
| `DIRECT_URL` | Backend | Dev / Staging / Prod | **YES** | Supabase direct PostgreSQL URL (Port 5432) for Prisma DDL migrations. **Never expose to client.** |
| `SUPABASE_URL` | Backend | Dev / Staging / Prod | No | Supabase API project base URL (e.g. `https://xxxx.supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend | Dev / Staging / Prod | **YES** | Master administrative bypass key used for user moderation, role management, and audit logs. **Never expose to client.** |
| `SUPABASE_JWT_SECRET` | Backend | Dev / Staging / Prod | **YES** | Secret used for local verification of Supabase auth tokens. |
| `SESSION_SECRET` | Backend | Dev / Staging / Prod | **YES** | Secret key for cryptographic signing of ephemeral sessions and state tokens. |
| `VITE_SUPABASE_URL` | Frontend | Dev / Staging / Prod | No | Supabase project endpoint consumed by Supabase JavaScript Client. |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Dev / Staging / Prod | No | Supabase public anonymous API key for client-side Auth and RLS-protected queries. |
| `VITE_API_URL` | Frontend | Dev / Staging / Prod | No | PlaySpace backend REST API base URL (e.g. `http://localhost:3001/api/v1` or `/api/v1`). |
| `VITE_SOCKET_URL` | Frontend | Dev / Staging / Prod | No | PlaySpace backend Socket.IO base URL (e.g. `http://localhost:3001` or `/`). |

---

## 2. Frontend Secret Exposure Audit

### 2.1 Audit Method
We performed a full static analysis of the client bundle build output and source code in `src/` to confirm zero leakage of server secrets:

1. **Client Environment Prefixes**: Only variables prefixed with `VITE_` are bundled by Vite.
2. **Zero Sensitive Tokens**:
   - `DATABASE_URL`: **0 occurrences in client bundle**
   - `DIRECT_URL`: **0 occurrences in client bundle**
   - `SUPABASE_SERVICE_ROLE_KEY`: **0 occurrences in client bundle**
   - `SESSION_SECRET`: **0 occurrences in client bundle**
   - `SUPABASE_JWT_SECRET`: **0 occurrences in client bundle**
3. **Between Us In-Memory Rule Verification**:
   - Private game prompts and answers are strictly transmitted over ephemeral Socket.IO events and memory buffers (`GameStateService.privateStates`).
   - Answers are never persisted in PostgreSQL or output to structured production logs.
