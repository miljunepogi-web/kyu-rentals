-- Keep admin payment timeline amounts readable at zero and above one million.
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
        'Payment Recorded: PHP ' || TO_CHAR(p_amount, 'FM999,999,990.00') || ' (' || p_payment_method || ')',
        'Collected by ' || COALESCE(NULLIF(TRIM(p_operator_name), ''), 'Staff Admin')
            || '. Remaining balance: PHP ' || TO_CHAR(v_new_balance, 'FM999,999,990.00'),
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

REVOKE EXECUTE ON FUNCTION public.record_admin_payment_atomic(
    UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_admin_payment_atomic(
    UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, UUID, TEXT
) TO authenticated, service_role;
