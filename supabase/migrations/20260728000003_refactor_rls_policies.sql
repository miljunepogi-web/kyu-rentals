-- ============================================================================
-- KYU RENTALS — SECURITY HARDENING PR 2: ROLE-BASED RLS REFACTORING
-- Date: 2026-07-28
-- Purpose:
--   1. Replace broad is_admin_staff_for_tenant() policy calls with fine-grained
--      public.has_permission() RPC calls.
--   2. Restrict Payments SELECT strictly to financials.view (protect financial privacy).
--   3. Enforce Driver Row Ownership: logistics.view_assigned MUST be combined
--      with assigned_delivery_personnel_id = auth.uid().
--   4. Enforce strict tenant isolation: non-super-admin checks MUST pass a valid,
--      verified tenant_id from the target row.
--   5. Preserve customer self-service access and service_role bypasses.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BACKWARD-COMPATIBLE WRAPPER REFACTORING
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_staff_for_tenant(
    check_tenant_id UUID,
    check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
BEGIN
    IF check_tenant_id IS NULL OR check_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Delegates to fine-grained permission helper with explicit tenant context
    RETURN public.can_access_admin_dashboard(check_tenant_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- 2. BOOKINGS & PAYMENTS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff view all bookings in tenant" ON public.bookings;
CREATE POLICY "Staff view all bookings in tenant"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (public.has_permission('bookings.view', tenant_id));

DROP POLICY IF EXISTS "Drivers view assigned bookings" ON public.bookings;
CREATE POLICY "Drivers view assigned bookings"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (
        assigned_delivery_personnel_id = auth.uid()
        AND public.has_permission('logistics.view_assigned', tenant_id)
    );

DROP POLICY IF EXISTS "Staff update bookings in tenant" ON public.bookings;
CREATE POLICY "Staff update bookings in tenant"
    ON public.bookings
    FOR UPDATE
    TO authenticated
    USING (public.has_permission('bookings.manage', tenant_id))
    WITH CHECK (public.has_permission('bookings.manage', tenant_id));

-- Payments RLS: Financial privacy enforcement.
-- bookings.view alone is NOT sufficient. Staff must possess financials.view permission.
-- (Customer self-read is handled by "Customers view own payments" -> booking customer_id = auth.uid())
DROP POLICY IF EXISTS "Staff view payments in tenant" ON public.payments;
CREATE POLICY "Staff view payments in tenant"
    ON public.payments
    FOR SELECT
    TO authenticated
    USING (public.has_permission('financials.view', tenant_id));

-- ----------------------------------------------------------------------------
-- 3. INVENTORY & TIMELINE EVENTS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff manage inventory units in tenant" ON public.inventory_units;
CREATE POLICY "Staff manage inventory units in tenant"
    ON public.inventory_units
    FOR ALL
    TO authenticated
    USING (public.has_permission('inventory.manage', tenant_id))
    WITH CHECK (public.has_permission('inventory.manage', tenant_id));

DROP POLICY IF EXISTS "Staff view inventory locks in tenant" ON public.inventory_locks;
CREATE POLICY "Staff view inventory locks in tenant"
    ON public.inventory_locks
    FOR SELECT
    TO authenticated
    USING (public.has_permission('inventory.view', tenant_id));

DROP POLICY IF EXISTS "Staff manage booking timeline events in tenant" ON public.booking_timeline_events;
CREATE POLICY "Staff manage booking timeline events in tenant"
    ON public.booking_timeline_events
    FOR ALL
    TO authenticated
    USING (public.has_permission('bookings.manage', tenant_id))
    WITH CHECK (public.has_permission('bookings.manage', tenant_id));

DROP POLICY IF EXISTS "Staff view idempotency keys in tenant" ON public.idempotency_keys;
CREATE POLICY "Staff view idempotency keys in tenant"
    ON public.idempotency_keys
    FOR SELECT
    TO authenticated
    USING (public.has_permission('bookings.view', tenant_id));

-- ----------------------------------------------------------------------------
-- 4. USER PROFILES, STAFF, SETTINGS & AUDIT LOGS
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff view profiles in same tenant" ON public.profiles;
CREATE POLICY "Staff view profiles in same tenant"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = FALSE
        AND (
            id = auth.uid()
            OR public.has_permission('staff.view', tenant_id)
        )
    );

DROP POLICY IF EXISTS "Staff view user roles in same tenant" ON public.user_roles;
CREATE POLICY "Staff view user roles in same tenant"
    ON public.user_roles
    FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR public.has_permission('staff.view', tenant_id)
    );

DROP POLICY IF EXISTS "Staff read tenant settings" ON public.settings;
CREATE POLICY "Staff read tenant settings"
    ON public.settings
    FOR SELECT
    TO authenticated
    USING (public.has_permission('settings.manage', tenant_id));

DROP POLICY IF EXISTS "Staff manage tenant settings" ON public.settings;
CREATE POLICY "Staff manage tenant settings"
    ON public.settings
    FOR ALL
    TO authenticated
    USING (public.has_permission('settings.manage', tenant_id))
    WITH CHECK (public.has_permission('settings.manage', tenant_id));

