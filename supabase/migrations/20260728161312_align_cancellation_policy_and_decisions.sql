-- Align cancellation decisions with the published non-refundable deposit policy.

UPDATE public.settings
SET namespace = 'policy_archive',
    label = 'Deprecated: ' || label,
    description = 'Archived because KYU Rentals uses a non-refundable customer cancellation deposit policy.',
    is_public = FALSE,
    updated_at = NOW()
WHERE namespace = 'policy'
  AND key IN (
    'cancellation_window_full_refund_hrs',
    'cancellation_window_partial_refund_hrs',
    'partial_refund_pct'
  );

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
    v_caller_uid UUID := auth.uid();
    v_current_status TEXT;
    v_booking_public_id TEXT;
    v_is_valid_transition BOOLEAN := FALSE;
    v_rows_affected INTEGER;
    v_event_label TEXT;
BEGIN
    IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authorization failed: No authenticated session found';
        END IF;

        IF p_admin_profile_id IS NULL OR p_admin_profile_id != v_caller_uid THEN
            RAISE EXCEPTION 'Authorization failed: Supplied admin profile does not match authenticated session';
        END IF;

        IF NOT public.has_permission('bookings.manage', p_tenant_id) THEN
            RAISE EXCEPTION 'Authorization failed: bookings.manage permission is required';
        END IF;
    END IF;

    IF p_tenant_id IS NULL OR p_booking_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ID and Booking ID must be non-null';
    END IF;

    IF p_target_status IS NULL OR LENGTH(TRIM(p_target_status)) = 0 THEN
        RAISE EXCEPTION 'Target status must be a non-empty string';
    END IF;

    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) < 3 THEN
        RAISE EXCEPTION 'Administrative transition reason must be at least 3 characters long';
    END IF;

    SELECT status, public_id
    INTO v_current_status, v_booking_public_id
    FROM public.bookings
    WHERE id = p_booking_id
      AND tenant_id = p_tenant_id
      AND is_deleted = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target booking not found';
    END IF;

    IF p_expected_current_status IS NOT NULL
       AND v_current_status != p_expected_current_status THEN
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
        WHEN v_current_status = 'DELIVERED' AND p_target_status = 'RENTAL_ACTIVE' THEN TRUE
        WHEN v_current_status = 'RENTAL_ACTIVE' AND p_target_status = 'PICKUP_SCHEDULED' THEN TRUE
        WHEN v_current_status = 'PICKUP_SCHEDULED' AND p_target_status = 'OUT_FOR_PICKUP' THEN TRUE
        WHEN v_current_status = 'OUT_FOR_PICKUP' AND p_target_status = 'PICKED_UP' THEN TRUE
        WHEN v_current_status = 'PICKED_UP' AND p_target_status = 'COMPLETED' THEN TRUE
        WHEN v_current_status = 'CANCELLATION_REQUESTED' AND p_target_status IN ('CANCELLED', 'CONFIRMED') THEN TRUE
        ELSE FALSE
    END;

    IF NOT v_is_valid_transition THEN
        RAISE EXCEPTION 'Illegal state machine transition: Cannot transition booking % from status "%" to "%"',
            v_booking_public_id, v_current_status, p_target_status;
    END IF;

    IF v_current_status = 'CANCELLATION_REQUESTED' THEN
        UPDATE public.customer_cancellation_requests
        SET processed_by = p_admin_profile_id,
            processed_at = NOW(),
            decision = CASE
                WHEN p_target_status = 'CANCELLED' THEN 'APPROVED'
                ELSE 'DECLINED'
            END,
            decision_notes = TRIM(p_reason)
        WHERE id = (
            SELECT id
            FROM public.customer_cancellation_requests
            WHERE tenant_id = p_tenant_id
              AND booking_id = p_booking_id
              AND processed_at IS NULL
            ORDER BY created_at DESC
            LIMIT 1
            FOR UPDATE
        );

        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        IF v_rows_affected != 1 THEN
            RAISE EXCEPTION 'Cancellation decision audit failed: Expected one pending request, got %',
                v_rows_affected;
        END IF;
    END IF;

    UPDATE public.bookings
    SET status = p_target_status,
        updated_at = NOW()
    WHERE id = p_booking_id
      AND tenant_id = p_tenant_id
      AND is_deleted = FALSE;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Expected exactly 1 booking row updated, got %', v_rows_affected;
    END IF;

    v_event_label := CASE
        WHEN v_current_status = 'CANCELLATION_REQUESTED' AND p_target_status = 'CANCELLED'
            THEN 'Cancellation Approved'
        WHEN v_current_status = 'CANCELLATION_REQUESTED' AND p_target_status = 'CONFIRMED'
            THEN 'Cancellation Declined'
        ELSE 'Admin Status Transition: ' || p_target_status
    END;

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description,
        performed_by_role, performed_by, is_system_event, metadata
    ) VALUES (
        p_tenant_id, p_booking_id, v_current_status, p_target_status,
        v_event_label, TRIM(p_reason), 'admin', p_admin_profile_id, FALSE,
        jsonb_build_object(
            'previousStatus', v_current_status,
            'newStatus', p_target_status,
            'reason', TRIM(p_reason)
        )
    );

    PERFORM public.log_audit_event(
        p_tenant_id, 'BOOKING_STATUS_TRANSITION', 'BOOKING', 'bookings',
        p_booking_id, v_booking_public_id, p_admin_profile_id, 'admin', 'info',
        jsonb_build_object(
            'previous_status', v_current_status,
            'new_status', p_target_status,
            'reason', TRIM(p_reason)
        )
    );

    RETURN jsonb_build_object(
        'status', 'success',
        'booking_id', p_booking_id,
        'booking_public_id', v_booking_public_id,
        'previous_status', v_current_status,
        'new_status', p_target_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.transition_booking_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.transition_booking_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT
) TO authenticated, service_role;
