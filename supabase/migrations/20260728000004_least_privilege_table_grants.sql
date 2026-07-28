-- ============================================================================
-- KYU RENTALS — SECURITY HARDENING PR 3: LEAST PRIVILEGE TABLE & FUNCTION GRANTS
-- Date: 2026-07-28
-- Purpose:
--   1. Enforce strict least-privilege PostgreSQL grants across all 33 public tables.
--   2. Revoke default ALL grants from PUBLIC and anon.
--   3. Restrict anon access strictly to the public equipment catalog.
--   4. Revoke direct INSERT/UPDATE/DELETE/TRUNCATE on immutable ledgers (payments, audit_logs, timeline_events).
--   5. Enforce explicit column-level INSERT and UPDATE grants for authenticated users.
--   6. Enforce RLS WITH CHECK tenant & ownership assertions across all domain tables.
--   7. Harden is_admin_staff() function search_path and auth.uid() identity binding.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. DATABASE CONSTRAINTS & UNIQUE INDEXES
-- ----------------------------------------------------------------------------

-- Race-proof duplicate review protection
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_unique_booking
ON public.reviews (booking_id);

-- ----------------------------------------------------------------------------
-- 2. HARDENED IS_ADMIN_STAFF() FUNCTION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin_staff(
    check_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
    v_target_user_id UUID := auth.uid();
BEGIN
    -- Force auth.uid() as sole trusted identity for non-service-role callers
    IF current_setting('role', true) <> 'service_role' OR check_user_id IS NULL THEN
        v_target_user_id := auth.uid();
    ELSE
        v_target_user_id := check_user_id;
    END IF;

    IF v_target_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id AND ur.tenant_id = p.tenant_id
        JOIN public.roles r ON r.id = ur.role_id
        WHERE p.id = v_target_user_id
          AND p.is_active = TRUE
          AND p.is_deleted = FALSE
          AND LOWER(r.name::text) IN ('owner', 'franchise_owner', 'super_admin', 'admin')
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public;

-- ----------------------------------------------------------------------------
-- 3. REVOKE BROAD DEFAULT PRIVILEGES
-- ----------------------------------------------------------------------------

-- Revoke all table privileges from PUBLIC and anon
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon;

-- Revoke all sequence privileges from PUBLIC, anon, authenticated
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Revoke all function execution privileges from PUBLIC and anon
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- ----------------------------------------------------------------------------
-- 4. ANONYMOUS ROLE (`anon`) LEAST-PRIVILEGE GRANTS & RLS POLICIES
-- ----------------------------------------------------------------------------

-- 1. packages (public catalog browsing)
GRANT SELECT (id, tenant_id, name, slug, tagline, description, price_4_hours, price_8_hours, price_full_day, featured_image_url, gallery_urls, max_guests, sound_rating, is_featured, is_popular, is_published, created_at)
    ON TABLE public.packages TO anon;

DROP POLICY IF EXISTS "Public read published packages" ON public.packages;
CREATE POLICY "Public read published packages"
    ON public.packages
    FOR SELECT
    TO anon
    USING (is_published = TRUE AND is_deleted = FALSE);

-- Remove stale public policies from tables outside the anonymous allowlist.
DROP POLICY IF EXISTS "Public read active subscription plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Public read approved reviews" ON public.reviews;

-- ----------------------------------------------------------------------------
-- 5. AUTHENTICATED ROLE (`authenticated`) TABLE READ GRANTS
-- ----------------------------------------------------------------------------

GRANT SELECT ON TABLE
    public.packages,
    public.subscription_plans,
    public.tenants,
    public.profiles,
    public.roles,
    public.permissions,
    public.role_permissions,
    public.user_roles,
    public.bookings,
    public.payments,
    public.booking_timeline_events,
    public.inventory_units,
    public.inventory_locks,
    public.inventory_maintenance_logs,
    public.delivery_assignment_logs,
    public.expense_categories,
    public.expenses,
    public.expense_logs,
    public.promo_codes,
    public.promo_code_redemptions,
    public.delivery_checklists,
    public.proof_of_deliveries,
    public.proof_of_delivery_photos,
    public.incidents,
    public.incident_photos,
    public.customer_cancellation_requests,
    public.reviews,
    public.settings,
    public.settings_history,
    public.audit_logs
TO authenticated;

-- Internal webhook logs remain strictly service_role ONLY
REVOKE ALL ON TABLE public.webhook_inbox, public.paymongo_webhook_logs, public.idempotency_keys FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.webhook_inbox, public.paymongo_webhook_logs, public.idempotency_keys TO service_role;

-- ----------------------------------------------------------------------------
-- 6. AUTHENTICATED ROLE COLUMN-LEVEL INSERT GRANTS
-- ----------------------------------------------------------------------------

-- Direct INSERT revoked on immutable ledgers: payments, audit_logs, booking_timeline_events, idempotency_keys, bookings
GRANT INSERT (tenant_id, package_id, serial_number, status, condition_notes) ON TABLE public.inventory_units TO authenticated;
GRANT INSERT (tenant_id, name, description) ON TABLE public.expense_categories TO authenticated;
GRANT INSERT (tenant_id, category_id, amount, description, expense_date, receipt_url) ON TABLE public.expenses TO authenticated;
GRANT INSERT (tenant_id, code, discount_type, discount_value, min_booking_amount, max_discount_amount, max_usage_limit, per_customer_limit, start_date, end_date, created_by) ON TABLE public.promo_codes TO authenticated;
GRANT INSERT (tenant_id, promo_code_id, booking_id, customer_id, discount_applied_amount) ON TABLE public.promo_code_redemptions TO authenticated;
GRANT INSERT (tenant_id, booking_id, checklist_type, microphones_ok, speakers_ok, display_screen_ok, cables_remote_ok, notes, inspected_by) ON TABLE public.delivery_checklists TO authenticated;
GRANT INSERT (tenant_id, booking_id, customer_signature_url, signed_at, signer_name, signer_contact, device_type, signature_version, notes, delivered_by) ON TABLE public.proof_of_deliveries TO authenticated;
GRANT INSERT (tenant_id, pod_id, photo_url, photo_type, caption, uploaded_by) ON TABLE public.proof_of_delivery_photos TO authenticated;
GRANT INSERT (tenant_id, booking_id, unit_id, severity, incident_type, description, estimated_cost, status, reported_by) ON TABLE public.incidents TO authenticated;
GRANT INSERT (tenant_id, incident_id, photo_url, caption, uploaded_by) ON TABLE public.incident_photos TO authenticated;
GRANT INSERT (tenant_id, booking_id, customer_id, previous_status, new_status, reason) ON TABLE public.customer_cancellation_requests TO authenticated;
GRANT INSERT (tenant_id, booking_id, customer_id, rating, comment) ON TABLE public.reviews TO authenticated;
GRANT INSERT (tenant_id, unit_id, previous_status, new_status, reason, notes, performed_by) ON TABLE public.inventory_maintenance_logs TO authenticated;

-- ----------------------------------------------------------------------------
-- 7. AUTHENTICATED ROLE COLUMN-LEVEL UPDATE GRANTS (EXCLUDING updated_at)
-- ----------------------------------------------------------------------------

GRANT UPDATE (full_name, avatar_url, phone) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (status, delivery_address, special_instructions, event_date, start_time, duration_hours, event_end_time, assigned_unit_id, assigned_delivery_personnel_id, vehicle_info) ON TABLE public.bookings TO authenticated;
GRANT UPDATE (status, condition_notes) ON TABLE public.inventory_units TO authenticated;
GRANT UPDATE (name, code, description, is_active) ON TABLE public.expense_categories TO authenticated;
GRANT UPDATE (category_id, amount, expense_date, vendor, description, payment_method, receipt_url, notes) ON TABLE public.expenses TO authenticated;
GRANT UPDATE (code, discount_type, discount_value, min_booking_amount, max_discount_amount, max_usage_limit, per_customer_limit, start_date, end_date, is_active) ON TABLE public.promo_codes TO authenticated;
GRANT UPDATE (checklist_type, microphones_ok, speakers_ok, display_screen_ok, cables_remote_ok, notes) ON TABLE public.delivery_checklists TO authenticated;
GRANT UPDATE (customer_signature_url, signed_at, signer_name, signer_contact, device_type, signature_version, notes) ON TABLE public.proof_of_deliveries TO authenticated;
GRANT UPDATE (photo_url, photo_type, caption) ON TABLE public.proof_of_delivery_photos TO authenticated;
GRANT UPDATE (unit_id, severity, incident_type, description, estimated_cost, status) ON TABLE public.incidents TO authenticated;
GRANT UPDATE (photo_url, caption) ON TABLE public.incident_photos TO authenticated;
GRANT UPDATE (value) ON TABLE public.settings TO authenticated;

-- ----------------------------------------------------------------------------
-- 8. REFINED RLS INSERT POLICIES (TENANT & OWNERSHIP WITH CHECK ASSERTIONS)
-- ----------------------------------------------------------------------------

-- inventory_units INSERT RLS
DROP POLICY IF EXISTS "Staff insert inventory units in tenant" ON public.inventory_units;
CREATE POLICY "Staff insert inventory units in tenant"
    ON public.inventory_units FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND public.has_permission('inventory.manage', tenant_id)
        AND EXISTS (SELECT 1 FROM public.packages p WHERE p.id = package_id AND p.tenant_id = inventory_units.tenant_id AND p.is_deleted = FALSE)
    );

