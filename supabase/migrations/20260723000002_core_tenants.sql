-- ============================================================================
-- KYU RENTALS — MIGRATION 00002: CORE TENANTS & SUBSCRIPTION PLANS
-- Version: 1.0.1 (DEPENDENCY ORDERING FIXED)
-- Date: 2026-07-24
-- Purpose: Create subscription_plans, tenants, sequences, indexes, and independent RLS policies.
--          Note: Policies dependent on public.profiles are declared in 00003_user_management.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEQUENCES
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.tenants_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.tenants_public_id_seq TO postgres, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. SUBSCRIPTION PLANS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug extensions.citext NOT NULL UNIQUE,
    price_monthly NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price_monthly >= 0),
    price_annual NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price_annual >= 0),
    max_inventory_units INTEGER NOT NULL DEFAULT 5 CHECK (max_inventory_units >= -1),
    max_staff_accounts INTEGER NOT NULL DEFAULT 2 CHECK (max_staff_accounts >= -1),
    max_bookings_per_month INTEGER NOT NULL DEFAULT 50 CHECK (max_bookings_per_month >= -1),
    max_branches INTEGER NOT NULL DEFAULT 1 CHECK (max_branches >= -1),
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ NULL,
    archived_by UUID NULL, -- FK added after profiles table creation in 00003
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.subscription_plans IS 'Platform subscription tiers and feature entitlement limits.';

-- Indexes for subscription_plans
CREATE INDEX IF NOT EXISTS idx_subscription_plans_features ON public.subscription_plans USING GIN (features);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON public.subscription_plans (created_at DESC) WHERE is_active = TRUE AND is_archived = FALSE;

-- Trigger for updated_at
CREATE TRIGGER trg_subscription_plans_updated_at
    BEFORE UPDATE ON public.subscription_plans
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

-- Policies for subscription_plans
CREATE POLICY "Public read active subscription plans"
    ON public.subscription_plans
    FOR SELECT
    TO anon, authenticated
    USING (is_active = TRUE AND is_archived = FALSE);

CREATE POLICY "Service role full access subscription plans"
    ON public.subscription_plans
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);


-- ----------------------------------------------------------------------------
-- 3. TENANTS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('TEN', 'tenants_public_id_seq'),
    name TEXT NOT NULL,
    slug extensions.citext NOT NULL UNIQUE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
    trial_ends_at TIMESTAMPTZ NULL,
    owner_id UUID NULL, -- FK added after profiles table creation in 00003
    billing_email extensions.citext NULL,
    custom_domain extensions.citext NULL UNIQUE,
    is_custom_domain_verified BOOLEAN NOT NULL DEFAULT FALSE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_source public.created_source_type NOT NULL DEFAULT 'WEB'::public.created_source_type,
    
    -- Soft Delete Standard
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL, -- FK added after profiles table creation in 00003
    deletion_reason TEXT NULL,
    
    -- Lifecycle Archive Standard
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ NULL,
    archived_by UUID NULL, -- FK added after profiles table creation in 00003
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.tenants IS 'Core tenant/business entity representing an organization using the platform.';

-- Indexes for tenants
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants (slug);
CREATE INDEX IF NOT EXISTS idx_tenants_custom_domain ON public.tenants (custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_active ON public.tenants (created_at DESC) WHERE is_deleted = FALSE AND is_archived = FALSE;
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON public.tenants (plan_id);

-- Trigger for updated_at + version increment
CREATE TRIGGER trg_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column('increment_version');

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Independent Policies for tenants
CREATE POLICY "Public read active tenant metadata by slug or domain"
    ON public.tenants
    FOR SELECT
    TO anon
    USING (is_deleted = FALSE AND is_archived = FALSE AND status IN ('trial', 'active'));

CREATE POLICY "Service role full access tenants"
    ON public.tenants
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);
