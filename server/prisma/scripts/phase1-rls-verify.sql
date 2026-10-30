-- PlaySpace S1: read-only RLS and browser privilege verification.
-- Run AFTER the Wave 1 RLS migration on an isolated staging database.
-- This script performs SELECTs only; it does not alter schema, grants, policies or rows.

WITH expected(table_name) AS (
  VALUES
    ('UserProfile'),
    ('UserSettings'),
    ('FriendRequest'),
    ('Friendship'),
    ('BlockedUser'),
    ('Room'),
    ('RoomParticipant'),
    ('RoomInvitation'),
    ('RoomMessage'),
    ('GameVote'),
    ('GameSession'),
    ('GameSessionParticipant'),
    ('GameAction'),
    ('Match'),
    ('MatchParticipant'),
    ('UserGameStats'),
    ('RivalryStats'),
    ('AppRole'),
    ('UserModeration'),
    ('GameConfiguration'),
    ('QuestionEntry'),
    ('AuditLog')
),
audit AS (
  SELECT
    e.table_name,
    c.oid AS relation_oid,
    COALESCE(c.relrowsecurity, false) AS rls_enabled,
    CASE WHEN c.oid IS NULL THEN false ELSE
      has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('anon', c.oid, 'INSERT')
      OR has_table_privilege('anon', c.oid, 'UPDATE')
      OR has_table_privilege('anon', c.oid, 'DELETE')
      OR has_table_privilege('anon', c.oid, 'TRUNCATE')
      OR has_table_privilege('anon', c.oid, 'REFERENCES')
      OR has_table_privilege('anon', c.oid, 'TRIGGER')
    END AS anon_has_effective_table_privilege,
    CASE WHEN c.oid IS NULL THEN false ELSE
      has_table_privilege('authenticated', c.oid, 'SELECT')
      OR has_table_privilege('authenticated', c.oid, 'INSERT')
      OR has_table_privilege('authenticated', c.oid, 'UPDATE')
      OR has_table_privilege('authenticated', c.oid, 'DELETE')
      OR has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      OR has_table_privilege('authenticated', c.oid, 'REFERENCES')
      OR has_table_privilege('authenticated', c.oid, 'TRIGGER')
    END AS authenticated_has_effective_table_privilege,
    EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = e.table_name
        AND p.roles && ARRAY['anon', 'authenticated', 'public']::name[]
    ) AS browser_role_policy_exists
  FROM expected e
  LEFT JOIN pg_class c
    ON c.relnamespace = 'public'::regnamespace
   AND c.relname = e.table_name
   AND c.relkind IN ('r', 'p')
)
SELECT
  table_name,
  (relation_oid IS NOT NULL) AS table_exists,
  rls_enabled,
  anon_has_effective_table_privilege,
  authenticated_has_effective_table_privilege,
  browser_role_policy_exists,
  CASE
    WHEN relation_oid IS NULL THEN 'FAIL: table missing'
    WHEN NOT rls_enabled THEN 'FAIL: RLS disabled'
    WHEN anon_has_effective_table_privilege THEN 'FAIL: anon has table privilege'
    WHEN authenticated_has_effective_table_privilege THEN 'FAIL: authenticated has table privilege'
    WHEN browser_role_policy_exists THEN 'FAIL: browser-role policy exists'
    ELSE 'PASS'
  END AS verification_status
FROM audit
ORDER BY table_name;

-- Separate runtime-role check: review the actual role used by Prisma at runtime.
-- RLS can be bypassed by table owners, superusers and roles with BYPASSRLS.
SELECT
  current_user AS current_connection_role,
  r.rolsuper AS is_superuser,
  r.rolbypassrls AS bypasses_rls,
  r.rolinherit AS inherits_roles
FROM pg_roles r
WHERE r.rolname = current_user;

