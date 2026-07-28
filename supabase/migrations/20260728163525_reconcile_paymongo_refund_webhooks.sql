-- Allow a signed PayMongo webhook to move an accepted asynchronous refund
-- from manual_review to its terminal succeeded/failed state.
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
