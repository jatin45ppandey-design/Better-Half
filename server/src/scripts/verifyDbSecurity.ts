/**
 * Read-Only Database Security & RLS Verification Script
 *
 * Inspects:
 * - Current runtime database user, role attributes, and superuser status
 * - RLS status (rowsecurity) on all public tables
 * - Table ownership (tableowner)
 * - Active RLS policies
 * - Public/Anon/Authenticated table permissions and effective privileges
 *
 * STRICTLY READ-ONLY: Does not perform INSERT, UPDATE, DELETE, ALTER, GRANT, or REVOKE.
 */

import { prisma } from '../config/prisma.js';

export interface UserRoleInfo {
  currentUser: string;
  sessionUser: string;
  isSuperuser: string;
  rolbypassrls: boolean | null;
  rolsuper: boolean | null;
}

export interface PrivilegeMap {
  select: boolean;
  insert: boolean;
  update: boolean;
  delete: boolean;
}

export interface TableSecurityAudit {
  tablename: string;
  tableowner: string;
  rowsecurity: boolean;
  policycount: number;
  effectivePrivileges: {
    currentUser: PrivilegeMap;
    anon?: PrivilegeMap;
    authenticated?: PrivilegeMap;
    publicPseudoRole?: PrivilegeMap;
  };
}

export interface PolicyInfo {
  schemaname: string;
  tablename: string;
  policyname: string;
  permissive: string;
  roles: string[];
  cmd: string;
}

export interface ExplicitGrant {
  grantee: string;
  tableName: string;
  privilegeType: string;
}