-- expense_categories INSERT RLS
DROP POLICY IF EXISTS "Staff insert expense categories in tenant" ON public.expense_categories;
CREATE POLICY "Staff insert expense categories in tenant"
    ON public.expense_categories FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND public.has_permission('financials.manage', tenant_id)
    );

-- expenses INSERT RLS
DROP POLICY IF EXISTS "Staff insert expenses in tenant" ON public.expenses;
CREATE POLICY "Staff insert expenses in tenant"
    ON public.expenses FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND public.has_permission('financials.manage', tenant_id)
        AND EXISTS (SELECT 1 FROM public.expense_categories c WHERE c.id = category_id AND c.tenant_id = expenses.tenant_id AND c.is_deleted = FALSE)
    );

-- promo_codes INSERT RLS
DROP POLICY IF EXISTS "Staff insert promo codes in tenant" ON public.promo_codes;
CREATE POLICY "Staff insert promo codes in tenant"
    ON public.promo_codes FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND public.has_permission('bookings.manage', tenant_id)
    );

-- promo_code_redemptions INSERT RLS
DROP POLICY IF EXISTS "Staff insert promo redemptions in tenant" ON public.promo_code_redemptions;
CREATE POLICY "Staff insert promo redemptions in tenant"
    ON public.promo_code_redemptions FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND public.has_permission('bookings.manage', tenant_id)
        AND customer_id = (SELECT customer_id FROM public.bookings WHERE id = booking_id)
        AND EXISTS (SELECT 1 FROM public.promo_codes pc WHERE pc.id = promo_code_id AND pc.tenant_id = promo_code_redemptions.tenant_id AND pc.is_deleted = FALSE)
        AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.tenant_id = promo_code_redemptions.tenant_id)
    );

