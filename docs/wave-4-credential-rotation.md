# PlaySpace Wave 4 — Credential Rotation Procedure

This document specifies the operational procedure for rotating all high-entropy credentials, tokens, and database passwords used in the PlaySpace architecture without causing service downtime.

---

## 1. Supabase Database Password & Connection URLs

### Frequency
- Scheduled: Every 90 days.
- Emergency: Immediately upon suspected compromise of developer workstations or logs.

### Step-by-Step Procedure
1. Navigate to **Supabase Dashboard** -> **Project Settings** -> **Database**.
2. Under **Database Password**, select **Reset Database Password**.
3. Generate a cryptographically secure random password (minimum 32 characters).
4. Update the staging and production Render environment variables:
   - `DATABASE_URL`: `postgresql://postgres.[ref]:[NEW_PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=15`
   - `DIRECT_URL`: `postgresql://postgres.[ref]:[NEW_PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`
5. Trigger a zero-downtime rolling redeploy on Render.
6. Verify service health via `GET /api/v1/ready`.

---

## 2. Supabase Service Role Key & JWT Secret

### Frequency
- Scheduled: Every 180 days.
- Emergency: Upon accidental exposure.

### Step-by-Step Procedure
1. Navigate to **Supabase Dashboard** -> **Project Settings** -> **API**.
2. Under **Project API Keys**, generate a new **service_role** key (or regenerate JWT Secret under Auth settings).
3. In Render settings, update `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWT_SECRET`.
4. Deploy the update. The shutdown handler will gracefully drain old connections while new connections pick up the rotated keys.
5. Invalidate existing sessions if required by clearing active user sessions.

---

## 3. Google OAuth Client Credentials

### Step-by-Step Procedure
1. Open the **Google Cloud Console** -> **APIs & Services** -> **Credentials**.
2. Under **OAuth 2.0 Client IDs**, select the PlaySpace web client.
3. Add a new Client Secret (Google allows two active client secrets simultaneously for seamless rotation).
4. Copy the new Client Secret into the **Supabase Auth Provider** settings for Google OAuth.
5. Test OAuth login via the PlaySpace sign-in flow.
6. Once verified, delete the old Google Client Secret in Google Cloud Console.

---

## 4. Post-Rotation Verification Checklist

- [ ] `/api/v1/health` returns HTTP 200 `status: ok`.
- [ ] `/api/v1/ready` returns HTTP 200 `status: ok` with successful DB ping and 0 leaked credentials.
- [ ] Active Socket.IO rooms can initiate, send actions, and finalize game sessions.
- [ ] Google OAuth login and standard Supabase authentication complete successfully.
- [ ] Admin dashboard overview loads successfully with RBAC verification.
