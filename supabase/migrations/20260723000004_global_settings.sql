-- ============================================================================
-- KYU RENTALS — MIGRATION 00004: GLOBAL SETTINGS & SETTINGS HISTORY
-- Version: 1.0.0
-- Date: 2026-07-23
-- Purpose: Create typed key-value settings table, settings_history audit log,
--          versioning triggers, and Row Level Security policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SETTINGS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    namespace TEXT NOT NULL,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json', 'url', 'image_url', 'html', 'markdown')),
    label TEXT NOT NULL,
    description TEXT NULL,
    validation_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    is_sensitive BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    updated_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_settings_tenant_namespace_key UNIQUE (tenant_id, namespace, key)
);

COMMENT ON TABLE public.settings IS 'Typed key-value configuration store for tenant business rules and policies.';

-- Indexes for settings
CREATE INDEX IF NOT EXISTS idx_settings_lookup ON public.settings (tenant_id, namespace, key);
CREATE INDEX IF NOT EXISTS idx_settings_public ON public.settings (tenant_id, is_public) WHERE is_public = TRUE;

-- Trigger for updated_at + version increment
CREATE TRIGGER trg_settings_updated_at
    BEFORE UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column('increment_version');


-- ----------------------------------------------------------------------------
-- 2. SETTINGS HISTORY TABLE (APPEND-ONLY ARCHIVE)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.settings_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_id UUID NOT NULL REFERENCES public.settings(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    previous_value JSONB NOT NULL,
    new_value JSONB NOT NULL,
    changed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason TEXT NULL
);

COMMENT ON TABLE public.settings_history IS 'Immutable version history log of setting changes.';

-- Indexes for settings_history
CREATE INDEX IF NOT EXISTS idx_settings_history_setting ON public.settings_history (setting_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_settings_history_tenant ON public.settings_history (tenant_id, changed_at DESC);


-- ----------------------------------------------------------------------------
-- 3. SETTINGS HISTORY TRIGGER FUNCTION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.log_settings_history()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.value IS DISTINCT FROM NEW.value THEN
        INSERT INTO public.settings_history (
            setting_id,
            tenant_id,
            previous_value,
            new_value,
            changed_by,
            changed_at
        )
        VALUES (
            OLD.id,
            OLD.tenant_id,
            OLD.value,
            NEW.value,
            NEW.updated_by,
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.log_settings_history() IS 'Trigger function automatically creating settings_history entries on value change.';

CREATE TRIGGER trg_settings_log_history
    AFTER UPDATE ON public.settings
    FOR EACH ROW
    EXECUTE FUNCTION public.log_settings_history();


-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY & POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_history ENABLE ROW LEVEL SECURITY;

-- Settings Policies
CREATE POLICY "Public read public settings"
    ON public.settings
    FOR SELECT
    TO anon, authenticated
    USING (is_public = TRUE);

CREATE POLICY "Authenticated members read tenant settings"
    ON public.settings
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_deleted = FALSE
        )
    );

CREATE POLICY "Tenant members update settings in same tenant"
    ON public.settings
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_deleted = FALSE
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_deleted = FALSE
        )
    );

CREATE POLICY "Service role full access settings"
    ON public.settings FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Settings History Policies (Read-only for authenticated, NO update/delete policies)
CREATE POLICY "Authenticated members read settings history"
    ON public.settings_history
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_deleted = FALSE
        )
    );

CREATE POLICY "Service role full access settings_history"
    ON public.settings_history FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
