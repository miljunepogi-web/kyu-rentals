-- ============================================================================
-- KYU RENTALS — MIGRATION 00019: SPRINT 8 ATOMIC TRANSACTIONS
-- Version: 1.0.0
-- Date: 2026-07-26
-- Purpose:
--   1. Create record_admin_payment_atomic() PostgreSQL RPC.
--      Atomically inserts payment record, updates booking balance/status,
--      and appends timeline event with row lock (SELECT FOR UPDATE).
--   2. Create assign_inventory_unit_atomic() PostgreSQL RPC.
--      Atomically locks unit & booking, verifies READY_TO_DEPLOY status,
--      updates unit to IN_USE, frees old unit, and updates booking assignment.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ATOMIC PAYMENT RECORDING RPC
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
    -- Defensive assertions
    IF p_tenant_id IS NULL OR p_booking_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ID and Booking ID are required.';
    END IF;
    IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000000 THEN
        RAISE EXCEPTION 'Payment amount must be greater than 0 and under 1,000,000.';
    END IF;

    -- Lock booking row FOR UPDATE to prevent balance race conditions
    SELECT balance_amount, deposit_amount, status, public_id
    INTO v_current_balance, v_deposit_amount, v_current_status, v_booking_public_id
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id AND is_deleted = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target booking not found or has been deleted.';
    END IF;

    v_current_balance := COALESCE(v_current_balance, 0);
    IF p_amount > v_current_balance AND p_payment_type = 'BALANCE_SETTLEMENT' THEN
        RAISE EXCEPTION 'Payment amount (₱%) exceeds remaining balance due (₱%).', p_amount, v_current_balance;
    END IF;

    v_new_balance := GREATEST(0, v_current_balance - p_amount);
    v_new_status := v_current_status;

    -- Advance PENDING_PAYMENT to CONFIRMED if deposit requirement satisfied
    IF v_current_status = 'PENDING_PAYMENT' AND p_amount >= COALESCE(v_deposit_amount, 0) THEN
        v_new_status := 'CONFIRMED';
    END IF;

    v_payment_public_id := 'PAY-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8));

    -- Insert Payment Record
    INSERT INTO public.payments (
        tenant_id,
        booking_id,
        public_id,
        payment_type,
        payment_method,
        gateway_provider,
        gateway_transaction_id,
        amount,
        currency,
        status,
        created_at
    ) VALUES (
        p_tenant_id,
        p_booking_id,
        v_payment_public_id,
        p_payment_type,
        p_payment_method,
        'MANUAL',
        NULLIF(TRIM(p_reference_number), ''),
        p_amount,
        'PHP',
        'SUCCESSFUL',
        NOW()
    ) RETURNING id INTO v_payment_id;

    -- Update Booking Record
    UPDATE public.bookings
    SET balance_amount = v_new_balance,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_booking_id AND tenant_id = p_tenant_id;

    -- Insert Timeline Event
    INSERT INTO public.booking_timeline_events (
        tenant_id,
        booking_id,
        from_status,
        to_status,
        event_label,
        event_description,
        performed_by_role,
        is_system_event,
        created_at
    ) VALUES (
        p_tenant_id,
        p_booking_id,
        v_current_status,
        v_new_status,
        'Payment Recorded: ₱' || TRIM(TO_CHAR(p_amount, '999,999,999.00')) || ' (' || p_payment_method || ')',
        'Collected by ' || p_operator_name || '. Ref: ' || COALESCE(NULLIF(TRIM(p_reference_number), ''), 'Cash') || '. Remaining balance: ₱' || TRIM(TO_CHAR(v_new_balance, '999,999,999.00')),
        'admin',
        FALSE,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'payment_id', v_payment_id,
        'new_balance', v_new_balance,
        'is_fully_paid', (v_new_balance = 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 2. ATOMIC INVENTORY ASSIGNMENT RPC
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
    IF p_tenant_id IS NULL OR p_booking_id IS NULL THEN
        RAISE EXCEPTION 'Tenant ID and Booking ID are required.';
    END IF;

    -- Lock booking row FOR UPDATE
    SELECT assigned_unit_id
    INTO v_old_unit_id
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id AND is_deleted = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target booking not found.';
    END IF;

    -- If assigning a new unit, lock unit row FOR UPDATE and verify status
    IF p_unit_id IS NOT NULL THEN
        SELECT status, serial_number
        INTO v_unit_status, v_serial_number
        FROM public.inventory_units
        WHERE id = p_unit_id AND tenant_id = p_tenant_id AND is_deleted = FALSE
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Target inventory unit not found.';
        END IF;

        IF v_unit_status != 'READY_TO_DEPLOY' AND p_unit_id != COALESCE(v_old_unit_id, '00000000-0000-0000-0000-000000000000'::UUID) THEN
            RAISE EXCEPTION 'Unit % is currently % and cannot be assigned.', v_serial_number, v_unit_status;
        END IF;

        -- Set new unit status to IN_USE
        UPDATE public.inventory_units
        SET status = 'IN_USE', updated_at = NOW()
        WHERE id = p_unit_id AND tenant_id = p_tenant_id;
    END IF;

    -- If unassigning or replacing an old unit, free the old unit back to READY_TO_DEPLOY
    IF v_old_unit_id IS NOT NULL AND (p_unit_id IS NULL OR v_old_unit_id != p_unit_id) THEN
        UPDATE public.inventory_units
        SET status = 'READY_TO_DEPLOY', updated_at = NOW()
        WHERE id = v_old_unit_id AND tenant_id = p_tenant_id;
    END IF;

    -- Update booking assigned_unit_id
    UPDATE public.bookings
    SET assigned_unit_id = p_unit_id, updated_at = NOW()
    WHERE id = p_booking_id AND tenant_id = p_tenant_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'unit_serial', v_serial_number
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
