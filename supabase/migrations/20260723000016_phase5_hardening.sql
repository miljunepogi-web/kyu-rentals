-- ============================================================================
-- KYU RENTALS — MIGRATION 00016: PHASE 5 HARDENING & CUSTOMER SELF-SERVICE
-- Version: 1.3.0
-- Date: 2026-07-24
-- Purpose:
--   1. Create customer_cancellation_requests audit table with reserved admin approval fields.
--   2. Create public.request_booking_cancellation_customer() atomic RPC.
--   3. Create public.reviews table with uq_reviews_booking constraint.
--   4. Create public.submit_customer_review() atomic RPC.
--   5. Create public.get_admin_financial_report_admin() PostgreSQL aggregation RPC (SECURITY HARDENED).
--   6. Create public.get_admin_operational_funnel_admin() PostgreSQL aggregation RPC (SECURITY HARDENED).
--   7. Create public.get_admin_package_utilization_admin() PostgreSQL aggregation RPC (SECURITY HARDENED).
--   8. REVOKE from PUBLIC/anon + GRANT to authenticated/service_role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CUSTOMER CANCELLATION REQUESTS TABLE & SEQUENCES
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.cancellation_requests_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.cancellation_requests_public_id_seq TO postgres, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.customer_cancellation_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('CAN', 'cancellation_requests_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    previous_status TEXT NOT NULL,
    new_status TEXT NOT NULL DEFAULT 'CANCELLATION_REQUESTED',
    reason TEXT NOT NULL,
    
    -- Future-proof Admin Approval columns (reserved for future admin workflow)
    processed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    processed_at TIMESTAMPTZ NULL,
    decision TEXT NULL,
    decision_notes TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.customer_cancellation_requests IS
  'Immutable audit log of customer-initiated cancellation requests with reserved admin approval fields.';

CREATE INDEX IF NOT EXISTS idx_customer_cancellation_requests_booking
    ON public.customer_cancellation_requests (tenant_id, booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_cancellation_requests_customer
    ON public.customer_cancellation_requests (customer_id);

ALTER TABLE public.customer_cancellation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own cancellation requests"
    ON public.customer_cancellation_requests
    FOR SELECT
    TO authenticated
    USING (customer_id = auth.uid());

CREATE POLICY "Service role full access cancellation requests"
    ON public.customer_cancellation_requests
    FOR ALL
    TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- ----------------------------------------------------------------------------
-- 2. HARDENED ATOMIC CUSTOMER CANCELLATION RPC (CONCURRENCY & ROW_COUNT)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_booking_cancellation_customer(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_expected_current_status TEXT,
    p_reason TEXT,
    p_customer_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_current_status TEXT;
    v_booking_public_id TEXT;
    v_booking_customer_id UUID;
    v_customer_name TEXT;
    v_rows_affected INTEGER;
    v_caller_uid UUID;
BEGIN
    IF p_tenant_id IS NULL OR p_booking_id IS NULL OR p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Defensive validation failed: Tenant ID, Booking ID, and Customer ID must be non-null';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
        RAISE EXCEPTION 'Defensive validation failed: Cancellation reason must be at least 3 characters long';
    END IF;

    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL OR v_caller_uid != p_customer_id THEN
        RAISE EXCEPTION 'Authorization failed: Supplied customer_id does not match authenticated session. Forged identity rejected.';
    END IF;

    SELECT full_name INTO v_customer_name
    FROM public.profiles
    WHERE id = p_customer_id AND tenant_id = p_tenant_id AND is_active = TRUE AND is_deleted = FALSE;

    IF v_customer_name IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: Profile % is not an active member of tenant %', p_customer_id, p_tenant_id;
    END IF;

    SELECT status, public_id, customer_id
    INTO v_current_status, v_booking_public_id, v_booking_customer_id
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Target booking % not found for tenant %', p_booking_id, p_tenant_id;
    END IF;

    IF v_booking_customer_id != p_customer_id THEN
        RAISE EXCEPTION 'Ownership violation: Booking % does not belong to customer %', v_booking_public_id, p_customer_id;
    END IF;

    IF p_expected_current_status IS NOT NULL AND v_current_status != p_expected_current_status THEN
        RAISE EXCEPTION 'Concurrency conflict: Booking % status changed concurrently. Expected "%" but found "%". Reload and retry.',
            v_booking_public_id, p_expected_current_status, v_current_status;
    END IF;

    IF v_current_status NOT IN ('CONFIRMED', 'PREPARING') THEN
        RAISE EXCEPTION 'Cancellation rejected: Cannot request cancellation for booking % in status "%". Only CONFIRMED or PREPARING bookings can be cancelled by customer.',
            v_booking_public_id, v_current_status;
    END IF;

    UPDATE public.bookings
    SET status = 'CANCELLATION_REQUESTED', updated_at = NOW()
    WHERE id = p_booking_id AND tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 booking row updated, got %', v_rows_affected;
    END IF;

    INSERT INTO public.customer_cancellation_requests (
        tenant_id, booking_id, customer_id, previous_status, new_status, reason
    )
    VALUES (
        p_tenant_id, p_booking_id, p_customer_id, v_current_status, 'CANCELLATION_REQUESTED', trim(p_reason)
    );

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 cancellation log row inserted, got %', v_rows_affected;
    END IF;

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description, performed_by, performed_by_role, is_system_event, metadata
    )
    VALUES (
        p_tenant_id, p_booking_id, v_current_status, 'CANCELLATION_REQUESTED',
        'Customer Cancellation Requested',
        'Customer requested cancellation. Admin approval required. Reason: ' || trim(p_reason),
        p_customer_id, 'customer', FALSE,
        jsonb_build_object('reason', p_reason, 'customer_name', v_customer_name)
    );

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 timeline event row inserted, got %', v_rows_affected;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'booking_id', p_booking_id,
        'booking_public_id', v_booking_public_id,
        'previous_status', v_current_status,
        'new_status', 'CANCELLATION_REQUESTED',
        'message', 'Cancellation request submitted successfully. Awaiting admin approval.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.request_booking_cancellation_customer(UUID, UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_booking_cancellation_customer(UUID, UUID, TEXT, TEXT, UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. REVIEWS TABLE & SEQUENCES
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.reviews_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.reviews_public_id_seq TO postgres, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('REV', 'reviews_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NULL,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reviews_booking UNIQUE (tenant_id, booking_id)
);

COMMENT ON TABLE public.reviews IS 'Verified customer ratings and reviews tied to completed bookings.';

CREATE INDEX IF NOT EXISTS idx_reviews_booking ON public.reviews (tenant_id, booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_customer ON public.reviews (customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_published ON public.reviews (tenant_id, is_published, created_at DESC) WHERE is_deleted = FALSE;

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view published reviews"
    ON public.reviews FOR SELECT TO anon, authenticated
    USING (is_published = TRUE AND is_deleted = FALSE);

CREATE POLICY "Customers insert own reviews"
    ON public.reviews FOR INSERT TO authenticated
    WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Service role full access reviews"
    ON public.reviews FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- ----------------------------------------------------------------------------
-- 4. ATOMIC CUSTOMER REVIEW SUBMISSION RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_customer_review(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_customer_id UUID,
    p_rating INTEGER,
    p_comment TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_booking_status TEXT;
    v_booking_customer_id UUID;
    v_review_id UUID;
    v_review_public_id TEXT;
    v_caller_uid UUID;
BEGIN
    IF p_tenant_id IS NULL OR p_booking_id IS NULL OR p_customer_id IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID, Booking ID, and Customer ID must be non-null';
    END IF;

    IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Validation failed: Rating must be an integer between 1 and 5';
    END IF;

    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL OR v_caller_uid != p_customer_id THEN
        RAISE EXCEPTION 'Authorization failed: Session identity mismatch';
    END IF;

    SELECT status, customer_id INTO v_booking_status, v_booking_customer_id
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id;

    IF v_booking_status IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    IF v_booking_customer_id != p_customer_id THEN
        RAISE EXCEPTION 'Ownership violation: Booking does not belong to customer';
    END IF;

    IF v_booking_status != 'COMPLETED' THEN
        RAISE EXCEPTION 'Review rejected: Reviews can only be submitted for COMPLETED bookings';
    END IF;

    INSERT INTO public.reviews (tenant_id, booking_id, customer_id, rating, comment)
    VALUES (p_tenant_id, p_booking_id, p_customer_id, p_rating, NULLIF(trim(p_comment), ''))
    RETURNING id, public_id INTO v_review_id, v_review_public_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'review_id', v_review_id,
        'review_public_id', v_review_public_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.submit_customer_review(UUID, UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_customer_review(UUID, UUID, UUID, INTEGER, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. POSTGRESQL FINANCIAL REPORTING AGGREGATION RPC (SECURITY HARDENED)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_financial_report_admin(
    p_tenant_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_tenant_id UUID;
    v_has_staff_role BOOLEAN := FALSE;
    v_gross_revenue NUMERIC := 0;
    v_collected_revenue NUMERIC := 0;
    v_outstanding_balance NUMERIC := 0;
    v_refunded_amount NUMERIC := 0;
    v_reservation_deposits NUMERIC := 0;
    v_remaining_balances NUMERIC := 0;
    v_booking_count INTEGER := 0;
    v_average_booking_value NUMERIC := 0;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID must be non-null';
    END IF;

    -- Step 1: Resolve auth.uid()
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: No authenticated session found';
    END IF;

    -- Step 2 & 3: Resolve caller profile & verify tenant ownership
    SELECT tenant_id INTO v_caller_tenant_id
    FROM public.profiles
    WHERE id = v_caller_uid
      AND tenant_id = p_tenant_id
      AND is_active = TRUE
      AND is_deleted = FALSE;

    IF v_caller_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: Profile % is not an active member of tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Step 4: Verify staff administrative role
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_caller_uid
          AND ur.tenant_id = p_tenant_id
          AND r.name IN ('owner', 'super_admin', 'admin', 'support_staff', 'driver', 'franchise_owner')
    ) INTO v_has_staff_role;

    IF NOT v_has_staff_role THEN
        RAISE EXCEPTION 'Forbidden: User % does not possess administrative staff role for tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Step 5: Execute SQL reporting aggregation
    SELECT
        COALESCE(SUM(grand_total), 0),
        COALESCE(SUM(deposit_amount), 0),
        COALESCE(SUM(balance_amount), 0),
        COUNT(*)
    INTO
        v_gross_revenue,
        v_reservation_deposits,
        v_remaining_balances,
        v_booking_count
    FROM public.bookings
    WHERE tenant_id = p_tenant_id
      AND is_deleted = FALSE
      AND status NOT IN ('DRAFT', 'EXPIRED', 'REJECTED', 'CANCELLED', 'PAYMENT_FAILED');

    SELECT
        COALESCE(SUM(CASE WHEN status IN ('COMPLETED', 'SUCCESSFUL', 'PAID') THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN amount ELSE 0 END), 0)
    INTO
        v_collected_revenue,
        v_refunded_amount
    FROM public.payments
    WHERE tenant_id = p_tenant_id;

    v_outstanding_balance := GREATEST(0, v_gross_revenue - v_collected_revenue);

    IF v_booking_count > 0 THEN
        v_average_booking_value := ROUND(v_gross_revenue / v_booking_count, 2);
    END IF;

    RETURN jsonb_build_object(
        'gross_revenue', v_gross_revenue,
        'collected_revenue', v_collected_revenue,
        'outstanding_balance', v_outstanding_balance,
        'refunded_amount', v_refunded_amount,
        'reservation_deposits', v_reservation_deposits,
        'remaining_balances', v_remaining_balances,
        'booking_count', v_booking_count,
        'average_booking_value', v_average_booking_value
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_admin_financial_report_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_financial_report_admin(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. POSTGRESQL OPERATIONAL FUNNEL AGGREGATION RPC (SECURITY HARDENED)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_operational_funnel_admin(
    p_tenant_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_tenant_id UUID;
    v_has_staff_role BOOLEAN := FALSE;
    v_confirmed INTEGER := 0;
    v_preparing INTEGER := 0;
    v_delivery_assigned INTEGER := 0;
    v_out_for_delivery INTEGER := 0;
    v_rental_active INTEGER := 0;
    v_completed INTEGER := 0;
    v_cancelled INTEGER := 0;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID must be non-null';
    END IF;

    -- Step 1: Resolve auth.uid()
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: No authenticated session found';
    END IF;

    -- Step 2 & 3: Resolve caller profile & verify tenant ownership
    SELECT tenant_id INTO v_caller_tenant_id
    FROM public.profiles
    WHERE id = v_caller_uid
      AND tenant_id = p_tenant_id
      AND is_active = TRUE
      AND is_deleted = FALSE;

    IF v_caller_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: Profile % is not an active member of tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Step 4: Verify staff administrative role
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_caller_uid
          AND ur.tenant_id = p_tenant_id
          AND r.name IN ('owner', 'super_admin', 'admin', 'support_staff', 'driver', 'franchise_owner')
    ) INTO v_has_staff_role;

    IF NOT v_has_staff_role THEN
        RAISE EXCEPTION 'Forbidden: User % does not possess administrative staff role for tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Step 5: Execute SQL reporting aggregation
    SELECT
        COUNT(*) FILTER (WHERE status = 'CONFIRMED'),
        COUNT(*) FILTER (WHERE status = 'PREPARING'),
        COUNT(*) FILTER (WHERE status = 'DRIVER_ASSIGNED'),
        COUNT(*) FILTER (WHERE status = 'OUT_FOR_DELIVERY'),
        COUNT(*) FILTER (WHERE status = 'RENTAL_ACTIVE'),
        COUNT(*) FILTER (WHERE status = 'COMPLETED'),
        COUNT(*) FILTER (WHERE status = 'CANCELLED')
    INTO
        v_confirmed,
        v_preparing,
        v_delivery_assigned,
        v_out_for_delivery,
        v_rental_active,
        v_completed,
        v_cancelled
    FROM public.bookings
    WHERE tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'confirmed', v_confirmed,
        'preparing', v_preparing,
        'delivery_assigned', v_delivery_assigned,
        'out_for_delivery', v_out_for_delivery,
        'rental_active', v_rental_active,
        'completed', v_completed,
        'cancelled', v_cancelled
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_admin_operational_funnel_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_operational_funnel_admin(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. POSTGRESQL PACKAGE UTILIZATION AGGREGATION RPC (SECURITY HARDENED)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_package_utilization_admin(
    p_tenant_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_tenant_id UUID;
    v_has_staff_role BOOLEAN := FALSE;
    v_result JSONB;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID must be non-null';
    END IF;

    -- Step 1: Resolve auth.uid()
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: No authenticated session found';
    END IF;

    -- Step 2 & 3: Resolve caller profile & verify tenant ownership
    SELECT tenant_id INTO v_caller_tenant_id
    FROM public.profiles
    WHERE id = v_caller_uid
      AND tenant_id = p_tenant_id
      AND is_active = TRUE
      AND is_deleted = FALSE;

    IF v_caller_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: Profile % is not an active member of tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Step 4: Verify staff administrative role
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_caller_uid
          AND ur.tenant_id = p_tenant_id
          AND r.name IN ('owner', 'super_admin', 'admin', 'support_staff', 'driver', 'franchise_owner')
    ) INTO v_has_staff_role;

    IF NOT v_has_staff_role THEN
        RAISE EXCEPTION 'Forbidden: User % does not possess administrative staff role for tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Step 5: Execute SQL reporting aggregation
    SELECT jsonb_agg(pkg_summary ORDER BY utilization_percentage DESC)
    INTO v_result
    FROM (
        SELECT
            p.id AS package_id,
            p.name AS package_name,
            p.slug AS package_slug,
            COUNT(b.id) AS total_bookings,
            COALESCE(SUM(GREATEST(1, CEIL(b.duration_hours::numeric / 24.0))), 0)::INTEGER AS total_rental_days,
            LEAST(100, ROUND((COALESCE(SUM(GREATEST(1, CEIL(b.duration_hours::numeric / 24.0))), 0) / 30.0) * 100))::INTEGER AS utilization_percentage,
            COALESCE(SUM(b.grand_total), 0)::NUMERIC AS revenue_generated
        FROM public.packages p
        LEFT JOIN public.bookings b
            ON b.package_id = p.id
           AND b.tenant_id = p_tenant_id
           AND b.status NOT IN ('DRAFT', 'EXPIRED', 'REJECTED', 'CANCELLED', 'PAYMENT_FAILED')
        WHERE p.tenant_id = p_tenant_id
          AND p.is_deleted = FALSE
        GROUP BY p.id, p.name, p.slug
    ) pkg_summary;

    RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_admin_package_utilization_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_package_utilization_admin(UUID) TO authenticated, service_role;
