-- ============================================================================
-- KYU RENTALS — MIGRATION 00003: USER MANAGEMENT & ROLE-BASED ACCESS CONTROL
-- Version: 1.0.1 (TENANT RLS PROFILE DEPENDENCY MOVED HERE)
-- Date: 2026-07-24
-- Purpose: Create profiles, roles, permissions, role_permissions, user_roles, 
--          link pending foreign keys, enable RLS, recreate profile-dependent policies,
--          and attach auth.users trigger.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEQUENCES
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.profiles_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.profiles_public_id_seq TO postgres, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. PROFILES TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('USR', 'profiles_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    email extensions.citext NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT NULL,
    avatar_url TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_source public.created_source_type NOT NULL DEFAULT 'WEB'::public.created_source_type,
    
    -- Soft Delete Standard
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL,
    deletion_reason TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Application-level user profiles extending Supabase auth.users.';

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_email ON public.profiles (tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_profiles_active ON public.profiles (tenant_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON public.profiles (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm ON public.profiles USING GIN (full_name extensions.gin_trgm_ops);

-- Self-referencing FK for deleted_by
ALTER TABLE public.profiles 
    ADD CONSTRAINT fk_profiles_deleted_by 
    FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Trigger for updated_at + version increment
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column('increment_version');


-- ----------------------------------------------------------------------------
-- 3. LINK PENDING TENANT & PLAN FOREIGN KEYS TO PROFILES
-- ----------------------------------------------------------------------------

ALTER TABLE public.subscription_plans
    ADD CONSTRAINT fk_subscription_plans_archived_by
    FOREIGN KEY (archived_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.tenants
    ADD CONSTRAINT fk_tenants_owner_id
    FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_tenants_deleted_by
    FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_tenants_archived_by
    FOREIGN KEY (archived_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ----------------------------------------------------------------------------
-- 4. ROLES & PERMISSIONS TABLES (RBAC)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name extensions.citext NOT NULL UNIQUE,
    description TEXT NULL,
    is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.roles IS 'Master list of system and custom application roles.';

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action extensions.citext NOT NULL UNIQUE,
    category TEXT NOT NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.permissions IS 'Granular permission actions taxonomy.';

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS 'Junction table mapping permissions to roles.';

CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    assigned_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_roles_user_role_tenant UNIQUE (user_id, role_id, tenant_id)
);

COMMENT ON TABLE public.user_roles IS 'Junction table mapping user profiles to roles within a tenant context.';

-- Indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_lookup ON public.user_roles (user_id, tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles (role_id);


-- ----------------------------------------------------------------------------
-- 5. ATTACH AUTH.USERS TRIGGER
-- ----------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY & POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Tenants Policy (Profile-dependent policy moved from Migration 00002)
CREATE POLICY "Authenticated members view own tenant"
    ON public.tenants
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = FALSE 
        AND (
            id IN (
                SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
            )
            OR owner_id = auth.uid()
        )
    );

-- Profiles Policies
CREATE POLICY "Users view own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid() AND is_deleted = FALSE);

CREATE POLICY "Users update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid() AND is_deleted = FALSE)
    WITH CHECK (id = auth.uid());

CREATE POLICY "Tenant members view profiles in same tenant"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = FALSE
        AND tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_deleted = FALSE
        )
    );

CREATE POLICY "Service role full access profiles"
    ON public.profiles FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Roles & Permissions Policies (Read-only for authenticated)
CREATE POLICY "Authenticated read roles"
    ON public.roles FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated read permissions"
    ON public.permissions FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Authenticated read role_permissions"
    ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Service role full access roles"
    ON public.roles FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access permissions"
    ON public.permissions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Service role full access role_permissions"
    ON public.role_permissions FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- User Roles Policies
CREATE POLICY "Users view own roles"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Tenant admins view user roles in same tenant"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_deleted = FALSE
        )
    );

CREATE POLICY "Service role full access user_roles"
    ON public.user_roles FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
