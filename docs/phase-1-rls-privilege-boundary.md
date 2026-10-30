# Wave 1 — S1 RLS and database permission foundation

## Source baseline

The current Prisma schema and the four committed Prisma migrations define 22 application tables:

- `UserProfile`
- `UserSettings`
- `FriendRequest`
- `Friendship`
- `BlockedUser`
- `Room`
- `RoomParticipant`
- `RoomInvitation`
- `RoomMessage`
- `GameVote`
- `GameSession`
- `GameSessionParticipant`
- `GameAction`
- `Match`
- `MatchParticipant`
- `UserGameStats`
- `RivalryStats`
- `AppRole`
- `UserModeration`
- `GameConfiguration`
- `QuestionEntry`
- `AuditLog`

The four migration files in the reviewed `main` baseline do not contain `ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, table grant or revoke statements. The repository browser client in `src/lib/supabase.ts` is configured for PKCE Auth; application data requests are made through the Express API client in `src/services/api.ts`.

## Additive migration prepared on the Wave 1 branch

Migration `20261030040000_wave1_rls_browser_boundary`:

- Enables RLS on the 22 application tables.
- Revokes direct table privileges from Supabase's `anon` and `authenticated` roles.
- Creates no permissive policies. No browser-side table CRUD has been specified in the current API design.
- Does not drop, truncate, rewrite or reseed any table.
- Does not use `FORCE ROW LEVEL SECURITY`.

This establishes a browser Data API boundary. It does **not** make Prisma queries row-scoped: a trusted server-side database role that owns tables or has `BYPASSRLS` remains able to read/write all rows. The Express authorization layer remains the application-level control until a separately designed runtime role is verified.

## Runtime-role caveat

The committed `server/.env.example` shows a `postgres` role in both pooled runtime and direct migration URL examples. That is only a template; this session cannot inspect actual Render/Supabase environment values. The production Prisma role, its ownership/BYPASSRLS attributes and current live grants must be verified before this migration is applied anywhere.

Do not use `FORCE ROW LEVEL SECURITY` or create generic policies to silence Security Advisor. If Prisma runtime must be separated from the migration owner, design and test a restricted server role with the exact application-table privileges before changing connection configuration.

## Verification still required (S1 remains gated)

1. Run `server/prisma/scripts/phase1-rls-audit.sql` against a **safe staging database** and retain output for tables, views, routines, roles, grants, policies and default ACLs.
2. Run the Supabase Security Advisor and record its current findings; this repository has no live Security Advisor result.
3. Confirm actual production/runtime Prisma role out-of-band without exposing the connection string.
4. Verify no frontend feature relies on direct Supabase Data API table access.
5. Apply this migration to an isolated staging clone, run REST/Auth/Prisma integration tests, and verify anonymous/authenticated direct Data API reads and writes are denied.
6. Review staged migration SQL and obtain approval before any production migration.

No database connection was opened and no migration was executed during this implementation.
