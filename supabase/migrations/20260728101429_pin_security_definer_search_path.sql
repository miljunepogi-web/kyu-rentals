-- ============================================================================
-- KYU RENTALS - PIN SECURITY DEFINER FUNCTION SEARCH PATHS
-- Purpose:
--   Harden every existing SECURITY DEFINER function in the exposed public
--   schema against search-path object shadowing.
--
-- This is intentionally a forward-only catalog migration. It avoids rewriting
-- historical function definitions and automatically handles overloaded
-- functions through their identity arguments.
-- ============================================================================

DO $$
DECLARE
    function_record RECORD;
BEGIN
    FOR function_record IN
        SELECT
            namespace.nspname AS schema_name,
            procedure.proname AS function_name,
            pg_catalog.pg_get_function_identity_arguments(procedure.oid) AS identity_arguments
        FROM pg_catalog.pg_proc AS procedure
        JOIN pg_catalog.pg_namespace AS namespace
          ON namespace.oid = procedure.pronamespace
        WHERE namespace.nspname = 'public'
          AND procedure.prosecdef = TRUE
    LOOP
        EXECUTE format(
            'ALTER FUNCTION %I.%I(%s) SET search_path TO pg_catalog, public, pg_temp',
            function_record.schema_name,
            function_record.function_name,
            function_record.identity_arguments
        );
    END LOOP;
END;
$$;