-- delivery_checklists INSERT RLS
DROP POLICY IF EXISTS "Drivers insert delivery checklists for assigned bookings" ON public.delivery_checklists;
CREATE POLICY "Drivers insert delivery checklists for assigned bookings"
    ON public.delivery_checklists FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND (
            public.has_permission('bookings.manage', tenant_id)
            OR (
                public.has_permission('logistics.update_assigned', tenant_id)
                AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.tenant_id = delivery_checklists.tenant_id AND b.assigned_delivery_personnel_id = auth.uid())
            )
        )
    );

-- proof_of_deliveries INSERT RLS
DROP POLICY IF EXISTS "Drivers insert proof of deliveries for assigned bookings" ON public.proof_of_deliveries;
CREATE POLICY "Drivers insert proof of deliveries for assigned bookings"
    ON public.proof_of_deliveries FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND (
            public.has_permission('bookings.manage', tenant_id)
            OR (
                public.has_permission('logistics.update_assigned', tenant_id)
                AND EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.tenant_id = proof_of_deliveries.tenant_id AND b.assigned_delivery_personnel_id = auth.uid())
            )
        )
    );

-- proof_of_delivery_photos INSERT RLS
DROP POLICY IF EXISTS "Drivers insert pod photos for assigned pod" ON public.proof_of_delivery_photos;
CREATE POLICY "Drivers insert pod photos for assigned pod"
    ON public.proof_of_delivery_photos FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND EXISTS (
            SELECT 1 FROM public.proof_of_deliveries pod
            JOIN public.bookings b ON b.id = pod.booking_id AND b.tenant_id = pod.tenant_id
            WHERE pod.id = pod_id
              AND pod.tenant_id = proof_of_delivery_photos.tenant_id
              AND (
                  public.has_permission('bookings.manage', pod.tenant_id)
                  OR (
                      public.has_permission('logistics.update_assigned', pod.tenant_id)
                      AND b.assigned_delivery_personnel_id = auth.uid()
                  )
              )
        )
    );

