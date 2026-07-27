-- ============================================================================
-- KYU RENTALS — MIGRATION 00012: HARDEN ADMIN STATUS TRANSITION RPC
-- Version: 1.0.0
-- Date: 2026-07-23
-- Purpose:
--   1. Revoke public/anon execute on transition_booking_status_admin.
--   2. Grant execute only to authenticated and service_role.
--   3. Replace function with hardened version that:
--      - Validates the calling auth.uid() matches p_admin_profile_id (no forged IDs).
--      - Validates that the caller has an authorised admin role (admin, super_admin,
--        franchise_owner, support_staff) within the same tenant.
--      - Asserts ROW_COUNT after the timeline INSERT as well as after the UPDATE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REVOKE EXECUTE FROM PUBLIC / ANON
-- ----------------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.transition_booking_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.transition_booking_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT
) FROM anon;

-- ----------------------------------------------------------------------------
-- 2. GRANT EXECUTE TO AUTHORISED POSTGRES ROLES ONLY
-- ----------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION public.transition_booking_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT
) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. DROP & RECREATE HARDENED FUNCTION
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.transition_booking_status_admin(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_expected_current_status TEXT,
    p_target_status TEXT,
    p_admin_profile_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_current_status TEXT;
    v_booking_public_id TEXT;
    v_is_valid_transition BOOLEAN := FALSE;
    v_rows_affected INTEGER;
    v_caller_uid UUID;
    v_caller_role_name TEXT;
    v_caller_tenant_id UUID;
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. DEFENSIVE ASSERTIONS
    -- ------------------------------------------------------------------------
    IF p_tenant_id IS NULL OR p_booking_id IS NULL THEN
        RAISE EXCEPTION 'Defensive validation failed: Tenant ID and Booking ID must be non-null';
    END IF;

    IF p_target_status IS NULL OR length(trim(p_target_status)) = 0 THEN
        RAISE EXCEPTION 'Defensive validation failed: Target status must be a non-empty string';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
        RAISE EXCEPTION 'Defensive validation failed: Administrative transition reason must be at least 3 characters long';
    END IF;

    IF p_admin_profile_id IS NULL THEN
        RAISE EXCEPTION 'Defensive validation failed: Admin profile ID must be non-null';
    END IF;

    -- ------------------------------------------------------------------------
    -- 2. CALLER IDENTITY VERIFICATION
    --    Verify the authenticated session user matches the supplied admin profile ID.
    --    This prevents forged admin_profile_id values from poisoning the audit trail.
    -- ------------------------------------------------------------------------
    v_caller_uid := auth.uid();

    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: No authenticated session found. Unauthenticated callers cannot execute admin transitions.';
    END IF;

    IF v_caller_uid != p_admin_profile_id THEN
        RAISE EXCEPTION 'Authorization failed: Supplied admin_profile_id does not match the authenticated session user. Forged identity rejected.';
    END IF;

    -- ------------------------------------------------------------------------
    -- 3. ROLE & TENANT AUTHORIZATION CHECK
    --    Verify the caller holds an authorised administrative role within the
    --    target tenant. Allowed roles: admin, super_admin, franchise_owner, support_staff.
    -- ------------------------------------------------------------------------
    SELECT r.name, ur.tenant_id
    INTO v_caller_role_name, v_caller_tenant_id
    FROM public.user_roles ur
    INNER JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_caller_uid
      AND ur.tenant_id = p_tenant_id
      AND r.name IN ('admin', 'super_admin', 'franchise_owner', 'support_staff')
    LIMIT 1;

    IF v_caller_role_name IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: User % does not hold an administrative role in tenant %',
            v_caller_uid, p_tenant_id;
    END IF;

    -- Confirm tenant membership isolation
    IF v_caller_tenant_id != p_tenant_id THEN
        RAISE EXCEPTION 'Tenant isolation violation: Caller tenant % does not match target tenant %',
            v_caller_tenant_id, p_tenant_id;
    END IF;

    -- ------------------------------------------------------------------------
    -- 4. LOCK TARGET BOOKING ROW & VERIFY CURRENT STATUS
    -- ------------------------------------------------------------------------
    SELECT status, public_id
    INTO v_current_status, v_booking_public_id
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Target booking % not found for tenant %', p_booking_id, p_tenant_id;
    END IF;

    IF p_expected_current_status IS NOT NULL AND v_current_status != p_expected_current_status THEN
        RAISE EXCEPTION 'Concurrency conflict: Booking % status changed concurrently. Expected "%" but found "%". Reload and retry.',
            v_booking_public_id, p_expected_current_status, v_current_status;
    END IF;

    IF v_current_status = p_target_status THEN
        RETURN jsonb_build_object(
            'status', 'no_change',
            'booking_id', p_booking_id,
            'message', 'Booking is already in status ' || p_target_status
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- 5. STATE MACHINE VALIDATION MATRIX
    -- ------------------------------------------------------------------------
    v_is_valid_transition := CASE
        WHEN v_current_status = 'DRAFT' AND p_target_status IN ('PENDING_PAYMENT', 'CANCELLED') THEN TRUE
        WHEN v_current_status = 'PENDING_PAYMENT' AND p_target_status IN ('CONFIRMED', 'CANCELLED', 'EXPIRED', 'REJECTED', 'PAYMENT_FAILED') THEN TRUE
        WHEN v_current_status = 'CONFIRMED' AND p_target_status IN ('PREPARING', 'CANCELLED', 'REJECTED') THEN TRUE
        WHEN v_current_status = 'PREPARING' AND p_target_status IN ('DRIVER_ASSIGNED', 'CANCELLED') THEN TRUE
        WHEN v_current_status = 'DRIVER_ASSIGNED' AND p_target_status IN ('OUT_FOR_DELIVERY', 'CANCELLED') THEN TRUE
        WHEN v_current_status = 'OUT_FOR_DELIVERY' AND p_target_status IN ('DELIVERED', 'CANCELLED') THEN TRUE
        WHEN v_current_status = 'DELIVERED' AND p_target_status IN ('RENTAL_ACTIVE') THEN TRUE
        WHEN v_current_status = 'RENTAL_ACTIVE' AND p_target_status IN ('PICKUP_SCHEDULED') THEN TRUE
        WHEN v_current_status = 'PICKUP_SCHEDULED' AND p_target_status IN ('OUT_FOR_PICKUP') THEN TRUE
        WHEN v_current_status = 'OUT_FOR_PICKUP' AND p_target_status IN ('PICKED_UP') THEN TRUE
        WHEN v_current_status = 'PICKED_UP' AND p_target_status IN ('COMPLETED') THEN TRUE
        WHEN v_current_status = 'CANCELLATION_REQUESTED' AND p_target_status IN ('CANCELLED', 'CONFIRMED') THEN TRUE
        ELSE FALSE
    END;

    IF NOT v_is_valid_transition THEN
        RAISE EXCEPTION 'Illegal state machine transition: Cannot transition booking % from status "%" to "%"',
            v_booking_public_id, v_current_status, p_target_status;
    END IF;

    -- ------------------------------------------------------------------------
    -- 6. ATOMIC MUTATIONS — UPDATE BOOKING STATUS
    -- ------------------------------------------------------------------------
    UPDATE public.bookings
    SET status = p_target_status,
        updated_at = NOW()
    WHERE id = p_booking_id AND tenant_id = p_tenant_id AND is_deleted = FALSE;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 booking row updated, got %', v_rows_affected;
    END IF;

    -- ------------------------------------------------------------------------
    -- 7. ATOMIC MUTATIONS — INSERT AUDIT TIMELINE EVENT
    -- ------------------------------------------------------------------------
    INSERT INTO public.booking_timeline_events (
        tenant_id,
        booking_id,
        from_status,
        to_status,
        event_label,
        event_description,
        performed_by_role,
        performed_by,
        is_system_event,
        metadata
    )
    VALUES (
        p_tenant_id,
        p_booking_id,
        v_current_status,
        p_target_status,
        'Admin Status Transition: ' || v_current_status || ' → ' || p_target_status,
        p_reason,
        v_caller_role_name,
        p_admin_profile_id,
        FALSE,
        jsonb_build_object(
            'previousStatus', v_current_status,
            'newStatus', p_target_status,
            'reason', p_reason,
            'adminProfileId', p_admin_profile_id,
            'adminRole', v_caller_role_name,
            'callerUid', v_caller_uid
        )
    );

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 timeline event row inserted, got %', v_rows_affected;
    END IF;

    -- ------------------------------------------------------------------------
    -- 8. RETURN SUCCESS PAYLOAD
    -- ------------------------------------------------------------------------
    RETURN jsonb_build_object(
        'status', 'success',
        'booking_id', p_booking_id,
        'booking_public_id', v_booking_public_id,
        'previous_status', v_current_status,
        'new_status', p_target_status,
        'executed_by_role', v_caller_role_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.transition_booking_status_admin IS
  'Hardened atomic admin status transition RPC. Validates caller identity against auth.uid(), '
  'enforces role authorization, enforces tenant isolation, and audits every mutation with ROW_COUNT assertions.';
