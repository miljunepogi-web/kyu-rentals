-- ============================================================================
-- KYU RENTALS — MIGRATION 00009: ATOMIC WEBHOOK PROCESSING RPC FUNCTION
-- Version: 1.5.0 (GLOBAL CANONICAL NAMING: p_gateway_transaction_id)
-- Date: 2026-07-24
-- Purpose: Enterprise hardened atomic PostgreSQL transaction function for
--          PayMongo webhook verification. Uses ON CONFLICT (event_id) to match
--          the UNIQUE(event_id) constraint defined in public.webhook_inbox schema.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.process_paymongo_webhook_atomic(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_event_id TEXT,
    p_event_type TEXT,
    p_gateway_transaction_id TEXT,
    p_paid_amount_centavos NUMERIC,
    p_expected_deposit_centavos NUMERIC,
    p_paid_at TIMESTAMPTZ,
    p_raw_payload JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_booking_status TEXT;
    v_booking_public_id TEXT;
    v_deposit_amount NUMERIC;
    v_expected_deposit_centavos NUMERIC;
    v_rows_affected INTEGER;
BEGIN
    -- 1. DEFENSIVE VALIDATION (Fail-Fast Identity & Input Assertions)
    IF p_tenant_id IS NULL OR p_booking_id IS NULL THEN
        RAISE EXCEPTION 'Defensive validation failed: Tenant ID and Booking ID must be non-null';
    END IF;

    IF p_event_id IS NULL OR length(trim(p_event_id)) = 0 THEN
        RAISE EXCEPTION 'Defensive validation failed: Webhook event_id must be non-empty string';
    END IF;

    IF p_event_type IS NULL OR length(trim(p_event_type)) = 0 THEN
        RAISE EXCEPTION 'Defensive validation failed: Webhook event_type must be non-empty string';
    END IF;

    IF p_paid_amount_centavos <= 0 OR p_expected_deposit_centavos <= 0 THEN
        RAISE EXCEPTION 'Defensive validation failed: Paid centavos (%) and deposit centavos (%) must be positive',
            p_paid_amount_centavos, p_expected_deposit_centavos;
    END IF;

    IF p_gateway_transaction_id IS NULL OR length(trim(p_gateway_transaction_id)) = 0 THEN
        RAISE EXCEPTION 'Defensive validation failed: PayMongo gateway transaction ID is required';
    END IF;

    -- 2. IDEMPOTENCY CHECK (Webhook Inbox)
    IF EXISTS (
        SELECT 1 FROM public.webhook_inbox
        WHERE provider = 'paymongo' AND event_id = p_event_id AND status = 'processed'
    ) THEN
        RETURN jsonb_build_object(
            'status', 'duplicate',
            'message', 'Webhook event already processed successfully'
        );
    END IF;

    -- 3. EXCLUSIVE BOOKING LOCK & DATABASE AUTHORITATIVE RETRIEVAL
    SELECT status, public_id, deposit_amount
    INTO v_booking_status, v_booking_public_id, v_deposit_amount
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_booking_status IS NULL THEN
        RAISE EXCEPTION 'Target booking % not found for tenant %', p_booking_id, p_tenant_id;
    END IF;

    IF v_deposit_amount IS NULL OR v_deposit_amount <= 0 THEN
        RAISE EXCEPTION 'Corrupted booking data detected: deposit_amount must be a positive numeric value for booking %', p_booking_id;
    END IF;

    -- Idempotent check on existing confirmed booking
    IF v_booking_status = 'CONFIRMED' THEN
        INSERT INTO public.webhook_inbox (tenant_id, provider, event_id, event_type, payload, status, processed_at)
        VALUES (p_tenant_id, 'paymongo', p_event_id, p_event_type, p_raw_payload, 'processed', NOW())
        ON CONFLICT (event_id) DO UPDATE
        SET status = 'processed',
            processed_at = NOW()
        WHERE webhook_inbox.status != 'processed';

        RETURN jsonb_build_object(
            'status', 'already_confirmed',
            'booking_id', p_booking_id
        );
    END IF;

    IF v_booking_status != 'PENDING_PAYMENT' THEN
        RAISE EXCEPTION 'Disallowed booking state transition from status %', v_booking_status;
    END IF;

    -- 4. EXPLICIT NUMERIC CENTAVO CALCULATIONS & FINANCIAL RECONCILIATION
    v_expected_deposit_centavos := ROUND((v_deposit_amount::NUMERIC) * 100::NUMERIC)::NUMERIC;

    IF (p_expected_deposit_centavos::NUMERIC) != v_expected_deposit_centavos THEN
        RAISE EXCEPTION 'Financial authority error: Application expected deposit centavos (%) does not match database deposit centavos (%)',
            p_expected_deposit_centavos, v_expected_deposit_centavos;
    END IF;

    IF (p_paid_amount_centavos::NUMERIC) < v_expected_deposit_centavos THEN
        RAISE EXCEPTION 'Financial reconciliation failed: Paid centavos % is less than database deposit requirement %',
            p_paid_amount_centavos, v_expected_deposit_centavos;
    END IF;

    -- 5. ATOMIC MUTATIONS WITH STRICT ROW COUNT AND TENANT ISOLATION

    -- A. Update Booking Status -> 'CONFIRMED'
    UPDATE public.bookings
    SET status = 'CONFIRMED',
        updated_at = NOW()
    WHERE id = p_booking_id AND tenant_id = p_tenant_id AND status = 'PENDING_PAYMENT';

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 booking row updated to CONFIRMED, but % rows affected',
            v_rows_affected;
    END IF;

    -- B. Update Payment Record -> 'PAID' (Canonical column: gateway_transaction_id)
    UPDATE public.payments
    SET status = 'PAID',
        gateway_transaction_id = p_gateway_transaction_id,
        updated_at = NOW()
    WHERE booking_id = p_booking_id AND tenant_id = p_tenant_id AND status = 'PENDING';

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 payment record updated to PAID, but % rows affected',
            v_rows_affected;
    END IF;

    -- C. Delete Temporary Inventory Soft Lock
    DELETE FROM public.inventory_locks
    WHERE session_id = p_booking_id::text AND tenant_id = p_tenant_id;

    -- D. Insert Audit Timeline Event
    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description, performed_by_role, is_system_event, metadata
    )
    VALUES (
        p_tenant_id, p_booking_id, 'PENDING_PAYMENT', 'CONFIRMED',
        'Payment Verified & Booking Confirmed',
        'Received PayMongo deposit payment ₱' || (p_paid_amount_centavos / 100)::text || '. Reservation locked.',
        'system', TRUE,
        jsonb_build_object('eventId', p_event_id, 'gatewayTransactionId', p_gateway_transaction_id, 'paidAmount', p_paid_amount_centavos / 100)
    );

    -- E. Record in Webhook Inbox as 'processed'
    INSERT INTO public.webhook_inbox (tenant_id, provider, event_id, event_type, payload, status, processed_at)
    VALUES (p_tenant_id, 'paymongo', p_event_id, p_event_type, p_raw_payload, 'processed', NOW())
    ON CONFLICT (event_id) DO UPDATE
    SET status = 'processed',
        processed_at = NOW()
    WHERE webhook_inbox.status != 'processed';

    -- 6. COMPLETION & COMPOSITE RESPONSE
    RETURN jsonb_build_object(
        'status', 'success',
        'booking_id', p_booking_id,
        'booking_public_id', v_booking_public_id,
        'paid_amount', p_paid_amount_centavos / 100
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.process_paymongo_webhook_atomic IS 'Enterprise hardened atomic PostgreSQL transaction function for PayMongo webhook processing with ON CONFLICT (event_id) matching UNIQUE(event_id) schema constraint.';