export async function verifyDatabaseSecurity(): Promise<{
  roleInfo: UserRoleInfo | null;
  tables: TableSecurityAudit[];
  policies: PolicyInfo[];
  explicitGrants: ExplicitGrant[];
}> {
  console.log('\n============================================================');
  console.log('   PLAYSPACE DATABASE SECURITY & RLS VERIFICATION AUDIT    ');
  console.log('============================================================\n');

  // 1. Connection & Runtime User Context
  let roleInfo: UserRoleInfo | null = null;
  try {
    const roleRows = await prisma.$queryRaw<Array<{
      currentUser: string;
      sessionUser: string;
      isSuperuser: string;
      rolbypassrls: boolean | null;
      rolsuper: boolean | null;
    }>>`
      SELECT
        current_user as "currentUser",
        session_user as "sessionUser",
        current_setting('is_superuser', true) as "isSuperuser",
        r.rolbypassrls as "rolbypassrls",
        r.rolsuper as "rolsuper"
      FROM pg_roles r
      WHERE r.rolname = current_user;
    `;

    roleInfo = roleRows[0] || null;
    console.log('--- RUNTIME DATABASE CONNECTION CONTEXT ---');
    if (roleInfo) {
      console.log(`Current User : ${roleInfo.currentUser}`);
      console.log(`Session User : ${roleInfo.sessionUser}`);
      console.log(`Is Superuser : ${roleInfo.isSuperuser}`);
      console.log(`Bypass RLS   : ${roleInfo.rolbypassrls === true ? 'YES (Bypasses RLS - Server Authoritative)' : 'NO (Subject to RLS)'}`);
      console.log(`Superuser Rol: ${roleInfo.rolsuper === true ? 'YES' : 'NO'}`);
    } else {
      console.log('Could not determine pg_roles entry for current_user.');
    }
  } catch (err: any) {
    console.warn(`[WARN] Could not query pg_roles: ${err?.message || err}`);
  }

  // 2. Discover available browser roles
  let hasAnonRole = false;
  let hasAuthenticatedRole = false;
  try {
    const dbRoles = await prisma.$queryRaw<Array<{ rolname: string }>>`
      SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'authenticator', 'service_role');
    `;
    const names = new Set(dbRoles.map((r) => r.rolname));
    hasAnonRole = names.has('anon');
    hasAuthenticatedRole = names.has('authenticated');
    console.log(`\nDetected Browser Roles: anon=${hasAnonRole ? 'YES' : 'NO'}, authenticated=${hasAuthenticatedRole ? 'YES' : 'NO'}`);
  } catch (err: any) {
    console.warn(`[WARN] Could not check browser roles: ${err?.message || err}`);
  }

  // 3. Inspect Tables, Ownership, RLS status, and Effective Privileges in a single catalog query
  let tables: TableSecurityAudit[] = [];
  try {
    const rawTables = await prisma.$queryRaw<Array<{
      tablename: string;
      tableowner: string;
      rowsecurity: boolean;
      policycount: number;
      cur_select: boolean;
      cur_insert: boolean;
      cur_update: boolean;
      cur_delete: boolean;
      anon_select: boolean | null;
      anon_insert: boolean | null;
      anon_update: boolean | null;
      anon_delete: boolean | null;
      auth_select: boolean | null;
      auth_insert: boolean | null;
      auth_update: boolean | null;
      auth_delete: boolean | null;
      pub_select: boolean;
      pub_insert: boolean;
      pub_update: boolean;
      pub_delete: boolean;
    }>>`
      SELECT
        t.tablename,
        t.tableowner,
        t.rowsecurity,
        COUNT(p.policyname)::int as policycount,
        has_table_privilege(current_user, 'public."' || t.tablename || '"', 'SELECT') as cur_select,
        has_table_privilege(current_user, 'public."' || t.tablename || '"', 'INSERT') as cur_insert,
        has_table_privilege(current_user, 'public."' || t.tablename || '"', 'UPDATE') as cur_update,
        has_table_privilege(current_user, 'public."' || t.tablename || '"', 'DELETE') as cur_delete,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
             THEN has_table_privilege('anon', 'public."' || t.tablename || '"', 'SELECT') ELSE NULL END as anon_select,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
             THEN has_table_privilege('anon', 'public."' || t.tablename || '"', 'INSERT') ELSE NULL END as anon_insert,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
             THEN has_table_privilege('anon', 'public."' || t.tablename || '"', 'UPDATE') ELSE NULL END as anon_update,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
             THEN has_table_privilege('anon', 'public."' || t.tablename || '"', 'DELETE') ELSE NULL END as anon_delete,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
             THEN has_table_privilege('authenticated', 'public."' || t.tablename || '"', 'SELECT') ELSE NULL END as auth_select,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
             THEN has_table_privilege('authenticated', 'public."' || t.tablename || '"', 'INSERT') ELSE NULL END as auth_insert,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
             THEN has_table_privilege('authenticated', 'public."' || t.tablename || '"', 'UPDATE') ELSE NULL END as auth_update,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
             THEN has_table_privilege('authenticated', 'public."' || t.tablename || '"', 'DELETE') ELSE NULL END as auth_delete,
        has_table_privilege('public', 'public."' || t.tablename || '"', 'SELECT') as pub_select,
        has_table_privilege('public', 'public."' || t.tablename || '"', 'INSERT') as pub_insert,
        has_table_privilege('public', 'public."' || t.tablename || '"', 'UPDATE') as pub_update,
        has_table_privilege('public', 'public."' || t.tablename || '"', 'DELETE') as pub_delete
      FROM pg_tables t
      LEFT JOIN pg_policies p
        ON t.schemaname = p.schemaname
        AND t.tablename = p.tablename
      WHERE t.schemaname = 'public'
        AND t.tablename NOT LIKE '_prisma_%'
      GROUP BY t.tablename, t.tableowner, t.rowsecurity
      ORDER BY t.tablename ASC;
    `;

    for (const r of rawTables) {
      tables.push({
        tablename: r.tablename,
        tableowner: r.tableowner,
        rowsecurity: Boolean(r.rowsecurity),
        policycount: Number(r.policycount || 0),
        effectivePrivileges: {
          currentUser: {
            select: Boolean(r.cur_select),
            insert: Boolean(r.cur_insert),
            update: Boolean(r.cur_update),
            delete: Boolean(r.cur_delete),
          },
          publicPseudoRole: {
            select: Boolean(r.pub_select),
            insert: Boolean(r.pub_insert),
            update: Boolean(r.pub_update),
            delete: Boolean(r.pub_delete),
          },
          ...(hasAnonRole ? {
            anon: {
              select: Boolean(r.anon_select),
              insert: Boolean(r.anon_insert),
              update: Boolean(r.anon_update),
              delete: Boolean(r.anon_delete),
            },
          } : {}),
          ...(hasAuthenticatedRole ? {
            authenticated: {
              select: Boolean(r.auth_select),
              insert: Boolean(r.auth_insert),
              update: Boolean(r.auth_update),
              delete: Boolean(r.auth_delete),
            },
          } : {}),
        },
      });
    }

    console.log('\n--- APPLICATION TABLES: OWNERSHIP & RLS STATUS ---');
    console.log(`Total Application Tables Audited: ${tables.length}`);
    let rlsEnabledCount = 0;
    for (const t of tables) {
      const statusIcon = t.rowsecurity ? '✅ [RLS ENABLED]' : '⚠️ [RLS DISABLED]';
      console.log(
        `  ${statusIcon.padEnd(20)} ${t.tablename.padEnd(26)} Owner: ${t.tableowner.padEnd(16)} Policies: ${t.policycount}`
      );
      if (t.rowsecurity) rlsEnabledCount++;
    }
    console.log(`\nRLS Enabled Summary: ${rlsEnabledCount} / ${tables.length} tables protected`);

    console.log('\n--- BROWSER ROLES EFFECTIVE PRIVILEGES AUDIT ---');
    console.log('(Verifying whether browser client roles can execute direct table operations)');
    for (const t of tables) {
      const p = t.effectivePrivileges;
      const summarize = (m?: PrivilegeMap) => {
        if (!m) return 'N/A';
        const granted: string[] = [];
        if (m.select) granted.push('SELECT');
        if (m.insert) granted.push('INSERT');
        if (m.update) granted.push('UPDATE');
        if (m.delete) granted.push('DELETE');
        return granted.length ? granted.join(',') : 'NONE (BLOCKED)';
      };

      console.log(`  Table: ${t.tablename.padEnd(25)} | anon: ${summarize(p.anon).padEnd(14)} | auth: ${summarize(p.authenticated).padEnd(14)} | public: ${summarize(p.publicPseudoRole)}`);
    }
  } catch (err: any) {
    console.warn(`[WARN] Could not query table security attributes: ${err?.message || err}`);
  }

  // 4. Query Explicit Grants from information_schema
  let explicitGrants: ExplicitGrant[] = [];
  try {
    const grantRows = await prisma.$queryRaw<Array<{
      grantee: string;
      table_name: string;
      privilege_type: string;
    }>>`
      SELECT
        grantee,
        table_name,
        privilege_type
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND grantee IN ('anon', 'authenticated', 'PUBLIC')
        AND table_name NOT LIKE '_prisma_%'
      ORDER BY table_name, grantee, privilege_type;
    `;

    explicitGrants = grantRows.map((g) => ({
      grantee: g.grantee,
      tableName: g.table_name,
      privilegeType: g.privilege_type,
    }));

    console.log(`\n--- EXPLICIT ROLE_TABLE_GRANTS (${explicitGrants.length}) ---`);
    if (explicitGrants.length === 0) {
      console.log('  No explicit grants found for anon, authenticated, or PUBLIC.');
    } else {
      for (const g of explicitGrants) {
        console.log(`  Grantee: ${g.grantee.padEnd(16)} Table: ${g.tableName.padEnd(25)} Privilege: ${g.privilegeType}`);
      }
    }
  } catch (err: any) {
    console.warn(`[WARN] Could not query role_table_grants: ${err?.message || err}`);
  }

  // 5. Active RLS Policies
  let policies: PolicyInfo[] = [];
  try {
    const policyRows = await prisma.$queryRaw<Array<{
      schemaname: string;
      tablename: string;
      policyname: string;
      permissive: string;
      roles: string[] | string;
      cmd: string;
    }>>`
      SELECT
        schemaname,
        tablename,
        policyname,
        permissive,
        roles,
        cmd
      FROM pg_policies
      WHERE schemaname = 'public'
      ORDER BY tablename, policyname;
    `;

    policies = policyRows.map((p) => ({
      ...p,
      roles: Array.isArray(p.roles) ? p.roles : [String(p.roles)],
    }));

    console.log(`\n--- ACTIVE RLS POLICIES (${policies.length}) ---`);
    if (policies.length === 0) {
      console.log('  Notice: 0 active RLS policies defined in pg_policies.');
      console.log('  Security Invariant: With RLS enabled and 0 policies, non-bypass roles (anon, authenticated)');
      console.log('  are DEFAULT-DENIED (0 rows visible / all writes rejected) by PostgreSQL RLS engine.');
    } else {
      for (const pol of policies) {
        console.log(`  • ${pol.tablename}.${pol.policyname} [${pol.cmd}] -> Roles: ${pol.roles.join(', ')}`);
      }
    }
  } catch (err: any) {
    console.warn(`[WARN] Could not query pg_policies: ${err?.message || err}`);
  }

  console.log('\n============================================================');
  console.log('   VERIFICATION COMPLETE (Strictly Read-Only)              ');
  console.log('============================================================\n');

  return { roleInfo, tables, policies, explicitGrants };
}

void verifyDatabaseSecurity()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Security verification failed:', err);
    process.exit(1);
  });
