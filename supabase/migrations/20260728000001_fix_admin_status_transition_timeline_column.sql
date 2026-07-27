-- ============================================================================
-- KYU RENTALS - FIX ADMIN STATUS TRANSITION TIMELINE COLUMN
-- Date: 2026-07-28
-- Purpose:
--   Fix transition_booking_status_admin() to write booking_timeline_events
--   using the real performed_by column instead of stale performed_by_user_id.
-- ============================================================================

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
BEGIN
    IF p_tenant_id IS NULL OR p_booking_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ID and Booking ID must be non-null';
    END IF;

    IF p_target_status IS NULL OR length(trim(p_target_status)) = 0 THEN
        RAISE EXCEPTION 'Target status must be a non-empty string';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
        RAISE EXCEPTION 'Administrative transition reason must be at least 3 characters long';
    END IF;

    SELECT status, public_id
    INTO v_current_status, v_booking_public_id
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Target booking not found';
    END IF;

    IF p_expected_current_status IS NOT NULL AND v_current_status != p_expected_current_status THEN
        RAISE EXCEPTION 'Concurrency error: Booking status changed concurrently from % to %',
            p_expected_current_status, v_current_status;
    END IF;

    IF v_current_status = p_target_status THEN
        RETURN jsonb_build_object(
            'status', 'no_change',
            'booking_id', p_booking_id,
            'message', 'Booking is already in status ' || p_target_status
        );
    END IF;

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

    UPDATE public.bookings
    SET status = p_target_status,
        updated_at = NOW()
    WHERE id = p_booking_id AND tenant_id = p_tenant_id AND is_deleted = FALSE;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Expected exactly 1 booking row updated, got %', v_rows_affected;
    END IF;

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description,
        performed_by_role, performed_by, is_system_event, metadata
    ) VALUES (
        p_tenant_id, p_booking_id, v_current_status, p_target_status,
        'Admin Status Transition: ' || p_target_status,
        p_reason, 'admin', p_admin_profile_id, FALSE,
        jsonb_build_object('previousStatus', v_current_status, 'newStatus', p_target_status, 'reason', p_reason)
    );

    PERFORM public.log_audit_event(
        p_tenant_id, 'BOOKING_STATUS_TRANSITION', 'BOOKING', 'bookings', p_booking_id, v_booking_public_id,
        p_admin_profile_id, 'admin', 'info',
        jsonb_build_object('previous_status', v_current_status, 'new_status', p_target_status, 'reason', p_reason)
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'booking_id', p_booking_id,
        'booking_public_id', v_booking_public_id,
        'previous_status', v_current_status,
        'new_status', p_target_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.transition_booking_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.transition_booking_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT
) TO authenticated, service_role;
