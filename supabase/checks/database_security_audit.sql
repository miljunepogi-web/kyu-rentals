-- ============================================================================
-- KYU RENTALS - DATABASE SECURITY AUDIT
-- Purpose:
--   Run after migrations to catch tables without RLS and accidental anonymous
--   SELECT grants outside the public catalog allowlist, plus mutable search
--   paths on privileged functions.
--
-- Expected clean result:
--   All five queries return zero rows.
-- ============================================================================

-- 1. Every public base table should have RLS enabled.
SELECT
    c.relname AS table_name,
    c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity = FALSE
ORDER BY c.relname;

-- 2. Anonymous SELECT should be scoped only to intentional public catalog data.
WITH allowed_anon_select_tables(table_name) AS (
    VALUES
        ('packages')
)
SELECT
    grants.table_name,
    grants.column_name,
    grants.privilege_type
FROM information_schema.column_privileges grants
LEFT JOIN allowed_anon_select_tables allowed
    ON allowed.table_name = grants.table_name
WHERE grants.table_schema = 'public'
  AND grants.grantee = 'anon'
  AND grants.privilege_type = 'SELECT'
  AND allowed.table_name IS NULL
ORDER BY grants.table_name;

-- 3. Every SECURITY DEFINER function must pin its search_path.
SELECT
    namespace.nspname AS schema_name,
    procedure.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
FROM pg_catalog.pg_proc AS procedure
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND procedure.prosecdef = TRUE
  AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(procedure.proconfig, ARRAY[]::TEXT[])) AS setting
      WHERE setting LIKE 'search_path=%'
  )
ORDER BY procedure.proname, identity_arguments;

-- 4. Public package reads must work before and after customer authentication.
SELECT
    policy.policyname,
    policy.roles
FROM pg_catalog.pg_policies AS policy
WHERE policy.schemaname = 'public'
  AND policy.tablename = 'packages'
  AND policy.policyname = 'Public read published packages'
  AND NOT (
      policy.roles @> ARRAY['anon']::NAME[]
      AND policy.roles @> ARRAY['authenticated']::NAME[]
  );

-- 5. PayMongo confirmation functions must release temporary inventory locks.
SELECT
    procedure.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
FROM pg_catalog.pg_proc AS procedure
JOIN pg_catalog.pg_namespace AS namespace
  ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND procedure.proname = 'process_paymongo_webhook_atomic'
  AND (
      POSITION('delete from public.inventory_locks' IN LOWER(pg_catalog.pg_get_functiondef(procedure.oid))) = 0
      OR POSITION('session_id' IN LOWER(pg_catalog.pg_get_functiondef(procedure.oid))) = 0
  );
