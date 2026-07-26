-- ============================================================================
-- KYU RENTALS - PAYMONGO WEBHOOK CHECKOUT COMPLETION
-- Date: 2026-07-27
-- Purpose:
--   Ensure PayMongo checkout webhooks update the existing pending payment row
--   created during checkout initialization and confirm the booking atomically.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.paymongo_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    booking_id UUID NULL REFERENCES public.bookings(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id AND is_deleted = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target booking not found for webhook processing.';
    END IF;

    IF v_booking.status = 'CONFIRMED' THEN
        RETURN jsonb_build_object('success', TRUE, 'duplicate', TRUE, 'booking_id', v_booking.id, 'new_status', 'CONFIRMED');
    END IF;

    IF v_booking.status != 'PENDING_PAYMENT' THEN
        RAISE EXCEPTION 'Disallowed booking state transition from status %', v_booking.status;
    END IF;

    UPDATE public.payments
    SET payment_type = 'RESERVATION_DEPOSIT',
        payment_method = COALESCE(p_payment_method, 'PAYMONGO_CHECKOUT'),
        gateway_provider = 'PAYMONGO',
        gateway_transaction_id = p_payment_intent_id,
        amount = p_amount_paid,
        currency = 'PHP',
        status = 'PAID',
        updated_at = NOW()
    WHERE booking_id = v_booking.id
      AND tenant_id = v_booking.tenant_id
      AND status = 'PENDING'
      AND gateway_provider = 'PAYMONGO'
    RETURNING id INTO v_payment_id;

    IF v_payment_id IS NULL THEN
        INSERT INTO public.payments (
            tenant_id, booking_id, public_id, payment_type, payment_method, gateway_provider,
            gateway_transaction_id, amount, currency, status, created_at
        ) VALUES (
            v_booking.tenant_id, v_booking.id,
            'PAY-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8)),
            'RESERVATION_DEPOSIT',
            COALESCE(p_payment_method, 'PAYMONGO_CHECKOUT'),
            'PAYMONGO',
            p_payment_intent_id,
            p_amount_paid,
            'PHP',
            'PAID',
            NOW()
        ) RETURNING id INTO v_payment_id;
    END IF;

    v_new_balance := GREATEST(0, v_booking.balance_amount - p_amount_paid);

    UPDATE public.bookings
    SET status = 'CONFIRMED',
        balance_amount = v_new_balance,
        updated_at = NOW()
    WHERE id = v_booking.id;

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description, performed_by_role, is_system_event, created_at
    ) VALUES (
        v_booking.tenant_id, v_booking.id, v_booking.status, 'CONFIRMED', 'Deposit Payment Confirmed via PayMongo',
        'Received PHP ' || TRIM(TO_CHAR(p_amount_paid, '999,999.00')) || ' via ' || COALESCE(p_payment_method, 'PayMongo') || '. Ref: ' || p_payment_intent_id,
        'system', TRUE, NOW()
    );

    PERFORM public.log_audit_event(
        v_booking.tenant_id, 'PAYMONGO_WEBHOOK_PROCESSED', 'PAYMENT', 'payments', v_payment_id, p_event_id,
        NULL, 'system', 'info',
        jsonb_build_object('booking_id', v_booking.id, 'amount_paid', p_amount_paid, 'new_balance', v_new_balance)
    );

    RETURN jsonb_build_object('success', TRUE, 'booking_id', v_booking.id, 'new_status', 'CONFIRMED', 'payment_id', v_payment_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
