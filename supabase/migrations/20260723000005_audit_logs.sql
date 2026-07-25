-- ============================================================================
-- KYU RENTALS — MIGRATION 00005: AUDIT LOGS FOUNDATION
-- Version: 1.0.0
-- Date: 2026-07-23
-- Purpose: Create immutable audit_logs table, GIN indexes, telemetry fields,
--          and strict write-only Row Level Security policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. AUDIT LOGS TABLE (IMMUTABLE RECORD)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    performed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    performed_by_role TEXT NULL,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    entity_type TEXT NULL,
    entity_id UUID NULL,
    entity_label TEXT NULL,
    before_state JSONB NULL,
    after_state JSONB NULL,
    diff JSONB NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address INET NULL,
    user_agent TEXT NULL,
    request_id UUID NULL,
    correlation_id UUID NULL,
    request_duration_ms INTEGER NULL CHECK (request_duration_ms >= 0),
    device_type TEXT NULL,
    country_code VARCHAR(2) NULL,
    browser TEXT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    created_source public.created_source_type NOT NULL DEFAULT 'WEB'::public.created_source_type,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.audit_logs IS 'Immutable system audit trail recording all security, configuration, and data mutation events.';

-- ----------------------------------------------------------------------------
-- 2. INDEXES FOR PERFORMANCE & AUDIT SEARCH
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs (performed_by, created_at DESC) WHERE performed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_category ON public.audit_logs (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON public.audit_logs (severity, created_at DESC);

-- GIN Index using jsonb_path_ops for fast key-value metadata searches
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin ON public.audit_logs USING GIN (metadata jsonb_path_ops);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY & POLICIES (IMMUTABLE LOG - NO UPDATE / DELETE)
-- ----------------------------------------------------------------------------

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can insert audit logs for their tenant
CREATE POLICY "Authenticated insert audit logs for own tenant"
    ON public.audit_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_deleted = FALSE
        )
    );

-- Policy: Tenant members can view audit logs in their tenant
CREATE POLICY "Authenticated members view audit logs in same tenant"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_deleted = FALSE
        )
    );

-- Policy: Service role full access (for automated archiving & system processes)
CREATE POLICY "Service role full access audit_logs"
    ON public.audit_logs FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- NOTE: There are intentionally NO UPDATE or DELETE policies for authenticated users.
-- This guarantees audit log immutability at the database security policy level.
