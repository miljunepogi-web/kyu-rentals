-- ============================================================================
-- KYU RENTALS - LOCK DOWN PAYMONGO WEBHOOK LOGS
-- Date: 2026-07-27
-- Purpose:
--   1. Enable RLS on the internal PayMongo webhook log table.
--   2. Remove schema-wide anonymous table SELECT grants/default privileges.
--   3. Re-grant anonymous SELECT only to the public package catalog.
-- ============================================================================

-- Stop future public tables from inheriting anonymous read access.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    REVOKE SELECT ON TABLES FROM anon;

-- Remove the previous blanket anonymous read grant from every current table.
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;

-- Keep the intentionally public catalog table readable. RLS still limits rows
-- to published, non-deleted packages via the existing packages SELECT policy.
GRANT SELECT ON TABLE public.packages TO anon;

-- PayMongo webhook logs are internal only. They contain raw payment provider
-- payloads and must never be readable through the public anon/authenticated API.
ALTER TABLE public.paymongo_webhook_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access paymongo_webhook_logs"
    ON public.paymongo_webhook_logs;

CREATE POLICY "Service role full access paymongo_webhook_logs"
    ON public.paymongo_webhook_logs
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);
