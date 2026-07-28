-- ============================================================================
-- KYU RENTALS - HARDEN CRITICAL ADMIN MUTATION RPCS
-- Date: 2026-07-28
-- Purpose:
--   Restore database-authoritative authorization and validation that was lost
--   when audit-enabled function definitions replaced earlier hardened RPCs.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_admin_payment_atomic(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_payment_type TEXT,
    p_payment_method TEXT,
    p_amount NUMERIC,
    p_reference_number TEXT DEFAULT NULL,
    p_operator_id UUID DEFAULT NULL,
    p_operator_name TEXT DEFAULT 'Staff Admin'
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID := auth.uid();
    v_current_balance NUMERIC;
    v_deposit_amount NUMERIC;
    v_current_status TEXT;
    v_booking_public_id TEXT;
    v_new_balance NUMERIC;
    v_new_status TEXT;
    v_payment_id UUID;
    v_payment_public_id TEXT;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        IF v_caller_uid IS NULL THEN
            RAISE EXCEPTION 'Authorization failed: No authenticated session found';
        END IF;

        IF p_operator_id IS NULL OR p_operator_id != v_caller_uid THEN
            RAISE EXCEPTION 'Authorization failed: Supplied operator does not match authenticated session';
        END IF;

        IF NOT public.has_permission('financials.manage', p_tenant_id) THEN
            RAISE EXCEPTION 'Authorization failed: financials.manage permission is required';
        END IF;
    END IF;

    IF p_tenant_id IS NULL OR p_booking_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ID and Booking ID are required';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
        RAISE EXCEPTION 'Payment amount must be greater than 0 and under 1,000,000';
    END IF;

    IF p_payment_type NOT IN ('BALANCE_SETTLEMENT', 'RESERVATION_DEPOSIT', 'FULL_PAYMENT', 'ADJUSTMENT') THEN
        RAISE EXCEPTION 'Unsupported payment type: %', p_payment_type;
    END IF;

    IF p_payment_method NOT IN ('CASH', 'GCASH', 'MAYA', 'BANK_TRANSFER', 'OTHER') THEN
        RAISE EXCEPTION 'Unsupported payment method: %', p_payment_method;
    END IF;

    SELECT balance_amount, deposit_amount, status, public_id
    INTO v_current_balance, v_deposit_amount, v_current_status, v_booking_public_id
    FROM public.bookings
    WHERE id = p_booking_id
      AND tenant_id = p_tenant_id
      AND is_deleted = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target booking not found';
    END IF;

    v_current_balance := COALESCE(v_current_balance, 0);

    IF p_payment_type = 'BALANCE_SETTLEMENT' AND p_amount > v_current_balance THEN
        RAISE EXCEPTION 'Payment amount exceeds remaining balance due';
    END IF;

    v_new_balance := GREATEST(0, v_current_balance - p_amount);
    v_new_status := v_current_status;

    IF v_current_status = 'PENDING_PAYMENT' AND p_amount >= COALESCE(v_deposit_amount, 0) THEN
        v_new_status := 'CONFIRMED';
    END IF;

    v_payment_public_id := 'PAY-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));

    INSERT INTO public.payments (
        tenant_id, booking_id, public_id, payment_type, payment_method, gateway_provider,
        gateway_transaction_id, amount, currency, status, created_at
    ) VALUES (
        p_tenant_id, p_booking_id, v_payment_public_id, p_payment_type, p_payment_method,
        'MANUAL', NULLIF(TRIM(p_reference_number), ''), p_amount, 'PHP', 'SUCCESSFUL', NOW()
    )
    RETURNING id INTO v_payment_id;

    UPDATE public.bookings
    SET balance_amount = v_new_balance,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_booking_id
      AND tenant_id = p_tenant_id;

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description,
        performed_by, performed_by_role, is_system_event, created_at
    ) VALUES (
        p_tenant_id, p_booking_id, v_current_status, v_new_status,
        'Payment Recorded: PHP ' || TRIM(TO_CHAR(p_amount, '999,999.00')) || ' (' || p_payment_method || ')',
        'Collected by ' || COALESCE(NULLIF(TRIM(p_operator_name), ''), 'Staff Admin')
            || '. Remaining balance: PHP ' || TRIM(TO_CHAR(v_new_balance, '999,999.00')),
        p_operator_id, 'admin', FALSE, NOW()
    );

    PERFORM public.log_audit_event(
        p_tenant_id, 'ADMIN_PAYMENT_COLLECTED', 'PAYMENT', 'payments', v_payment_id, v_payment_public_id,
        p_operator_id, 'admin', 'info',
        jsonb_build_object('booking_id', p_booking_id, 'amount', p_amount, 'new_balance', v_new_balance)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', v_payment_id,
        'new_balance', v_new_balance,
        'is_fully_paid', (v_new_balance = 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


CREATE OR REPLACE FUNCTION public.assign_inventory_unit_atomic(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_unit_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_old_unit_id UUID;
    v_booking_status TEXT;
    v_unit_status TEXT;
    v_serial_number TEXT;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Authorization failed: No authenticated session found';
        END IF;

        IF NOT public.has_permission('inventory.manage', p_tenant_id) THEN
            RAISE EXCEPTION 'Authorization failed: inventory.manage permission is required';
        END IF;
    END IF;

    IF p_tenant_id IS NULL OR p_booking_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ID and Booking ID are required';
    END IF;

    SELECT assigned_unit_id, status
    INTO v_old_unit_id, v_booking_status
    FROM public.bookings
    WHERE id = p_booking_id
      AND tenant_id = p_tenant_id
      AND is_deleted = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target booking not found';
    END IF;

    IF v_booking_status IN (
        'DRAFT', 'PENDING_PAYMENT', 'CANCELLED', 'REJECTED', 'EXPIRED',
        'PAYMENT_FAILED', 'REFUNDED', 'COMPLETED'
    ) THEN
        RAISE EXCEPTION 'Cannot assign inventory to booking in status %', v_booking_status;
    END IF;

    IF p_unit_id IS NOT NULL THEN
        SELECT status, serial_number
        INTO v_unit_status, v_serial_number
        FROM public.inventory_units
        WHERE id = p_unit_id
          AND tenant_id = p_tenant_id
          AND is_deleted = FALSE
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target inventory unit not found';
        END IF;

        IF v_unit_status != 'READY_TO_DEPLOY'
           AND p_unit_id != COALESCE(v_old_unit_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
            RAISE EXCEPTION 'Unit % is currently % and cannot be assigned', v_serial_number, v_unit_status;
        END IF;

        UPDATE public.inventory_units
        SET status = 'IN_USE',
            updated_at = NOW()
        WHERE id = p_unit_id
          AND tenant_id = p_tenant_id;
    END IF;

    IF v_old_unit_id IS NOT NULL
       AND (p_unit_id IS NULL OR v_old_unit_id != p_unit_id) THEN
        UPDATE public.inventory_units
        SET status = 'READY_TO_DEPLOY',
            updated_at = NOW()
        WHERE id = v_old_unit_id
          AND tenant_id = p_tenant_id;
    END IF;

    UPDATE public.bookings
    SET assigned_unit_id = p_unit_id,
        updated_at = NOW()
    WHERE id = p_booking_id
      AND tenant_id = p_tenant_id;

    PERFORM public.log_audit_event(
        p_tenant_id, 'INVENTORY_UNIT_ASSIGNED', 'INVENTORY', 'bookings', p_booking_id,
        COALESCE(v_serial_number, 'UNASSIGNED'), auth.uid(), 'admin', 'info',
        jsonb_build_object('old_unit_id', v_old_unit_id, 'new_unit_id', p_unit_id)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'unit_serial', v_serial_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


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
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
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


REVOKE EXECUTE ON FUNCTION public.record_admin_payment_atomic(
    UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT
) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_inventory_unit_atomic(
    UUID, UUID, UUID
) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.transition_booking_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_admin_payment_atomic(
    UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_inventory_unit_atomic(
    UUID, UUID, UUID
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transition_booking_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT
) TO authenticated, service_role;
