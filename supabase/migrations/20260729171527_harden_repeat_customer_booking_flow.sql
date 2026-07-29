DROP INDEX IF EXISTS public.bookings_one_active_customer_package_date;

CREATE UNIQUE INDEX bookings_one_active_customer_package_date
    ON public.bookings (tenant_id, customer_id, package_id, event_date)
    WHERE is_deleted = FALSE
      AND status IN (
          'DRAFT',
          'PENDING_PAYMENT',
          'PAYMENT_PROCESSING',
          'CONFIRMED',
          'PREPARING',
          'DRIVER_ASSIGNED',
          'OUT_FOR_DELIVERY',
          'DELIVERED',
          'RENTAL_ACTIVE',
          'PICKUP_SCHEDULED',
          'OUT_FOR_PICKUP',
          'PICKED_UP',
          'CANCELLATION_REQUESTED'
      );

COMMENT ON INDEX public.bookings_one_active_customer_package_date IS
    'Prevents duplicate active reservations by one customer for the same package and event date while allowing retries after terminal outcomes.';

CREATE OR REPLACE FUNCTION public.create_booking_atomic(
    p_tenant_id UUID,
    p_customer_id UUID,
    p_customer_email TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_package_id UUID,
    p_event_date DATE,
    p_start_time TIME,
    p_duration_hours INTEGER,
    p_event_end_time TIMESTAMPTZ,
    p_delivery_address TEXT,
    p_delivery_zone TEXT,
    p_special_instructions TEXT,
    p_subtotal_amount NUMERIC,
    p_surcharge_amount NUMERIC,
    p_delivery_fee NUMERIC,
    p_discount_amount NUMERIC,
    p_grand_total NUMERIC,
    p_deposit_amount NUMERIC,
    p_balance_amount NUMERIC,
    p_snapshot JSONB,
    p_lock_expires_at TIMESTAMPTZ,
    p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_customer_id UUID := p_customer_id;
    v_booking_id UUID;
    v_booking_public_id TEXT;
    v_expired_booking_id UUID;
    v_serviceable_units INTEGER;
    v_active_bookings INTEGER;
    v_active_locks INTEGER;
BEGIN
    IF p_tenant_id IS NULL OR p_package_id IS NULL OR p_event_date IS NULL THEN
        RAISE EXCEPTION 'Tenant, package, and event date are required';
    END IF;

    IF p_lock_expires_at IS NULL OR p_lock_expires_at <= NOW() THEN
        RAISE EXCEPTION 'Inventory lock expiry must be in the future';
    END IF;

    -- Serialize capacity and repeat-customer decisions for this package/date.
    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            p_tenant_id::TEXT || ':' || p_package_id::TEXT || ':' || p_event_date::TEXT,
            0
        )
    );

    IF NOT EXISTS (
        SELECT 1
        FROM public.packages
        WHERE id = p_package_id
          AND tenant_id = p_tenant_id
          AND is_published = TRUE
          AND is_deleted = FALSE
    ) THEN
        RAISE EXCEPTION 'Selected package is not available';
    END IF;

    IF v_customer_id IS NULL THEN
        SELECT id INTO v_customer_id
        FROM public.profiles
        WHERE tenant_id = p_tenant_id
          AND email = p_customer_email
          AND is_deleted = FALSE
        LIMIT 1;

        IF v_customer_id IS NULL THEN
            INSERT INTO public.profiles (
                tenant_id, email, full_name, phone, is_active, created_source
            )
            VALUES (
                p_tenant_id, p_customer_email, p_customer_name, p_customer_phone,
                TRUE, 'WEB'::public.created_source_type
            )
            RETURNING id INTO v_customer_id;
        END IF;
    END IF;

    -- A customer can retry after the 15-minute payment reservation has expired.
    FOR v_expired_booking_id IN
        UPDATE public.bookings AS booking
        SET status = 'EXPIRED'
        WHERE booking.tenant_id = p_tenant_id
          AND booking.customer_id = v_customer_id
          AND booking.package_id = p_package_id
          AND booking.event_date = p_event_date
          AND booking.status = 'PENDING_PAYMENT'
          AND booking.is_deleted = FALSE
          AND NOT EXISTS (
              SELECT 1
              FROM public.inventory_locks AS inventory_lock
              WHERE inventory_lock.session_id = booking.id::TEXT
                AND inventory_lock.expires_at > NOW()
          )
        RETURNING booking.id
    LOOP
        DELETE FROM public.inventory_locks
        WHERE session_id = v_expired_booking_id::TEXT;

        INSERT INTO public.booking_timeline_events (
            tenant_id, booking_id, from_status, to_status, event_label,
            event_description, performed_by_role, is_system_event, metadata
        )
        VALUES (
            p_tenant_id, v_expired_booking_id, 'PENDING_PAYMENT', 'EXPIRED',
            'Payment Reservation Expired',
            'The unpaid 15-minute reservation expired before the customer retried.',
            'system', TRUE,
            jsonb_build_object('reason', 'payment_window_expired_on_retry')
        );
    END LOOP;

    IF EXISTS (
        SELECT 1
        FROM public.bookings
        WHERE tenant_id = p_tenant_id
          AND customer_id = v_customer_id
          AND package_id = p_package_id
          AND event_date = p_event_date
          AND is_deleted = FALSE
          AND status IN (
              'DRAFT', 'PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'CONFIRMED',
              'PREPARING', 'DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED',
              'RENTAL_ACTIVE', 'PICKUP_SCHEDULED', 'OUT_FOR_PICKUP',
              'PICKED_UP', 'CANCELLATION_REQUESTED'
          )
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'CUSTOMER_ALREADY_HAS_ACTIVE_BOOKING';
    END IF;

    -- Lock serviceable unit rows so maintenance/retirement cannot race this count.
    PERFORM id
    FROM public.inventory_units
    WHERE tenant_id = p_tenant_id
      AND package_id = p_package_id
      AND status IN ('READY_TO_DEPLOY', 'IN_USE')
      AND is_deleted = FALSE
    ORDER BY id
    FOR SHARE;

    SELECT COUNT(*)::INTEGER
    INTO v_serviceable_units
    FROM public.inventory_units
    WHERE tenant_id = p_tenant_id
      AND package_id = p_package_id
      AND status IN ('READY_TO_DEPLOY', 'IN_USE')
      AND is_deleted = FALSE;

    SELECT COUNT(*)::INTEGER
    INTO v_active_bookings
    FROM public.bookings
    WHERE tenant_id = p_tenant_id
      AND package_id = p_package_id
      AND event_date = p_event_date
      AND is_deleted = FALSE
      AND status IN (
          'CONFIRMED', 'PREPARING', 'DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY',
          'DELIVERED', 'RENTAL_ACTIVE', 'PICKUP_SCHEDULED',
          'CANCELLATION_REQUESTED'
      );

    SELECT COUNT(*)::INTEGER
    INTO v_active_locks
    FROM public.inventory_locks
    WHERE tenant_id = p_tenant_id
      AND package_id = p_package_id
      AND event_date = p_event_date
      AND expires_at > NOW();

    IF v_serviceable_units <= (v_active_bookings + v_active_locks) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'PACKAGE_FULLY_BOOKED',
            DETAIL = FORMAT(
                'No capacity for package %s on %s (%s units, %s bookings, %s locks)',
                p_package_id, p_event_date, v_serviceable_units,
                v_active_bookings, v_active_locks
            );
    END IF;

    INSERT INTO public.bookings (
        tenant_id, customer_id, package_id, status, event_date, start_time,
        duration_hours, event_end_time, delivery_address, delivery_zone,
        special_instructions, subtotal_amount, surcharge_amount, delivery_fee,
        discount_amount, grand_total, deposit_amount, balance_amount, snapshot,
        created_source
    )
    VALUES (
        p_tenant_id, v_customer_id, p_package_id, 'PENDING_PAYMENT',
        p_event_date, p_start_time, p_duration_hours, p_event_end_time,
        p_delivery_address, p_delivery_zone, p_special_instructions,
        p_subtotal_amount, p_surcharge_amount, p_delivery_fee,
        p_discount_amount, p_grand_total, p_deposit_amount, p_balance_amount,
        p_snapshot, 'WEB'::public.created_source_type
    )
    RETURNING id, public_id INTO v_booking_id, v_booking_public_id;

    INSERT INTO public.inventory_locks (
        tenant_id, package_id, event_date, session_id, expires_at
    )
    VALUES (
        p_tenant_id, p_package_id, p_event_date, v_booking_id::TEXT,
        p_lock_expires_at
    );

    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label,
        event_description, performed_by_role, is_system_event, metadata
    )
    VALUES (
        p_tenant_id, v_booking_id, NULL, 'PENDING_PAYMENT',
        'Booking Draft Initialized & Reserved',
        'Inventory locked for 15 minutes until ' || p_lock_expires_at::TEXT,
        'customer', TRUE,
        jsonb_build_object(
            'idempotencyKey', p_idempotency_key,
            'grandTotal', p_grand_total,
            'depositAmount', p_deposit_amount,
            'capacityAtReservation', v_serviceable_units,
            'occupiedAtReservation', v_active_bookings + v_active_locks
        )
    );

    RETURN jsonb_build_object(
        'booking_id', v_booking_id,
        'booking_public_id', v_booking_public_id,
        'customer_id', v_customer_id,
        'expires_at', p_lock_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp;

COMMENT ON FUNCTION public.create_booking_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, UUID, DATE, TIME WITHOUT TIME ZONE,
    INTEGER, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT, NUMERIC, NUMERIC,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB,
    TIMESTAMP WITH TIME ZONE, TEXT
) IS 'Creates a booking after serialized repeat-customer and capacity checks, expiring stale unpaid retries.';

REVOKE ALL ON FUNCTION public.create_booking_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, UUID, DATE, TIME WITHOUT TIME ZONE,
    INTEGER, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT, NUMERIC, NUMERIC,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB,
    TIMESTAMP WITH TIME ZONE, TEXT
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_booking_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, UUID, DATE, TIME WITHOUT TIME ZONE,
    INTEGER, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, TEXT, NUMERIC, NUMERIC,
    NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB,
    TIMESTAMP WITH TIME ZONE, TEXT
) TO service_role;
