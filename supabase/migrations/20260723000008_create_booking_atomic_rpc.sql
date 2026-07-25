-- ============================================================================
-- KYU RENTALS — MIGRATION 00008: ATOMIC BOOKING CREATION RPC FUNCTION
-- Version: 1.0.0
-- Date: 2026-07-23
-- Purpose: Implement single atomic PostgreSQL transaction function for
--          creating guest profile (if needed), inserting booking, soft lock,
--          and timeline events within a single database transaction.
-- ============================================================================

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
BEGIN
    -- 1. Create Guest Profile dynamically inside transaction if p_customer_id IS NULL
    IF v_customer_id IS NULL THEN
        -- Check if profile already exists by email to prevent duplicate profile insertion
        SELECT id INTO v_customer_id
        FROM public.profiles
        WHERE tenant_id = p_tenant_id
          AND email = p_customer_email
          AND is_deleted = FALSE
        LIMIT 1;

        IF v_customer_id IS NULL THEN
            INSERT INTO public.profiles (
                tenant_id,
                email,
                full_name,
                phone,
                is_active,
                created_source
            )
            VALUES (
                p_tenant_id,
                p_customer_email,
                p_customer_name,
                p_customer_phone,
                TRUE,
                'WEB'::public.created_source_type
            )
            RETURNING id INTO v_customer_id;
        END IF;
    END IF;

    -- 2. Insert Booking Record
    INSERT INTO public.bookings (
        tenant_id,
        customer_id,
        package_id,
        status,
        event_date,
        start_time,
        duration_hours,
        event_end_time,
        delivery_address,
        delivery_zone,
        special_instructions,
        subtotal_amount,
        surcharge_amount,
        delivery_fee,
        discount_amount,
        grand_total,
        deposit_amount,
        balance_amount,
        snapshot,
        created_source
    )
    VALUES (
        p_tenant_id,
        v_customer_id,
        p_package_id,
        'PENDING_PAYMENT',
        p_event_date,
        p_start_time,
        p_duration_hours,
        p_event_end_time,
        p_delivery_address,
        p_delivery_zone,
        p_special_instructions,
        p_subtotal_amount,
        p_surcharge_amount,
        p_delivery_fee,
        p_discount_amount,
        p_grand_total,
        p_deposit_amount,
        p_balance_amount,
        p_snapshot,
        'WEB'::public.created_source_type
    )
    RETURNING id, public_id INTO v_booking_id, v_booking_public_id;

    -- 3. Insert Temporary 15-Minute Soft Reservation Lock
    INSERT INTO public.inventory_locks (
        tenant_id,
        package_id,
        session_id,
        expires_at
    )
    VALUES (
        p_tenant_id,
        p_package_id,
        v_booking_id::text,
        p_lock_expires_at
    );

    -- 4. Insert Initial Timeline Audit Event
    INSERT INTO public.booking_timeline_events (
        tenant_id,
        booking_id,
        from_status,
        to_status,
        event_label,
        event_description,
        performed_by_role,
        is_system_event,
        metadata
    )
    VALUES (
        p_tenant_id,
        v_booking_id,
        NULL,
        'PENDING_PAYMENT',
        'Booking Draft Initialized & Reserved',
        'Inventory locked for 15 minutes until ' || p_lock_expires_at::text,
        'customer',
        TRUE,
        jsonb_build_object(
            'idempotencyKey', p_idempotency_key,
            'grandTotal', p_grand_total,
            'depositAmount', p_deposit_amount
        )
    );

    -- 5. Return Composite Execution Result
    RETURN jsonb_build_object(
        'booking_id', v_booking_id,
        'booking_public_id', v_booking_public_id,
        'customer_id', v_customer_id,
        'expires_at', p_lock_expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.create_booking_atomic IS 'Atomic PostgreSQL transaction function for creating customer profile, booking, soft lock, and timeline events in a single transaction.';
