# PlaySpace Environment Setup Guide

This guide describes how to configure environment variables for local development and production deployment of PlaySpace.

## Approved Architecture Overview

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend:** Node.js + Express + TypeScript
- **Authentication:** Supabase Auth (Google OAuth)
- **Database:** Supabase PostgreSQL
- **ORM:** Prisma
- **Backend Hosting:** Render
- **Frontend Hosting:** Vercel

---

## 1. Frontend Configuration (`.env.local`)

1. Copy `.env.example` in the repository root to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
2. Configure the following variables:
   ```env
   VITE_SUPABASE_URL=https://<your-project-id>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your-publishable-key>
   VITE_APP_URL=http://localhost:5173
   VITE_API_BASE_URL=http://localhost:4000
   ```
3. In local development:
   - `VITE_APP_URL` must point to your Vite dev server (`http://localhost:5173`).
   - `VITE_API_BASE_URL` must point to your backend API server (`http://localhost:4000`).

> [!IMPORTANT]
> Never place database credentials, service-role keys, or OAuth client secrets in `VITE_*` variables. Only publishable keys are safe for frontend use.

---

## 2. Backend Configuration (`server/.env`)

1. Copy `server/.env.example` to `server/.env`:
   ```bash
   cp server/.env.example server/.env
   ```
2. Configure the following variables:
   ```env
   NODE_ENV=development
   PORT=4000

   # Supabase PostgreSQL Connections
   # DATABASE_URL: Transaction pooler connection string for runtime queries (port 6543)
   DATABASE_URL=postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true

   # DIRECT_URL: Direct database connection string for Prisma migrations (port 5432)
   DIRECT_URL=postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres

   # Supabase Auth
   SUPABASE_URL=https://<your-project-id>.supabase.co
   SUPABASE_PUBLISHABLE_KEY=sb_publishable_<your-publishable-key>

   # Frontend Origin
   FRONTEND_URL=http://localhost:5173
   ```

---

## 3. Supabase Google OAuth Setup

1. In the Supabase Dashboard:
   - Navigate to **Authentication** -> **Providers** -> **Google**.
   - Enable the Google provider.
   - Enter your **Google Client ID** and **Google Client Secret** from Google Cloud Console.
2. In Google Cloud Console:
   - Add your Supabase callback URL to the authorized redirect URIs:
     `https://<your-project-id>.supabase.co/auth/v1/callback`
3. In Supabase Dashboard:
   - Set the **Site URL** to `http://localhost:5173` (or production frontend URL).
   - Add `http://localhost:5173/**` to **Redirect URLs**.

---

## 4. Prisma Database Migrations

From the `server` directory:

1. Generate Prisma Client:
   ```bash
   npx prisma generate
   ```
2. Apply migrations to the Supabase PostgreSQL database:
   ```bash
   npx prisma migrate dev --name init
   ```
   Or deploy in CI/production:
   ```bash
   npx prisma migrate deploy
   ```

---

## 5. Security & Git Guidelines

- All `.env` and `.env.*` files (except `.env.example` and `server/.env.example`) are ignored by Git in `.gitignore`.
- Never commit database passwords, service role keys, or secrets.
- Backend validates all required environment variables at startup and halts immediately with clear diagnostics if mandatory variables are missing.
