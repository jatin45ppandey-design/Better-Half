-- Read-only PlaySpace/Supabase security inventory.
-- Run in Supabase SQL Editor (or a read-only database session). This script does
-- not modify schema, rows, grants, policies, roles or storage.

-- 1) Active database role and security-relevant role attributes.
SELECT current_user AS current_database_role,
       current_setting('request.jwt.claim.sub', true) AS jwt_subject;
SELECT rolname, rolsuper, rolbypassrls, rolinherit, rolcanlogin
FROM pg_roles
WHERE rolname IN ('anon', 'authenticated', 'service_role', 'postgres')
ORDER BY rolname;

-- 2) Public-schema tables, views, materialized views and foreign tables.
SELECT n.nspname AS schema_name,
       c.relname AS object_name,
       CASE c.relkind
         WHEN 'r' THEN 'table'
         WHEN 'p' THEN 'partitioned table'
         WHEN 'v' THEN 'view'
         WHEN 'm' THEN 'materialized view'
         WHEN 'f' THEN 'foreign table'
         ELSE c.relkind::text
       END AS object_type,
       pg_get_userbyid(c.relowner) AS owner,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       c.reloptions AS relation_options,
       CASE WHEN c.relkind IN ('v', 'm') THEN pg_get_viewdef(c.oid, true) END AS view_definition
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY object_type, object_name;

-- 3) Existing row-level security policies.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4) Explicit table/view grants to browser and service roles.
SELECT grantee, table_schema, table_name, privilege_type, is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- 5) Public functions/procedures: SECURITY DEFINER and search_path configuration.
SELECT n.nspname AS schema_name,
       p.proname AS routine_name,
       pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer,
       p.proconfig AS routine_settings,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       p.proacl AS acl
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 6) Storage inventory. If storage.buckets exists, inspect bucket policies and
-- object privileges separately; this query only confirms whether the catalog exists.
SELECT to_regclass('storage.buckets') AS storage_buckets_relation,
       to_regclass('storage.objects') AS storage_objects_relation;

-- 7) Default privileges that may grant access to future objects.
SELECT defaclrole::regrole AS creator_role,
       defaclnamespace::regnamespace AS schema_name,
       defaclobjtype AS object_type,
       defaclacl AS default_acl
FROM pg_default_acl
WHERE defaclnamespace = 'public'::regnamespace
ORDER BY creator_role, object_type;
