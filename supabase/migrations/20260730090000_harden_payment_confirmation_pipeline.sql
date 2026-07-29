-- Prevent duplicate hosted checkouts, preserve failed confirmation delivery,
-- and stop late PayMongo payments from overbooking inventory.

ALTER TABLE public.booking_timeline_events
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'CUSTOMER'
    CHECK (visibility IN ('CUSTOMER', 'INTERNAL'));

UPDATE public.booking_timeline_events
SET visibility = 'INTERNAL'
WHERE event_label = 'Internal Staff Note';

DROP POLICY IF EXISTS "Customers view own timeline events"
    ON public.booking_timeline_events;
CREATE POLICY "Customers view own timeline events"
    ON public.booking_timeline_events
    FOR SELECT TO authenticated
    USING (
        visibility = 'CUSTOMER'
        AND booking_id IN (
            SELECT id
            FROM public.bookings
            WHERE customer_id = auth.uid()
        )
    );

CREATE UNIQUE INDEX IF NOT EXISTS payments_one_active_paymongo_deposit_session
    ON public.payments (booking_id)
    WHERE payment_type = 'RESERVATION_DEPOSIT'
      AND gateway_provider = 'PAYMONGO'
      AND status IN ('PROCESSING', 'PENDING');

CREATE TABLE IF NOT EXISTS public.booking_notification_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL CHECK (
        notification_type IN ('BOOKING_CONFIRMED')
    ),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'FAILED', 'SENT')
    ),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    last_error TEXT NULL,
    provider_message_id TEXT NULL,
    next_retry_at TIMESTAMPTZ NULL,
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT booking_notification_outbox_booking_type_key
        UNIQUE (booking_id, notification_type)
);

ALTER TABLE public.booking_notification_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access booking notification outbox"
    ON public.booking_notification_outbox;
CREATE POLICY "Service role full access booking notification outbox"
    ON public.booking_notification_outbox
    FOR ALL TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

REVOKE ALL ON TABLE public.booking_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.booking_notification_outbox TO service_role;

CREATE INDEX IF NOT EXISTS booking_notification_outbox_retry_idx
    ON public.booking_notification_outbox (status, next_retry_at, created_at)
    WHERE status IN ('PENDING', 'FAILED');

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
    v_payment_id UUID;
    v_has_live_lock BOOLEAN;
    v_serviceable_units INTEGER;
    v_active_bookings INTEGER;
    v_active_locks INTEGER;
