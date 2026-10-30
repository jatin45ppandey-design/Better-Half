# PlaySpace Wave 1 — API authorization inventory

**Reviewed branch:** `wave-1/b1-s1-f1-foundation`  
**Main baseline:** `899f314ebbb7f917e192d24d5cbdde0896012cc9`  
**Review date:** 30 October 2026

This matrix records the Express route guards and the service-level object/privacy rules found in the repository. A route having `requireAuth` is not, by itself, treated as proof of object authorization. Where behavior has only source-level review or unit coverage, that limitation is called out.

## Global request boundary

- All routes are mounted under `/api/v1`.
- `GET /health` and `GET /ready` are registered before the global `checkAccountStatus` middleware and are intentionally public operational endpoints.
- All other module routes pass through `checkAccountStatus`: missing profiles fail closed except for the dedicated authenticated `GET /profiles/me` bootstrap route; suspended accounts return 403; database verification failures return 503.
- Supabase bearer-token verification is performed by `requireAuth`; the Google OAuth/PKCE client flow is not changed in Wave 1.
- Admin authorization is server-side. `requireModerator` permits ADMIN/MODERATOR; `requireAdmin` permits ADMIN only.

## API and object authorization matrix

| Resource / routes | Authentication / role | Object-level / privacy rule | Mutations / privileged boundary |
| --- | --- | --- | --- |
| `GET /health`, `GET /ready` | Public | Operational status only; readiness does not return credentials | Read-only |
| `GET /profiles/me` | Supabase auth; special profile-bootstrap middleware | Authenticated subject selects the caller's own profile; only this route allows a missing-profile bootstrap | Profile is created from verified Supabase identity if missing |
| `PATCH /profiles/me` | Auth required | Caller ID comes from verified token; update schema is strict and rejects unknown/server-managed fields | Only display name, username, bio and allowed avatar presentation fields are writable |
| `GET /profiles/search` | Auth required | Excludes current user and users blocked in either direction; returns a limited public profile projection | Read-only |
| `GET /profiles/:username` | Public route | Intentionally public username lookup; response is a redacted profile projection, not email, account status or roles | Read-only |
| `GET /settings`, `PATCH /settings` | Auth required | Service uses caller ID from verified request; strict update schema rejects unknown/server-managed properties | Caller can update only allowlisted preference fields |
| `GET /friends`, `GET /friends/requests` | Auth required | Friendship/request queries are scoped to caller as owner, sender or receiver | Read-only |
| `POST /friends/requests` | Auth + route rate limit + Zod body | Sender ID is server-derived; service checks self-request, blocks and target identity | Creates request for selected receiver |
| `POST /friends/requests/:id/accept`, `.../reject` | Auth + Zod ID | Only the receiver can accept or reject | Accept creates the reciprocal friendship records |
| `DELETE /friends/requests/:id` | Auth + Zod ID | Only the original sender can cancel | Cancels outgoing request |
| `DELETE /friends/:friendId` | Auth + Zod ID | Deletes only the caller's relationship edge(s) to that friend | Removes friendship |
| `GET /blocks`, `POST /blocks/:userId`, `DELETE /blocks/:userId` | Auth; Zod and rate limit on block creation | Block list is scoped to blocker; service rejects self-block | Caller may create/remove only their own block relationship |
| `POST /rooms`, `POST /rooms/join` | Auth; Zod and route rate limit | Creator/joiner identity comes from token; service validates mode eligibility, capacity, expiry and host block relationship | Room creation and joins are server-side |
| `GET /rooms/me` | Auth | Only rooms where caller has an active participation are returned | Read-only |
| `GET /rooms/:id`, `GET /rooms/code/:code` | Auth | **Active member:** full room snapshot. **Non-member:** join preview only (code/name/mode/status/capacity/count, selected game, host display name, safe participant presentation, eligibility). Preview omits internal room/user IDs, host ownership ID, votes, chat and database timestamps | A non-member must complete the server join operation before receiving full state |
| `POST /rooms/:id/leave`, `.../ready`, `.../vote`, `.../messages`; `GET /rooms/:id/messages` | Auth; body validation / chat rate limit | Services check active participation for member-only operations; chat read and post both require active membership | Host-only close, select-game, start, transfer-host and kick operations remain service-enforced |
| `POST /invitations/rooms` | Auth, Zod body and route rate limit | Sender must be an active room participant; self-invites and either-direction blocks are rejected; room/capacity/expiry are checked | Creates a pending invitation for the receiver |
| `GET /invitations/rooms/received` | Auth | Query is scoped to authenticated receiver and returns only pending, unexpired invites for eligible active rooms | Read-only |
| `POST /invitations/rooms/:id/accept`, `.../decline` | Auth | Only the intended receiver can accept or decline | Accept joins through RoomsService; decline updates invitation state |
| `POST /invitations/rooms/:id/cancel` | Auth | Only original sender or room host may cancel | Cancels pending invite |
| `GET /games/catalog` | Auth | Reads server game configuration; a catalog/database failure returns a safe 503 error, never a successful empty list | Read-only |
| `POST /games/rooms/:roomId/start` | Auth | Start path checks caller through room/host eligibility service | Server selects and starts game session |
| `GET /games/sessions/:id`, `GET /games/sessions/:id/state` | Auth | Caller must be a session participant before any public projection is returned; private projection additionally resolves only that caller's private state | Non-participant receives 403; no general spectator API is exposed |
| `POST /games/sessions/:id/rematch` | Auth | Rematch service enforces participant/room rules | Server creates rematch |
| `GET /matches/history` | Auth | Query is scoped to caller's own history | Read-only |
| `GET /matches/:matchId` | Auth | Participants can view their own match; a non-participant can view only when all match participants have public history enabled and no participant has blocked the requester (either direction) | Read-only |
| `GET /stats/me`, `/me/games`, `/me/recent` | Auth | Caller ID comes from verified token | Read-only |
| `GET /stats/users/:userId`, `.../games` | Auth | Cross-user access checks target `publicMatchHistory` and blocks in either direction | Denials are 403 |
| `GET /rivalry` | Auth | Only caller's rivalry rows are queried; rows for rivals with private match history or either-direction blocks are filtered out | Read-only |
| `GET /rivalry/:rivalUserId`, `.../history` | Auth | Cross-user access checks rival's `publicMatchHistory` and blocks in either direction | Private/blocked access returns 403 |
| `GET /admin/overview`, `/admin/users...` | Auth + Moderator (ADMIN or MODERATOR) | Server role table check on each request | Moderation and user status actions |
| `/admin/users/:id/roles...`, `/admin/games...`, `/admin/questions...`, `/admin/audit-logs`, `/admin/reconcile/:userId` | Auth + ADMIN | Server-side ADMIN role check on each request | Privileged role, game configuration, question, audit and reconciliation operations |

