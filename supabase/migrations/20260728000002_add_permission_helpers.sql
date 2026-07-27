-- ============================================================================
-- KYU RENTALS — MIGRATION 00019: PERMISSION REGISTRY & AUTHORIZATION HELPERS (PR 1)
-- Version: 1.0.0
-- Date: 2026-07-28
-- Purpose:
--   1. Seed strict permission registry in public.permissions.
--   2. Map system roles (super_admin, owner, franchise_owner, admin, support_staff, driver) to permissions in public.role_permissions.
--   3. Create security-definer authorization RPCs (get_current_user_roles, has_permission, and helper functions).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEED PERMISSION REGISTRY
-- ----------------------------------------------------------------------------

INSERT INTO public.permissions (action, category, description)
VALUES
    ('admin.dashboard.view', 'admin', 'Access executive operations dashboard'),
    ('bookings.view', 'bookings', 'View booking records within tenant'),
    ('bookings.manage', 'bookings', 'Create, edit, approve, cancel bookings'),
    ('inventory.view', 'inventory', 'View equipment units & locks'),
    ('inventory.manage', 'inventory', 'Assign units, update status & maintenance'),
    ('staff.view', 'staff', 'View tenant profiles & staff roles'),
    ('staff.manage', 'staff', 'Assign roles & manage staff accounts'),
    ('financials.view', 'financials', 'View P&L, revenue, expenses & reports'),
    ('financials.manage', 'financials', 'Create/edit expenses & record payments'),
    ('settings.manage', 'settings', 'Modify tenant settings & business config'),
    ('logistics.view_assigned', 'logistics', 'View assigned deliveries & pickups'),
    ('logistics.update_assigned', 'logistics', 'Update status & upload POD photos for assigned jobs')
ON CONFLICT (action) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. MAP ROLE PERMISSIONS ACCORDING TO AUTHORIZATION MATRIX
-- ----------------------------------------------------------------------------

DO $$
DECLARE
    v_super_admin_id UUID;
    v_owner_id UUID;
    v_franchise_owner_id UUID;
    v_admin_id UUID;
    v_support_staff_id UUID;
    v_driver_id UUID;
BEGIN
    SELECT id INTO v_super_admin_id FROM public.roles WHERE LOWER(name::text) = 'super_admin';
    SELECT id INTO v_owner_id FROM public.roles WHERE LOWER(name::text) = 'owner';
    SELECT id INTO v_franchise_owner_id FROM public.roles WHERE LOWER(name::text) = 'franchise_owner';
    SELECT id INTO v_admin_id FROM public.roles WHERE LOWER(name::text) = 'admin';
    SELECT id INTO v_support_staff_id FROM public.roles WHERE LOWER(name::text) = 'support_staff';
    SELECT id INTO v_driver_id FROM public.roles WHERE LOWER(name::text) = 'driver';

    -- Map super_admin, owner, franchise_owner: FULL PERMISSIONS
    IF v_super_admin_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_super_admin_id, id FROM public.permissions ON CONFLICT DO NOTHING;
    END IF;

    IF v_owner_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_owner_id, id FROM public.permissions ON CONFLICT DO NOTHING;
    END IF;

    IF v_franchise_owner_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_franchise_owner_id, id FROM public.permissions ON CONFLICT DO NOTHING;
    END IF;

    -- Map admin: Dashboard, Bookings, Inventory, Staff, Logistics (NO settings, NO financials)
    IF v_admin_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_admin_id, id FROM public.permissions
        WHERE action IN (
            'admin.dashboard.view', 'bookings.view', 'bookings.manage',
            'inventory.view', 'inventory.manage', 'staff.view', 'staff.manage',
            'logistics.view_assigned', 'logistics.update_assigned'
        )
        ON CONFLICT DO NOTHING;
    END IF;

    -- Map support_staff: Dashboard, Bookings (View & Manage) (NO inventory, staff, settings, financials)
    IF v_support_staff_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_support_staff_id, id FROM public.permissions
        WHERE action IN (
            'admin.dashboard.view', 'bookings.view', 'bookings.manage'
        )
        ON CONFLICT DO NOTHING;
    END IF;

    -- Map driver: Logistics Assigned Only (NO general admin dashboard, NO financials, NO staff, NO settings)
    IF v_driver_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT v_driver_id, id FROM public.permissions
        WHERE action IN (
            'logistics.view_assigned', 'logistics.update_assigned'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. AUTHORIZATION HELPER FUNCTIONS (SECURITY DEFINER, SEARCH_PATH = PUBLIC)
-- ----------------------------------------------------------------------------

-- Helper: Get current authenticated user roles
CREATE OR REPLACE FUNCTION public.get_current_user_roles()
RETURNS TABLE (
    tenant_id UUID,
    role_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT ur.tenant_id, LOWER(r.name::text) AS role_name
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    JOIN public.profiles p ON p.id = ur.user_id AND p.tenant_id = ur.tenant_id
    WHERE ur.user_id = auth.uid()
      AND p.is_active = TRUE
      AND p.is_deleted = FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Core: Fails Closed Permission Checker
CREATE OR REPLACE FUNCTION public.has_permission(
    p_permission_key TEXT,
    p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_has_perm BOOLEAN := FALSE;
BEGIN
    -- Defensive Check: Fail closed on null user or empty permission key
    IF v_user_id IS NULL OR p_permission_key IS NULL OR length(trim(p_permission_key)) = 0 THEN
        RETURN FALSE;
    END IF;

    -- Validate permission key exists in strict registry
    IF NOT EXISTS (SELECT 1 FROM public.permissions WHERE LOWER(action::text) = LOWER(p_permission_key)) THEN
        RETURN FALSE;
    END IF;

    -- Check if user holds a role mapped to p_permission_key in role_permissions
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        JOIN public.role_permissions rp ON rp.role_id = r.id
        JOIN public.permissions perm ON perm.id = rp.permission_id
        JOIN public.profiles p ON p.id = ur.user_id
        WHERE ur.user_id = v_user_id
          AND p.is_active = TRUE
          AND p.is_deleted = FALSE
          AND LOWER(perm.action::text) = LOWER(p_permission_key)
          AND (
              LOWER(r.name::text) = 'super_admin'
              OR p_tenant_id IS NULL
              OR ur.tenant_id = p_tenant_id
          )
    ) INTO v_has_perm;

    RETURN COALESCE(v_has_perm, FALSE);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Helper RPCs for Middleware & Application Layer
CREATE OR REPLACE FUNCTION public.can_access_admin_dashboard(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_permission('admin.dashboard.view', p_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_bookings(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_permission('bookings.manage', p_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_inventory(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_permission('inventory.manage', p_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_staff(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_permission('staff.manage', p_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_view_financials(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_permission('financials.view', p_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.can_manage_settings(p_tenant_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.has_permission('settings.manage', p_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Revoke execute from public/anon, grant to authenticated & service_role
REVOKE EXECUTE ON FUNCTION public.get_current_user_roles() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(TEXT, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_access_admin_dashboard(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_bookings(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_inventory(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_staff(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_financials(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_settings(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_current_user_roles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_access_admin_dashboard(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_bookings(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_inventory(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_staff(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_financials(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_settings(UUID) TO authenticated, service_role;