DROP POLICY IF EXISTS "Staff read settings history" ON public.settings_history;
CREATE POLICY "Staff read settings history"
    ON public.settings_history
    FOR SELECT
    TO authenticated
    USING (public.has_permission('settings.manage', tenant_id));

DROP POLICY IF EXISTS "Staff view audit logs in same tenant" ON public.audit_logs;
CREATE POLICY "Staff view audit logs in same tenant"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (public.has_permission('admin.dashboard.view', tenant_id));

-- ----------------------------------------------------------------------------
-- 5. FINANCIALS, EXPENSES & PROMO CODES
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff view expense categories in tenant" ON public.expense_categories;
CREATE POLICY "Staff view expense categories in tenant"
    ON public.expense_categories
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = FALSE
        AND public.has_permission('financials.view', tenant_id)
    );

DROP POLICY IF EXISTS "Staff view active expenses in tenant" ON public.expenses;
CREATE POLICY "Staff view active expenses in tenant"
    ON public.expenses
    FOR SELECT
    TO authenticated
    USING (
        is_deleted = FALSE
        AND public.has_permission('financials.view', tenant_id)
    );

DROP POLICY IF EXISTS "Staff view expense logs in tenant" ON public.expense_logs;
CREATE POLICY "Staff view expense logs in tenant"
    ON public.expense_logs
    FOR SELECT
    TO authenticated
    USING (public.has_permission('financials.view', tenant_id));

DROP POLICY IF EXISTS "Staff manage promo codes in tenant" ON public.promo_codes;
CREATE POLICY "Staff manage promo codes in tenant"
    ON public.promo_codes
    FOR ALL
    TO authenticated
    USING (public.has_permission('bookings.manage', tenant_id))
    WITH CHECK (public.has_permission('bookings.manage', tenant_id));

DROP POLICY IF EXISTS "Staff view promo redemptions in tenant" ON public.promo_code_redemptions;
CREATE POLICY "Staff view promo redemptions in tenant"
    ON public.promo_code_redemptions
    FOR SELECT
    TO authenticated
    USING (public.has_permission('bookings.view', tenant_id));

-- ----------------------------------------------------------------------------
-- 6. LOGISTICS, PROOF OF DELIVERY & INCIDENTS (DRIVER ROW OWNERSHIP ENFORCED)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Staff view maintenance logs in tenant" ON public.inventory_maintenance_logs;
CREATE POLICY "Staff view maintenance logs in tenant"
    ON public.inventory_maintenance_logs
    FOR SELECT
    TO authenticated
    USING (public.has_permission('inventory.view', tenant_id));

-- Driver logistics checks MUST combine logistics.view_assigned with assigned_delivery_personnel_id = auth.uid()
DROP POLICY IF EXISTS "Staff view delivery assignment logs in tenant" ON public.delivery_assignment_logs;
CREATE POLICY "Staff view delivery assignment logs in tenant"
    ON public.delivery_assignment_logs
    FOR SELECT
    TO authenticated
    USING (
        public.has_permission('bookings.view', tenant_id)
        OR (
            public.has_permission('logistics.view_assigned', tenant_id)
            AND (
                assignee_id = auth.uid()
                OR booking_id IN (
                    SELECT id FROM public.bookings
                    WHERE assigned_delivery_personnel_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Staff view delivery checklists in tenant" ON public.delivery_checklists;
CREATE POLICY "Staff view delivery checklists in tenant"
    ON public.delivery_checklists
    FOR SELECT
    TO authenticated
    USING (
        public.has_permission('bookings.view', tenant_id)
        OR (
            public.has_permission('logistics.view_assigned', tenant_id)
            AND booking_id IN (
                SELECT id FROM public.bookings
                WHERE assigned_delivery_personnel_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Staff view proof of deliveries" ON public.proof_of_deliveries;
CREATE POLICY "Staff view proof of deliveries in tenant"
    ON public.proof_of_deliveries
    FOR SELECT
    TO authenticated
    USING (
        public.has_permission('bookings.view', tenant_id)
        OR (
            public.has_permission('logistics.view_assigned', tenant_id)
            AND booking_id IN (
                SELECT id FROM public.bookings
                WHERE assigned_delivery_personnel_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Staff view pod photos in tenant" ON public.proof_of_delivery_photos;
CREATE POLICY "Staff view pod photos in tenant"
    ON public.proof_of_delivery_photos
    FOR SELECT
    TO authenticated
    USING (
        public.has_permission('bookings.view', tenant_id)
        OR (
            public.has_permission('logistics.view_assigned', tenant_id)
            AND proof_of_delivery_id IN (
                SELECT pod.id FROM public.proof_of_deliveries pod
                JOIN public.bookings b ON b.id = pod.booking_id
                WHERE b.assigned_delivery_personnel_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Staff view incidents in tenant" ON public.incidents;
CREATE POLICY "Staff view incidents in tenant"
    ON public.incidents
    FOR SELECT
    TO authenticated
    USING (public.has_permission('bookings.view', tenant_id));

DROP POLICY IF EXISTS "Staff view incident photos in tenant" ON public.incident_photos;
CREATE POLICY "Staff view incident photos in tenant"
    ON public.incident_photos
    FOR SELECT
    TO authenticated
    USING (public.has_permission('bookings.view', tenant_id));