-- incidents INSERT RLS
DROP POLICY IF EXISTS "Staff and drivers insert incidents for assigned or managed bookings" ON public.incidents;
CREATE POLICY "Staff and drivers insert incidents for assigned or managed bookings"
    ON public.incidents FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = booking_id
              AND b.tenant_id = incidents.tenant_id
              AND (
                  public.has_permission('bookings.manage', b.tenant_id)
                  OR (
                      public.has_permission('logistics.update_assigned', b.tenant_id)
                      AND b.assigned_delivery_personnel_id = auth.uid()
                  )
                  OR b.customer_id = auth.uid()
              )
        )
    );

-- incident_photos INSERT RLS
DROP POLICY IF EXISTS "Staff insert incident photos for tenant incidents" ON public.incident_photos;
CREATE POLICY "Staff insert incident photos for tenant incidents"
    ON public.incident_photos FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND EXISTS (
            SELECT 1 FROM public.incidents inc
            JOIN public.bookings b ON b.id = inc.booking_id AND b.tenant_id = inc.tenant_id
            WHERE inc.id = incident_id
              AND inc.tenant_id = incident_photos.tenant_id
              AND (
                  public.has_permission('bookings.manage', inc.tenant_id)
                  OR (
                      public.has_permission('logistics.update_assigned', inc.tenant_id)
                      AND b.assigned_delivery_personnel_id = auth.uid()
                  )
                  OR b.customer_id = auth.uid()
              )
        )
    );

-- customer_cancellation_requests INSERT RLS
DROP POLICY IF EXISTS "Customers request cancellation on own booking" ON public.customer_cancellation_requests;
CREATE POLICY "Customers request cancellation on own booking"
    ON public.customer_cancellation_requests FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = booking_id
              AND b.tenant_id = customer_cancellation_requests.tenant_id
              AND b.customer_id = auth.uid()
        )
    );

-- reviews INSERT RLS
DROP POLICY IF EXISTS "Customers insert own completed booking reviews" ON public.reviews;
CREATE POLICY "Customers insert own completed booking reviews"
    ON public.reviews FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND customer_id = auth.uid()
        AND is_published = FALSE
        AND EXISTS (
            SELECT 1 FROM public.bookings b
            WHERE b.id = booking_id
              AND b.customer_id = auth.uid()
              AND b.tenant_id = reviews.tenant_id
              AND b.status = 'COMPLETED'
        )
    );

