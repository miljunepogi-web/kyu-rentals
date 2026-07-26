-- ============================================================================
-- KYU RENTALS — ADMIN STAFF RLS HARDENING
-- Date: 2026-07-27
-- Purpose:
--   1. Add canonical staff-role predicates for RLS and middleware checks.
--   2. Allow real admin dashboard reads/writes under authenticated anon-key clients.
--   3. Replace broad tenant-member admin policies with staff-only policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CANONICAL STAFF ROLE HELPERS
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_staff(
    check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id AND ur.tenant_id = p.tenant_id
        JOIN public.roles r ON r.id = ur.role_id
        WHERE p.id = check_user_id
          AND p.is_active = TRUE
          AND p.is_deleted = FALSE
          AND LOWER(r.name::text) IN (
              'owner',
              'franchise_owner',
              'super_admin',
              'admin',
              'support_staff',
              'driver'
          )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_admin_staff_for_tenant(
    check_tenant_id UUID,
    check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_tenant_id IS NULL OR check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id AND ur.tenant_id = check_tenant_id
        JOIN public.roles r ON r.id = ur.role_id
        WHERE p.id = check_user_id
          AND p.tenant_id = check_tenant_id
          AND p.is_active = TRUE
          AND p.is_deleted = FALSE
          AND LOWER(r.name::text) IN (
              'owner',
              'franchise_owner',
              'super_admin',
              'admin',
              'support_staff',
              'driver'
          )
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.is_admin_staff(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin_staff_for_tenant(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin_staff(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin_staff_for_tenant(UUID, UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. CORE ADMIN READ/WRITE SURFACE
-- ----------------------------------------------------------------------------

CREATE POLICY "Staff view all bookings in tenant"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

CREATE POLICY "Staff update bookings in tenant"
    ON public.bookings
    FOR UPDATE
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id))
    WITH CHECK (public.is_admin_staff_for_tenant(tenant_id));

CREATE POLICY "Staff view payments in tenant"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

CREATE POLICY "Staff manage inventory units in tenant"
    ON public.inventory_units
    FOR ALL
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id))
    WITH CHECK (public.is_admin_staff_for_tenant(tenant_id));

CREATE POLICY "Staff view inventory locks in tenant"
    ON public.inventory_locks
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

CREATE POLICY "Staff manage booking timeline events in tenant"
    ON public.booking_timeline_events
    FOR ALL
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id))
    WITH CHECK (public.is_admin_staff_for_tenant(tenant_id));

CREATE POLICY "Staff view idempotency keys in tenant"
    ON public.idempotency_keys
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

-- ----------------------------------------------------------------------------
-- 3. USER, ROLE, SETTINGS, AND AUDIT TABLES
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tenant members view profiles in same tenant" ON public.profiles;
CREATE POLICY "Staff view profiles in same tenant"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = FALSE
        AND public.is_admin_staff_for_tenant(tenant_id)
    );

DROP POLICY IF EXISTS "Tenant admins view user roles in same tenant" ON public.user_roles;
CREATE POLICY "Staff view user roles in same tenant"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Authenticated members read tenant settings" ON public.settings;
DROP POLICY IF EXISTS "Tenant members update settings in same tenant" ON public.settings;
CREATE POLICY "Staff read tenant settings"
    ON public.settings
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

CREATE POLICY "Staff manage tenant settings"
    ON public.settings
    FOR ALL
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id))
    WITH CHECK (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Authenticated members read settings history" ON public.settings_history;
CREATE POLICY "Staff read settings history"
    ON public.settings_history
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Authenticated members view audit logs in same tenant" ON public.audit_logs;
CREATE POLICY "Staff view audit logs in same tenant"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

-- ----------------------------------------------------------------------------
-- 4. INVENTORY, LOGISTICS, FINANCIAL, PROMO, AND POD TABLES
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Tenant members view own maintenance logs" ON public.inventory_maintenance_logs;
CREATE POLICY "Staff view maintenance logs in tenant"
    ON public.inventory_maintenance_logs
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant members view own delivery assignment logs" ON public.delivery_assignment_logs;
CREATE POLICY "Staff view delivery assignment logs in tenant"
    ON public.delivery_assignment_logs
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant members view expense categories" ON public.expense_categories;
CREATE POLICY "Staff view expense categories in tenant"
    ON public.expense_categories
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = FALSE
        AND public.is_admin_staff_for_tenant(tenant_id)
    );

DROP POLICY IF EXISTS "Tenant staff view active expenses" ON public.expenses;
CREATE POLICY "Staff view active expenses in tenant"
    ON public.expenses
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = FALSE
        AND public.is_admin_staff_for_tenant(tenant_id)
    );

DROP POLICY IF EXISTS "Tenant staff view expense logs" ON public.expense_logs;
CREATE POLICY "Staff view expense logs in tenant"
    ON public.expense_logs
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

CREATE POLICY "Staff manage promo codes in tenant"
    ON public.promo_codes
    FOR ALL
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id))
    WITH CHECK (public.is_admin_staff_for_tenant(tenant_id));

CREATE POLICY "Staff view promo redemptions in tenant"
    ON public.promo_code_redemptions
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant staff view delivery checklists" ON public.delivery_checklists;
CREATE POLICY "Staff view delivery checklists in tenant"
    ON public.delivery_checklists
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant staff view proof of deliveries" ON public.proof_of_deliveries;
CREATE POLICY "Staff view proof of deliveries in tenant"
    ON public.proof_of_deliveries
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant staff view pod photos" ON public.proof_of_delivery_photos;
CREATE POLICY "Staff view pod photos in tenant"
    ON public.proof_of_delivery_photos
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant staff view incidents" ON public.incidents;
CREATE POLICY "Staff view incidents in tenant"
    ON public.incidents
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));

DROP POLICY IF EXISTS "Tenant staff view incident photos" ON public.incident_photos;
CREATE POLICY "Staff view incident photos in tenant"
    ON public.incident_photos
    FOR SELECT
    TO authenticated
    USING (public.is_admin_staff_for_tenant(tenant_id));
