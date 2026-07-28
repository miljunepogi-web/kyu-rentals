-- Secure, idempotent PayMongo refunds for cancelled bookings.

CREATE TABLE public.payment_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 1),
    currency TEXT NOT NULL DEFAULT 'PHP' CHECK (currency = 'PHP'),
    reason TEXT NOT NULL CHECK (reason IN ('merchant_cancellation', 'duplicate', 'fraudulent', 'other')),
    notes TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing'
        CHECK (status IN ('processing', 'succeeded', 'failed', 'manual_review')),
    paymongo_refund_id TEXT NULL UNIQUE,
    gateway_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    failure_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ NULL,
    CONSTRAINT payment_refunds_one_per_payment UNIQUE (payment_id)
);

CREATE INDEX payment_refunds_booking_created_idx
    ON public.payment_refunds (booking_id, created_at DESC);

ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_refunds FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.payment_refunds TO service_role;

CREATE TRIGGER trg_payment_refunds_updated_at
    BEFORE UPDATE ON public.payment_refunds
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.begin_paymongo_refund_admin(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_payment_id UUID,
    p_operator_id UUID,
    p_reason TEXT,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_booking_status TEXT;
    v_refund_id UUID;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        IF auth.uid() IS NULL OR auth.uid() != p_operator_id THEN
            RAISE EXCEPTION 'Authorization failed: operator does not match authenticated session';
        END IF;
        IF NOT public.has_permission('financials.manage', p_tenant_id) THEN
            RAISE EXCEPTION 'Authorization failed: financials.manage permission is required';
        END IF;
    END IF;

    IF p_reason NOT IN ('merchant_cancellation', 'duplicate', 'fraudulent', 'other') THEN
        RAISE EXCEPTION 'Unsupported refund reason';
    END IF;
    IF p_notes IS NULL OR LENGTH(TRIM(p_notes)) < 5 OR LENGTH(TRIM(p_notes)) > 500 THEN
        RAISE EXCEPTION 'Refund notes must be between 5 and 500 characters';
    END IF;

    SELECT status INTO v_booking_status
    FROM public.bookings
    WHERE id = p_booking_id
      AND tenant_id = p_tenant_id
      AND is_deleted = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;
    IF v_booking_status != 'CANCELLED' THEN
        RAISE EXCEPTION 'Refunds can only be issued after the booking is cancelled';
    END IF;

    SELECT id, amount, currency, gateway_transaction_id
    INTO v_payment
    FROM public.payments
    WHERE id = p_payment_id
      AND booking_id = p_booking_id
      AND tenant_id = p_tenant_id
      AND UPPER(COALESCE(gateway_provider, '')) = 'PAYMONGO'
      AND UPPER(status) IN ('PAID', 'SUCCESSFUL', 'COMPLETED')
      AND gateway_transaction_id IS NOT NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Eligible paid PayMongo payment not found';
    END IF;

    INSERT INTO public.payment_refunds (
        tenant_id, booking_id, payment_id, requested_by, amount, currency, reason, notes
    ) VALUES (
        p_tenant_id, p_booking_id, p_payment_id, p_operator_id,
        v_payment.amount, COALESCE(v_payment.currency, 'PHP'), p_reason, TRIM(p_notes)
    )
    ON CONFLICT (payment_id) DO NOTHING
    RETURNING id INTO v_refund_id;

    IF v_refund_id IS NULL THEN
        RAISE EXCEPTION 'A refund operation already exists for this payment';
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'refund_id', v_refund_id,
        'amount', v_payment.amount,
        'gateway_payment_id', v_payment.gateway_transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

CREATE OR REPLACE FUNCTION public.finalize_paymongo_refund_admin(
    p_refund_id UUID,
    p_status TEXT,
    p_paymongo_refund_id TEXT DEFAULT NULL,
    p_gateway_response JSONB DEFAULT '{}'::jsonb,
    p_failure_message TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_refund RECORD;
    v_refund_payment_id UUID;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Authorization failed: service role is required';
    END IF;
    IF p_status NOT IN ('succeeded', 'failed', 'manual_review') THEN
        RAISE EXCEPTION 'Unsupported refund final status';
    END IF;

    SELECT * INTO v_refund
    FROM public.payment_refunds
    WHERE id = p_refund_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Refund operation not found';
    END IF;
    IF v_refund.status IN ('succeeded', 'failed') THEN
        RETURN jsonb_build_object('success', TRUE, 'duplicate', TRUE, 'status', v_refund.status);
    END IF;

    UPDATE public.payment_refunds
    SET status = p_status,
        paymongo_refund_id = p_paymongo_refund_id,
        gateway_response = COALESCE(p_gateway_response, '{}'::jsonb),
        failure_message = LEFT(p_failure_message, 500),
        processed_at = CASE WHEN p_status != 'manual_review' THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_refund_id;

    IF p_status = 'manual_review' THEN
        UPDATE public.payments
        SET status = 'PROCESSING', updated_at = NOW()
        WHERE id = v_refund.payment_id;

        INSERT INTO public.booking_timeline_events (
            tenant_id, booking_id, from_status, to_status, event_label,
            event_description, performed_by, performed_by_role, is_system_event, metadata
        ) VALUES (
            v_refund.tenant_id, v_refund.booking_id, 'CANCELLED', 'CANCELLED',
            'PayMongo Refund Processing',
            'Full refund of PHP ' || TO_CHAR(v_refund.amount, 'FM999,999,990.00')
                || ' was accepted and is awaiting PayMongo confirmation.',
            v_refund.requested_by, 'admin', FALSE,
            jsonb_build_object('refund_id', v_refund.id, 'paymongo_refund_id', p_paymongo_refund_id)
        );
    ELSIF p_status = 'succeeded' THEN
        UPDATE public.payments
        SET status = 'REFUNDED', updated_at = NOW()
        WHERE id = v_refund.payment_id;

        INSERT INTO public.payments (
            tenant_id, booking_id, payment_type, payment_method, amount, status,
            gateway_provider, gateway_transaction_id, currency, gateway_response
        ) VALUES (
            v_refund.tenant_id, v_refund.booking_id, 'refund', 'PAYMONGO_CHECKOUT',
            v_refund.amount, 'REFUNDED', 'PAYMONGO', p_paymongo_refund_id,
            v_refund.currency, COALESCE(p_gateway_response, '{}'::jsonb)
        ) RETURNING id INTO v_refund_payment_id;

        INSERT INTO public.booking_timeline_events (
            tenant_id, booking_id, from_status, to_status, event_label,
            event_description, performed_by, performed_by_role, is_system_event, metadata
        ) VALUES (
            v_refund.tenant_id, v_refund.booking_id, 'CANCELLED', 'CANCELLED',
            'PayMongo Refund Issued',
            'Full refund of PHP ' || TO_CHAR(v_refund.amount, 'FM999,999,990.00')
                || ' submitted. PayMongo refund reference: ' || COALESCE(p_paymongo_refund_id, 'pending'),
            v_refund.requested_by, 'admin', FALSE,
            jsonb_build_object('refund_id', v_refund.id, 'payment_id', v_refund.payment_id)
        );

        PERFORM public.log_audit_event(
            v_refund.tenant_id, 'PAYMONGO_REFUND_ISSUED', 'PAYMENT',
            'payment_refunds', v_refund.id, p_paymongo_refund_id,
            v_refund.requested_by, 'admin', 'warning',
            jsonb_build_object(
                'booking_id', v_refund.booking_id,
                'payment_id', v_refund.payment_id,
                'amount', v_refund.amount,
                'refund_payment_id', v_refund_payment_id
            )
        );
    ELSE
        UPDATE public.payments
        SET status = 'PAID', updated_at = NOW()
        WHERE id = v_refund.payment_id;

        PERFORM public.log_audit_event(
            v_refund.tenant_id, 'PAYMONGO_REFUND_FAILED', 'PAYMENT',
            'payment_refunds', v_refund.id, NULL,
            v_refund.requested_by, 'admin', 'warning',
            jsonb_build_object(
                'booking_id', v_refund.booking_id,
                'payment_id', v_refund.payment_id,
                'status', p_status,
                'failure_message', LEFT(p_failure_message, 500)
            )
        );
    END IF;

    RETURN jsonb_build_object('success', TRUE, 'status', p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.begin_paymongo_refund_admin(UUID, UUID, UUID, UUID, TEXT, TEXT)
    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.begin_paymongo_refund_admin(UUID, UUID, UUID, UUID, TEXT, TEXT)
    TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.finalize_paymongo_refund_admin(UUID, TEXT, TEXT, JSONB, TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_paymongo_refund_admin(UUID, TEXT, TEXT, JSONB, TEXT)
    TO service_role;