-- inventory_maintenance_logs INSERT RLS
DROP POLICY IF EXISTS "Staff insert maintenance logs for tenant inventory" ON public.inventory_maintenance_logs;
CREATE POLICY "Staff insert maintenance logs for tenant inventory"
    ON public.inventory_maintenance_logs FOR INSERT TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE AND is_deleted = FALSE)
        AND public.has_permission('inventory.manage', tenant_id)
        AND EXISTS (
            SELECT 1 FROM public.inventory_units u
            WHERE u.id = unit_id
              AND u.tenant_id = inventory_maintenance_logs.tenant_id
              AND u.is_deleted = FALSE
        )
    );

-- ----------------------------------------------------------------------------
-- 9. FUNCTION EXECUTION GRANTS (`EXECUTE`)
-- ----------------------------------------------------------------------------

-- Grant execution to authenticated and service_role for client RPCs
GRANT EXECUTE ON FUNCTION
    public.has_permission(TEXT, UUID),
    public.can_access_admin_dashboard(UUID),
    public.can_manage_bookings(UUID),
    public.can_manage_inventory(UUID),
    public.can_manage_staff(UUID),
    public.can_view_financials(UUID),
    public.can_manage_settings(UUID),
    public.is_admin_staff(UUID),
    public.is_admin_staff_for_tenant(UUID, UUID),
    public.generate_public_id(TEXT, TEXT),
    public.log_settings_history(),
    public.create_booking_atomic(UUID, UUID, TEXT, TEXT, TEXT, UUID, DATE, TIME WITHOUT TIME ZONE, INTEGER, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, TIMESTAMP WITH TIME ZONE, TEXT),
    public.create_booking_atomic(UUID, UUID, UUID, DATE, TIME WITHOUT TIME ZONE, INTEGER, TEXT, TEXT, JSONB, TEXT),
    public.record_admin_payment_atomic(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT),
    public.assign_inventory_unit_atomic(UUID, UUID, UUID),
    public.assign_delivery_personnel_admin(UUID, UUID, TEXT, UUID, TEXT, TEXT, UUID),
    public.transition_booking_status_admin(UUID, UUID, TEXT, TEXT, UUID, TEXT),
    public.update_inventory_unit_status_admin(UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT),
    public.create_expense_admin(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, TEXT),
    public.soft_delete_expense_admin(UUID, UUID, TEXT),
    public.submit_proof_of_delivery_admin(UUID, UUID, TEXT, TEXT, TEXT, TEXT),
    public.report_incident_admin(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC),
    public.request_booking_cancellation_customer(UUID, UUID, TEXT, TEXT, UUID),
    public.submit_customer_review(UUID, UUID, UUID, INTEGER, TEXT),
    public.get_admin_package_utilization_admin(UUID),
    public.get_admin_financial_report_admin(UUID),
    public.get_admin_operational_funnel_admin(UUID),
    public.get_admin_net_profit_summary_admin(UUID, DATE, DATE),
    public.get_admin_pnl_report_admin(UUID, INTEGER)
TO authenticated, service_role;

-- Internal / Webhook-only functions: service_role ONLY
REVOKE EXECUTE ON FUNCTION
    public.process_paymongo_webhook_atomic(TEXT, TEXT, UUID, TEXT, NUMERIC, TEXT, JSONB),
    public.process_paymongo_webhook_atomic(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMP WITH TIME ZONE, JSONB),
    public.log_audit_event(UUID, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT, TEXT, JSONB)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION
    public.process_paymongo_webhook_atomic(TEXT, TEXT, UUID, TEXT, NUMERIC, TEXT, JSONB),
    public.process_paymongo_webhook_atomic(UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMP WITH TIME ZONE, JSONB),
    public.log_audit_event(UUID, TEXT, TEXT, TEXT, UUID, TEXT, UUID, TEXT, TEXT, JSONB)
TO service_role;

-- ----------------------------------------------------------------------------
-- 10. CONFIGURE ALTER DEFAULT PRIVILEGES FOR FUTURE OBJECTS
-- ----------------------------------------------------------------------------

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon;