BEGIN
    INSERT INTO public.paymongo_webhook_logs (
        event_id, event_type, booking_id, payload, processed, created_at
    )
    VALUES (
        p_event_id, p_event_type, p_booking_id, p_raw_payload, TRUE, NOW()
    )
    ON CONFLICT (event_id) DO NOTHING;

    IF NOT FOUND THEN
        SELECT id, tenant_id, status
        INTO v_booking
        FROM public.bookings
        WHERE id = p_booking_id
          AND is_deleted = FALSE;

        IF v_booking.status = 'CONFIRMED' THEN
            INSERT INTO public.booking_notification_outbox (
                tenant_id, booking_id, notification_type
            )
            VALUES (
                v_booking.tenant_id, v_booking.id, 'BOOKING_CONFIRMED'
            )
            ON CONFLICT (booking_id, notification_type) DO NOTHING;

            RETURN jsonb_build_object(
                'success', TRUE,
                'duplicate', TRUE,
                'status', 'already_confirmed',
                'booking_id', v_booking.id
            );
        END IF;

        IF v_booking.status = 'PAYMENT_PROCESSING' THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'status', 'manual_review',
                'reason', 'capacity_conflict_already_recorded',
                'booking_id', v_booking.id
            );
        END IF;

        RETURN jsonb_build_object(
            'success', TRUE,
            'duplicate', TRUE,
            'status', 'duplicate',
            'message', 'Webhook event already processed'
        );
    END IF;

    SELECT id, tenant_id, package_id, event_date
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
      AND is_deleted = FALSE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target booking not found for webhook processing.';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            v_booking.tenant_id::TEXT || ':' ||
            v_booking.package_id::TEXT || ':' ||
            v_booking.event_date::TEXT,
            0
        )
    );

    SELECT
        id, tenant_id, package_id, event_date, public_id, status,
        deposit_amount, balance_amount, grand_total
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
      AND is_deleted = FALSE
    FOR UPDATE;

    IF v_booking.status = 'CONFIRMED' THEN
        DELETE FROM public.inventory_locks
        WHERE tenant_id = v_booking.tenant_id
          AND session_id = v_booking.id::TEXT;

        INSERT INTO public.booking_notification_outbox (
            tenant_id, booking_id, notification_type
        )
        VALUES (
            v_booking.tenant_id, v_booking.id, 'BOOKING_CONFIRMED'
        )
        ON CONFLICT (booking_id, notification_type) DO NOTHING;

        RETURN jsonb_build_object(
            'success', TRUE,
            'duplicate', TRUE,
            'status', 'already_confirmed',
            'booking_id', v_booking.id
        );
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
      AND status IN ('PROCESSING', 'PENDING')
      AND gateway_provider = 'PAYMONGO'
    RETURNING id INTO v_payment_id;

    IF v_payment_id IS NULL THEN
        INSERT INTO public.payments (
            tenant_id, booking_id, public_id, payment_type, payment_method,
            gateway_provider, gateway_transaction_id, amount, currency,
            status, created_at
        )
        VALUES (
            v_booking.tenant_id,
            v_booking.id,
            'PAY-' || UPPER(SUBSTRING(
                MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 8
            )),
            'RESERVATION_DEPOSIT',
            COALESCE(p_payment_method, 'PAYMONGO_CHECKOUT'),
            'PAYMONGO',
            p_payment_intent_id,
            p_amount_paid,
            'PHP',
            'PAID',
            NOW()
        )
        RETURNING id INTO v_payment_id;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.inventory_locks
        WHERE tenant_id = v_booking.tenant_id
          AND package_id = v_booking.package_id
          AND event_date = v_booking.event_date
          AND session_id = v_booking.id::TEXT
          AND expires_at > NOW()
    )
    INTO v_has_live_lock;

    PERFORM id
    FROM public.inventory_units
    WHERE tenant_id = v_booking.tenant_id
      AND package_id = v_booking.package_id
      AND status IN ('READY_TO_DEPLOY', 'IN_USE')
      AND is_deleted = FALSE
    ORDER BY id
    FOR SHARE;

    SELECT COUNT(*)::INTEGER
    INTO v_serviceable_units
    FROM public.inventory_units
    WHERE tenant_id = v_booking.tenant_id
      AND package_id = v_booking.package_id
      AND status IN ('READY_TO_DEPLOY', 'IN_USE')
      AND is_deleted = FALSE;

    SELECT COUNT(*)::INTEGER
    INTO v_active_bookings
    FROM public.bookings
    WHERE tenant_id = v_booking.tenant_id
      AND package_id = v_booking.package_id
      AND event_date = v_booking.event_date
      AND id != v_booking.id
      AND is_deleted = FALSE
      AND status IN (
          'CONFIRMED', 'PREPARING', 'DRIVER_ASSIGNED',
          'OUT_FOR_DELIVERY', 'DELIVERED', 'RENTAL_ACTIVE',
          'PICKUP_SCHEDULED', 'CANCELLATION_REQUESTED'
      );

    SELECT COUNT(*)::INTEGER
    INTO v_active_locks
    FROM public.inventory_locks
    WHERE tenant_id = v_booking.tenant_id
      AND package_id = v_booking.package_id
      AND event_date = v_booking.event_date
      AND session_id != v_booking.id::TEXT
      AND expires_at > NOW();

    IF v_serviceable_units <= (v_active_bookings + v_active_locks) THEN
            UPDATE public.bookings
            SET status = 'PAYMENT_PROCESSING',
                updated_at = NOW()
            WHERE id = v_booking.id;

            DELETE FROM public.inventory_locks
            WHERE tenant_id = v_booking.tenant_id
              AND session_id = v_booking.id::TEXT;

            INSERT INTO public.booking_timeline_events (
                tenant_id, booking_id, from_status, to_status, event_label,
                event_description, performed_by_role, is_system_event, metadata
            )
            VALUES (
                v_booking.tenant_id,
                v_booking.id,
                'PENDING_PAYMENT',
                'PAYMENT_PROCESSING',
                'Deposit Payment Requires Manual Capacity Review',
                'Payment was received but inventory capacity is no longer available. Do not confirm fulfillment until reviewed.',
                'system',
                TRUE,
                jsonb_build_object(
                    'event_id', p_event_id,
                    'payment_id', v_payment_id,
                    'had_live_inventory_lock', v_has_live_lock,
                    'serviceable_units', v_serviceable_units,
                    'occupied_units', v_active_bookings + v_active_locks
                )
            );

            PERFORM public.log_audit_event(
                v_booking.tenant_id,
                'PAYMENT_CAPACITY_CONFLICT',
                'PAYMENT',
                'payments',
                v_payment_id,
                p_event_id,
                NULL,
                'system',
                'warning',
                jsonb_build_object(
                    'booking_id', v_booking.id,
                    'amount_paid', p_amount_paid
                )
            );

            RETURN jsonb_build_object(
                'success', TRUE,
                'status', 'manual_review',
                'reason', CASE
                    WHEN v_has_live_lock
                        THEN 'capacity_lost_during_active_hold'
                    ELSE 'capacity_unavailable_after_lock_expiry'
                END,
                'booking_id', v_booking.id,
                'payment_id', v_payment_id
            );
    END IF;

    UPDATE public.bookings
    SET status = 'CONFIRMED',
        updated_at = NOW()
    WHERE id = v_booking.id;

    DELETE FROM public.inventory_locks
    WHERE tenant_id = v_booking.tenant_id
      AND session_id = v_booking.id::TEXT;

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label,
        event_description, performed_by_role, is_system_event, created_at
    )
    VALUES (
        v_booking.tenant_id,
        v_booking.id,
        v_booking.status,
        'CONFIRMED',
        'Deposit Payment Confirmed via PayMongo',
        'Received PHP ' || TRIM(TO_CHAR(p_amount_paid, '999,999.00')) ||
            ' via ' || COALESCE(p_payment_method, 'PayMongo') ||
            '. Ref: ' || p_payment_intent_id,
        'system',
        TRUE,
        NOW()
    );

    INSERT INTO public.booking_notification_outbox (
        tenant_id, booking_id, notification_type
    )
    VALUES (
        v_booking.tenant_id, v_booking.id, 'BOOKING_CONFIRMED'
    )
    ON CONFLICT (booking_id, notification_type) DO NOTHING;

    PERFORM public.log_audit_event(
        v_booking.tenant_id,
        'PAYMONGO_WEBHOOK_PROCESSED',
        'PAYMENT',
        'payments',
        v_payment_id,
        p_event_id,
        NULL,
        'system',
        'info',
        jsonb_build_object(
            'booking_id', v_booking.id,
            'amount_paid', p_amount_paid
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'status', 'success',
        'booking_id', v_booking.id,
        'new_status', 'CONFIRMED',
        'payment_id', v_payment_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.process_paymongo_webhook_atomic(
    TEXT, TEXT, UUID, TEXT, NUMERIC, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.process_paymongo_webhook_atomic(
    TEXT, TEXT, UUID, TEXT, NUMERIC, TEXT, JSONB
) TO service_role;
