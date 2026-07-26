-- ============================================================================
-- KYU RENTALS — MIGRATION 00020: AUDIT LOGGING ATOMIC INTEGRATION
-- Version: 1.0.0
-- Date: 2026-07-27
-- Purpose:
--   1. Create public.log_audit_event() reusable PostgreSQL RPC.
--   2. Update all critical mutation RPCs (create_booking_atomic,
--      process_paymongo_webhook_atomic, transition_booking_status_admin,
--      record_admin_payment_atomic, assign_inventory_unit_atomic) to emit
--      atomic audit log writes to public.audit_logs within the transaction.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. REUSABLE AUDIT LOG WRITER RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_audit_event(
    p_tenant_id UUID,
    p_action TEXT,
    p_category TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_entity_label TEXT DEFAULT NULL,
    p_performed_by UUID DEFAULT NULL,
    p_performed_by_role TEXT DEFAULT 'system',
    p_severity TEXT DEFAULT 'info',
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ID is required for audit logging.';
    END IF;

    INSERT INTO public.audit_logs (
        tenant_id,
        performed_by,
        performed_by_role,
        action,
        category,
        entity_type,
        entity_id,
        entity_label,
        severity,
        metadata,
        created_source,
        created_at
    ) VALUES (
        p_tenant_id,
        p_performed_by,
        COALESCE(p_performed_by_role, 'system'),
        p_action,
        p_category,
        p_entity_type,
        p_entity_id,
        p_entity_label,
        COALESCE(p_severity, 'info'),
        COALESCE(p_metadata, '{}'::jsonb),
        'WEB'::public.created_source_type,
        NOW()
    ) RETURNING id INTO v_audit_id;

    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. AUDIT-ENABLED BOOKING CREATION RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_booking_atomic(
    p_tenant_id UUID,
    p_customer_id UUID,
    p_package_id UUID,
    p_event_date DATE,
    p_start_time TIME,
    p_duration_hours INTEGER,
    p_venue_address TEXT,
    p_delivery_zone TEXT,
    p_addons JSONB DEFAULT '[]'::jsonb,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_base_4h NUMERIC;
    v_base_8h NUMERIC;
    v_base_full NUMERIC;
    v_base_price NUMERIC;
    v_addons_subtotal NUMERIC := 0;
    v_subtotal NUMERIC;
    v_weekend_surcharge NUMERIC := 0;
    v_delivery_fee NUMERIC := 250;
    v_grand_total NUMERIC;
    v_deposit_amount NUMERIC;
    v_balance_amount NUMERIC;
    v_public_id TEXT;
    v_booking_id UUID;
    v_addon_elem JSONB;
    v_addon_price NUMERIC;
    v_addon_qty INTEGER;
BEGIN
    IF p_tenant_id IS NULL OR p_customer_id IS NULL OR p_package_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ID, Customer ID, and Package ID are required.';
    END IF;

    SELECT price_4h, price_8h, price_full_day
    INTO v_base_4h, v_base_8h, v_base_full
    FROM public.packages
    WHERE id = p_package_id AND tenant_id = p_tenant_id AND is_active = TRUE AND is_deleted = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Selected package is not active or available.';
    END IF;

    IF p_duration_hours = 4 THEN v_base_price := v_base_4h;
    ELSIF p_duration_hours = 8 THEN v_base_price := v_base_8h;
    ELSE v_base_price := v_base_full;
    END IF;

    IF p_addons IS NOT NULL AND jsonb_array_length(p_addons) > 0 THEN
        FOR v_addon_elem IN SELECT * FROM jsonb_array_elements(p_addons) LOOP
            v_addon_price := COALESCE((v_addon_elem->>'unit_price')::NUMERIC, 0);
            v_addon_qty := COALESCE((v_addon_elem->>'quantity')::INTEGER, 1);
            v_addons_subtotal := v_addons_subtotal + (v_addon_price * v_addon_qty);
        END LOOP;
    END IF;

    v_subtotal := v_base_price + v_addons_subtotal;

    IF EXTRACT(DOW FROM p_event_date) IN (0, 6) THEN
        v_weekend_surcharge := ROUND(v_subtotal * 0.10);
    END IF;

    IF LOWER(COALESCE(p_delivery_zone, '')) LIKE '%outside%' THEN
        v_delivery_fee := 500;
    END IF;

    v_grand_total := v_subtotal + v_weekend_surcharge + v_delivery_fee;
    v_deposit_amount := ROUND(v_grand_total * 0.30);
    v_balance_amount := v_grand_total - v_deposit_amount;

    v_public_id := 'KYU-' || TO_CHAR(p_event_date, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 4));

    INSERT INTO public.bookings (
        tenant_id, customer_id, package_id, public_id, status, event_date, start_time, duration_hours,
        venue_address, delivery_zone, addons, base_price, addons_subtotal, weekend_surcharge,
        delivery_fee, grand_total, deposit_amount, balance_amount, notes, created_at
    ) VALUES (
        p_tenant_id, p_customer_id, p_package_id, v_public_id, 'PENDING_PAYMENT', p_event_date, p_start_time, p_duration_hours,
        p_venue_address, p_delivery_zone, p_addons, v_base_price, v_addons_subtotal, v_weekend_surcharge,
        v_delivery_fee, v_grand_total, v_deposit_amount, v_balance_amount, p_notes, NOW()
    ) RETURNING id INTO v_booking_id;

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description, performed_by_role, is_system_event, created_at
    ) VALUES (
        p_tenant_id, v_booking_id, NULL, 'PENDING_PAYMENT', 'Booking Reservation Initialized',
        'Draft initialized. 30% deposit of ₱' || TRIM(TO_CHAR(v_deposit_amount, '999,999.00')) || ' required to confirm.',
        'customer', FALSE, NOW()
    );

    -- Emit Atomic Audit Log
    PERFORM public.log_audit_event(
        p_tenant_id, 'BOOKING_INITIALIZED', 'BOOKING', 'bookings', v_booking_id, v_public_id,
        p_customer_id, 'customer', 'info',
        jsonb_build_object('package_id', p_package_id, 'deposit_amount', v_deposit_amount, 'grand_total', v_grand_total)
    );

    RETURN jsonb_build_object(
        'success', TRUE, 'booking_id', v_booking_id, 'public_id', v_public_id,
        'grand_total', v_grand_total, 'deposit_amount', v_deposit_amount, 'balance_amount', v_balance_amount
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 3. AUDIT-ENABLED WEBHOOK PROCESSING RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_paymongo_webhook_atomic(
    p_event_id TEXT,
    p_event_type TEXT,
    p_booking_id UUID,
    p_payment_intent_id TEXT,
    p_amount_paid NUMERIC,
    p_payment_method TEXT,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
    v_booking RECORD;
    v_new_balance NUMERIC;
    v_payment_id UUID;
BEGIN
    INSERT INTO public.paymongo_webhook_logs (event_id, event_type, booking_id, payload, processed, created_at)
    VALUES (p_event_id, p_event_type, p_booking_id, p_raw_payload, TRUE, NOW())
    ON CONFLICT (event_id) DO NOTHING;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', TRUE, 'duplicate', TRUE, 'message', 'Webhook event already processed');
    END IF;

    SELECT id, tenant_id, public_id, status, deposit_amount, balance_amount, grand_total
    INTO v_booking FROM public.bookings WHERE id = p_booking_id AND is_deleted = FALSE FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target booking not found for webhook processing.';
    END IF;

    INSERT INTO public.payments (
        tenant_id, booking_id, public_id, payment_type, payment_method, gateway_provider,
        gateway_transaction_id, amount, currency, status, created_at
    ) VALUES (
        v_booking.tenant_id, v_booking.id,
        'PAY-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8)),
        CASE WHEN v_booking.status = 'PENDING_PAYMENT' THEN 'DEPOSIT' ELSE 'BALANCE_SETTLEMENT' END,
        COALESCE(p_payment_method, 'PAYMONGO_GCASH'), 'PAYMONGO', p_payment_intent_id, p_amount_paid, 'PHP', 'SUCCESSFUL', NOW()
    ) RETURNING id INTO v_payment_id;

    v_new_balance := GREATEST(0, v_booking.balance_amount - p_amount_paid);

    UPDATE public.bookings
    SET status = 'CONFIRMED', balance_amount = v_new_balance, updated_at = NOW()
    WHERE id = v_booking.id;

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description, performed_by_role, is_system_event, created_at
    ) VALUES (
        v_booking.tenant_id, v_booking.id, v_booking.status, 'CONFIRMED', 'Deposit Payment Confirmed via PayMongo',
        'Received ₱' || TRIM(TO_CHAR(p_amount_paid, '999,999.00')) || ' via ' || COALESCE(p_payment_method, 'PayMongo') || '. Ref: ' || p_payment_intent_id,
        'system', TRUE, NOW()
    );

    -- Emit Atomic Audit Log
    PERFORM public.log_audit_event(
        v_booking.tenant_id, 'PAYMONGO_WEBHOOK_PROCESSED', 'PAYMENT', 'payments', v_payment_id, p_event_id,
        NULL, 'system', 'info',
        jsonb_build_object('booking_id', v_booking.id, 'amount_paid', p_amount_paid, 'new_balance', v_new_balance)
    );

    RETURN jsonb_build_object('success', TRUE, 'booking_id', v_booking.id, 'new_status', 'CONFIRMED', 'payment_id', v_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. AUDIT-ENABLED PAYMENT RECORDING RPC
-- ----------------------------------------------------------------------------
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
    v_current_balance NUMERIC;
    v_deposit_amount NUMERIC;
    v_current_status TEXT;
    v_booking_public_id TEXT;
    v_new_balance NUMERIC;
    v_new_status TEXT;
    v_payment_id UUID;
    v_payment_public_id TEXT;
BEGIN
    SELECT balance_amount, deposit_amount, status, public_id
    INTO v_current_balance, v_deposit_amount, v_current_status, v_booking_public_id
    FROM public.bookings WHERE id = p_booking_id AND tenant_id = p_tenant_id AND is_deleted = FALSE FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Target booking not found.'; END IF;

    v_new_balance := GREATEST(0, COALESCE(v_current_balance, 0) - p_amount);
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
    ) RETURNING id INTO v_payment_id;

    UPDATE public.bookings SET balance_amount = v_new_balance, status = v_new_status, updated_at = NOW()
    WHERE id = p_booking_id AND tenant_id = p_tenant_id;

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description, performed_by_role, is_system_event, created_at
    ) VALUES (
        p_tenant_id, p_booking_id, v_current_status, v_new_status,
        'Payment Recorded: ₱' || TRIM(TO_CHAR(p_amount, '999,999.00')) || ' (' || p_payment_method || ')',
        'Collected by ' || p_operator_name || '. Remaining balance: ₱' || TRIM(TO_CHAR(v_new_balance, '999,999.00')),
        'admin', FALSE, NOW()
    );

    -- Emit Atomic Audit Log
    PERFORM public.log_audit_event(
        p_tenant_id, 'ADMIN_PAYMENT_COLLECTED', 'PAYMENT', 'payments', v_payment_id, v_payment_public_id,
        p_operator_id, 'admin', 'info',
        jsonb_build_object('booking_id', p_booking_id, 'amount', p_amount, 'new_balance', v_new_balance)
    );

    RETURN jsonb_build_object('success', TRUE, 'payment_id', v_payment_id, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 5. AUDIT-ENABLED INVENTORY ASSIGNMENT RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_inventory_unit_atomic(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_unit_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_old_unit_id UUID;
    v_unit_status TEXT;
    v_serial_number TEXT;
BEGIN
    SELECT assigned_unit_id INTO v_old_unit_id FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id AND is_deleted = FALSE FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Target booking not found.'; END IF;

    IF p_unit_id IS NOT NULL THEN
        SELECT status, serial_number INTO v_unit_status, v_serial_number FROM public.inventory_units
        WHERE id = p_unit_id AND tenant_id = p_tenant_id AND is_deleted = FALSE FOR UPDATE;

        IF NOT FOUND THEN RAISE EXCEPTION 'Target unit not found.'; END IF;
        UPDATE public.inventory_units SET status = 'IN_USE', updated_at = NOW() WHERE id = p_unit_id AND tenant_id = p_tenant_id;
    END IF;

    IF v_old_unit_id IS NOT NULL AND (p_unit_id IS NULL OR v_old_unit_id != p_unit_id) THEN
        UPDATE public.inventory_units SET status = 'READY_TO_DEPLOY', updated_at = NOW() WHERE id = v_old_unit_id AND tenant_id = p_tenant_id;
    END IF;

    UPDATE public.bookings SET assigned_unit_id = p_unit_id, updated_at = NOW() WHERE id = p_booking_id AND tenant_id = p_tenant_id;

    -- Emit Atomic Audit Log
    PERFORM public.log_audit_event(
        p_tenant_id, 'INVENTORY_UNIT_ASSIGNED', 'INVENTORY', 'bookings', p_booking_id, COALESCE(v_serial_number, 'UNASSIGNED'),
        NULL, 'admin', 'info',
        jsonb_build_object('old_unit_id', v_old_unit_id, 'new_unit_id', p_unit_id)
    );

    RETURN jsonb_build_object('success', TRUE, 'unit_serial', v_serial_number);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 6. AUDIT-ENABLED ADMIN BOOKING STATUS TRANSITION RPC
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
        tenant_id, booking_id, from_status, to_status, event_label, event_description, performed_by_role, performed_by_user_id, is_system_event, metadata
    ) VALUES (
        p_tenant_id, p_booking_id, v_current_status, p_target_status, 'Admin Status Transition: ' || p_target_status,
        p_reason, 'admin', p_admin_profile_id, FALSE, jsonb_build_object('previousStatus', v_current_status, 'newStatus', p_target_status, 'reason', p_reason)
    );

    -- Emit Atomic Audit Log to public.audit_logs
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
