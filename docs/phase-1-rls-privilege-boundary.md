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

## Per-table access decision

The current architecture routes application-data operations through the authenticated Express API. The browser's Supabase client is used for Supabase Auth/PKCE, not for direct table CRUD. Accordingly, the default decision for every Prisma application table below is: **no direct browser `anon` or `authenticated` Data API access; use the corresponding Express service and its object/role checks.**

| Data group | Prisma tables | Browser Data API decision | Application access path |
| --- | --- | --- | --- |
| Identity and preferences | `UserProfile`, `UserSettings` | No direct access | `/profiles`, `/settings`; caller identity derives from verified Supabase token |
| Social graph and safety | `FriendRequest`, `Friendship`, `BlockedUser` | No direct access | `/friends`, `/blocks`; sender/receiver/relationship ownership checked in service |
| Rooms and invitations | `Room`, `RoomParticipant`, `RoomInvitation`, `RoomMessage`, `GameVote` | No direct access | `/rooms`, `/invitations/rooms` and authenticated Socket.IO handlers; active membership/host rules apply |
| Game sessions and actions | `GameSession`, `GameSessionParticipant`, `GameAction` | No direct access | Game REST/Socket.IO services; session participants own their private projections |
| Results and player analytics | `Match`, `MatchParticipant`, `UserGameStats`, `RivalryStats` | No direct access | `/matches`, `/stats`, `/rivalry`; public-history and block privacy rules apply to cross-user reads |
| Moderation and game content | `AppRole`, `UserModeration`, `GameConfiguration`, `QuestionEntry`, `AuditLog` | No direct access | Admin API only; Moderator/Admin role checks are enforced server-side |

This table describes the intended browser access boundary. It does **not** prove that the current database actually has only these objects: the audit query inventories all public-schema tables/views/functions and storage relations so any additional object can be classified before applying the migration.

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