## REST and Socket.IO alignment

- Socket handshake authenticates with Supabase; no browser-supplied actor ID is used as the caller identity.
- `room:join` now calls the same user-aware RoomsService lookup as REST. A non-member receives only the safe preview and is joined only after the server's `joinRoom` succeeds; only then is full room state emitted.
- `room:start:prepare` resolves the full room snapshot using the authenticated socket user ID.
- Room chat REST read/post and Socket.IO chat handlers use RoomsService membership checks.
- `game:session:join` uses the shared game-session participant check; REST and socket private projections share the same guard.
- Host actions and game actions continue to be validated in existing service methods; Wave 1 does not change game rules or question banks.

## Wave 1 security regression coverage added

- `server/tests/api.test.ts`: non-participant session-state read (403 before projection), profile mass assignment, settings mass assignment, safe non-member room preview, and non-member chat read/post denial.
- `server/tests/phase4.test.ts`: private-history and block checks for rivalry detail/history/list and non-participant match detail; a participant retains access to their own match.
- `server/tests/rooms.test.ts`: Socket.IO non-member join fixture now returns the safe preview contract and verifies that the server joins via the room service.

## Remaining B1 verification / known limits

- The source and unit-test coverage has been updated, but multi-account HTTP + Socket.IO integration tests have **not been executed in this environment**. Run the backend test suite on an isolated test database before accepting B1.
- Verify valid, expired and revoked Supabase tokens; normal user, moderator and admin role boundaries; cross-account match/profile/rivalry behavior with two or more real test identities.
- Socket event payload schema validation, per-event throttles and existing-session revocation are Wave 2 S2/B3 scope; this document does not claim those controls are complete.
- Invitation race/idempotency, durable session recovery and authoritative action concurrency remain Wave 2 B2/B3 scope.
- Source-level review is not a penetration test and does not prove production configuration.
