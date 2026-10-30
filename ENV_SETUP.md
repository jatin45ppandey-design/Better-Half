# PlaySpace environment setup

This repository contains safe templates only. Real credentials must stay in local ignored files.

## Frontend (React + Vite)
1. Copy `.env.example` to `.env.local` in the repository root.
2. Set `VITE_NEON_AUTH_URL` to the Neon Auth URL shown for your project/branch.
3. Keep `VITE_APP_URL` as `http://localhost:5173` for local development.
4. Keep `VITE_API_BASE_URL` as `http://localhost:4000` while the backend runs locally.

## Backend
1. Create the `server` directory if it does not exist.
2. Copy `server/.env.example` to `server/.env`.
3. Set `DATABASE_URL` to the Neon pooled PostgreSQL connection string.
4. Set `DIRECT_URL` to the Neon direct PostgreSQL connection string.
5. Set both Neon Auth URL values from the Neon Auth configuration/documentation used by the backend JWT verifier.
6. Keep `server/.env` out of Git.

## Google sign-in
Configure the Google OAuth Client ID and Client Secret in the Neon Auth provider settings. Do not place the Google Client Secret in a `VITE_*` variable or any frontend environment file.

## Important
- The templates contain placeholders, not real secrets.
- `.env.local`, `server/.env`, and other env files are ignored by Git.
- Never commit database passwords, OAuth client secrets, or signing secrets.
