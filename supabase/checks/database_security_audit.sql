-- ============================================================================
-- KYU RENTALS - DATABASE SECURITY AUDIT
-- Purpose:
--   Run after migrations to catch tables without RLS and accidental anonymous
--   SELECT grants outside the public catalog allowlist.
--
-- Expected clean result:
--   Both queries return zero rows.
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
    grants.privilege_type
FROM information_schema.role_table_grants grants
LEFT JOIN allowed_anon_select_tables allowed
    ON allowed.table_name = grants.table_name
WHERE grants.table_schema = 'public'
  AND grants.grantee = 'anon'
  AND grants.privilege_type = 'SELECT'
  AND allowed.table_name IS NULL
ORDER BY grants.table_name;
