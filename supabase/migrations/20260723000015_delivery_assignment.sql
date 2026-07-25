-- ============================================================================
-- KYU RENTALS — MIGRATION 00015: DELIVERY ASSIGNMENT & SCHEDULING (HARDENED)
-- Version: 1.1.1 (BOOKINGS SCHEMA PREDICATE MATCHED)
-- Date: 2026-07-24
-- Purpose:
--   1. Add assigned_delivery_personnel_id and vehicle_info columns to public.bookings.
--   2. Create delivery_assignment_logs sequence and audit table with previous assignment tracking:
--      - previous_assignee_id (UUID NULL REFERENCES profiles)
--      - previous_vehicle_info (TEXT NULL)
--   3. Create public.assign_delivery_personnel_admin() atomic RPC with:
--      - auth.uid() identity verification (forging prevention)
--      - Caller RBAC role authorization (admin, super_admin, franchise_owner, support_staff)
--      - Tenant isolation assertion
--      - Assignee validation (active, non-deleted, belongs to tenant, holds operational role)
--      - FOR UPDATE row lock & previous assignment state extraction
--      - Audit log insertion with complete (previous -> new) transition state
--      - Automatic status transition (PREPARING -> DRIVER_ASSIGNED)
--      - ROW_COUNT assertions on all mutations
--      - REVOKE from PUBLIC/anon + GRANT to authenticated/service_role
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ALTER BOOKINGS TABLE
-- ----------------------------------------------------------------------------

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS assigned_delivery_personnel_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS vehicle_info TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_assigned_delivery_personnel
    ON public.bookings (tenant_id, assigned_delivery_personnel_id)
    WHERE assigned_delivery_personnel_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. SEQUENCES & DELIVERY ASSIGNMENT LOGS TABLE
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.delivery_assignment_logs_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.delivery_assignment_logs_public_id_seq TO postgres, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.delivery_assignment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('DLV', 'delivery_assignment_logs_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    previous_assignee_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    previous_vehicle_info TEXT NULL,
    assignee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_info TEXT NULL,
    notes TEXT NULL,
    assigned_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.delivery_assignment_logs IS
  'Immutable audit log of all administrative delivery personnel assignments, capturing previous and new state.';

CREATE INDEX IF NOT EXISTS idx_delivery_assignment_logs_booking
    ON public.delivery_assignment_logs (tenant_id, booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_assignment_logs_assignee
    ON public.delivery_assignment_logs (assignee_id);

-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY & POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.delivery_assignment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view own delivery assignment logs"
    ON public.delivery_assignment_logs
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.profiles
            WHERE id = auth.uid() AND is_deleted = FALSE
        )
    );

CREATE POLICY "Service role full access delivery assignment logs"
    ON public.delivery_assignment_logs
    FOR ALL
    TO service_role
    USING (TRUE)
    WITH CHECK (TRUE);

-- ----------------------------------------------------------------------------
-- 4. ATOMIC DELIVERY PERSONNEL ASSIGNMENT RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_delivery_personnel_admin(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_expected_current_status TEXT,
    p_assignee_id UUID,
    p_vehicle_info TEXT DEFAULT NULL,
    p_assignment_notes TEXT DEFAULT NULL,
    p_admin_profile_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_status TEXT;
    v_booking_public_id TEXT;
    v_previous_assignee_id UUID;
    v_previous_vehicle_info TEXT;
    v_target_status TEXT;
    v_assignee_name TEXT;
    v_assignee_has_role BOOLEAN := FALSE;
    v_rows_affected INTEGER;
    v_caller_uid UUID;
    v_caller_role_name TEXT;
    v_caller_tenant_id UUID;
BEGIN
    -- Defensive assertions
    IF p_tenant_id IS NULL OR p_booking_id IS NULL OR p_assignee_id IS NULL THEN
        RAISE EXCEPTION 'Defensive validation failed: Tenant ID, Booking ID, and Assignee ID must be non-null';
    END IF;

    IF p_admin_profile_id IS NULL THEN
        RAISE EXCEPTION 'Defensive validation failed: Admin profile ID must be non-null';
    END IF;

    -- Session verification
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: No authenticated session found';
    END IF;

    IF v_caller_uid != p_admin_profile_id THEN
        RAISE EXCEPTION 'Authorization failed: Supplied admin_profile_id does not match authenticated session. Forged identity rejected.';
    END IF;

    -- Role & Tenant Authorization
    SELECT r.name, ur.tenant_id
    INTO v_caller_role_name, v_caller_tenant_id
    FROM public.user_roles ur
    INNER JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_caller_uid
      AND ur.tenant_id = p_tenant_id
      AND r.name IN ('admin', 'super_admin', 'franchise_owner', 'support_staff')
    LIMIT 1;

    IF v_caller_role_name IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: User % does not hold an administrative role in tenant %',
            v_caller_uid, p_tenant_id;
    END IF;

    IF v_caller_tenant_id != p_tenant_id THEN
        RAISE EXCEPTION 'Tenant isolation violation: Caller tenant % does not match target tenant %',
            v_caller_tenant_id, p_tenant_id;
    END IF;

    -- Assignee Validation
    SELECT p.full_name
    INTO v_assignee_name
    FROM public.profiles p
    WHERE p.id = p_assignee_id
      AND p.tenant_id = p_tenant_id
      AND p.is_active = TRUE
      AND p.is_deleted = FALSE;

    IF v_assignee_name IS NULL THEN
        RAISE EXCEPTION 'Assignee validation failed: Profile % is not an active, valid member of tenant %',
            p_assignee_id, p_tenant_id;
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        INNER JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = p_assignee_id
          AND ur.tenant_id = p_tenant_id
          AND r.name IN ('owner', 'franchise_owner', 'super_admin', 'admin', 'support_staff', 'driver')
    ) INTO v_assignee_has_role;

    IF NOT v_assignee_has_role THEN
        RAISE EXCEPTION 'Assignee validation failed: Profile % does not hold an operational role in tenant %',
            p_assignee_id, p_tenant_id;
    END IF;

    -- Lock target booking row & extract previous assignment state
    SELECT status, public_id, assigned_delivery_personnel_id, vehicle_info
    INTO v_current_status, v_booking_public_id, v_previous_assignee_id, v_previous_vehicle_info
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Target booking % not found for tenant %', p_booking_id, p_tenant_id;
    END IF;

    IF p_expected_current_status IS NOT NULL AND v_current_status != p_expected_current_status THEN
        RAISE EXCEPTION 'Concurrency conflict: Booking % status changed concurrently. Expected "%" but found "%". Reload and retry.',
            v_booking_public_id, p_expected_current_status, v_current_status;
    END IF;

    IF v_current_status IN ('DRAFT', 'PENDING_PAYMENT', 'CANCELLED', 'EXPIRED', 'REJECTED', 'REFUNDED', 'COMPLETED') THEN
        RAISE EXCEPTION 'Invalid booking state: Cannot assign delivery personnel to booking % in status "%"',
            v_booking_public_id, v_current_status;
    END IF;

    v_target_status := CASE
        WHEN v_current_status = 'PREPARING' THEN 'DRIVER_ASSIGNED'
        ELSE v_current_status
    END;

    -- Update Booking Assignment
    UPDATE public.bookings
    SET assigned_delivery_personnel_id = p_assignee_id,
        vehicle_info = NULLIF(trim(p_vehicle_info), ''),
        status = v_target_status,
        updated_at = NOW()
    WHERE id = p_booking_id AND tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 booking row updated, got %', v_rows_affected;
    END IF;

    -- Insert Delivery Assignment Log
    INSERT INTO public.delivery_assignment_logs (
        tenant_id,
        booking_id,
        previous_assignee_id,
        previous_vehicle_info,
        assignee_id,
        vehicle_info,
        notes,
        assigned_by
    )
    VALUES (
        p_tenant_id,
        p_booking_id,
        v_previous_assignee_id,
        v_previous_vehicle_info,
        p_assignee_id,
        NULLIF(trim(p_vehicle_info), ''),
        NULLIF(trim(p_assignment_notes), ''),
        p_admin_profile_id
    );

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 delivery assignment log row inserted, got %', v_rows_affected;
    END IF;

    -- Insert Booking Timeline Event
    INSERT INTO public.booking_timeline_events (
        tenant_id,
        booking_id,
        from_status,
        to_status,
        event_label,
        event_description,
        performed_by,
        performed_by_role,
        is_system_event,
        metadata
    )
    VALUES (
        p_tenant_id,
        p_booking_id,
        v_current_status,
        v_target_status,
        'Delivery Assigned',
        'Assigned delivery personnel: ' || v_assignee_name || COALESCE(' (' || NULLIF(trim(p_vehicle_info), '') || ')', ''),
        p_admin_profile_id,
        v_caller_role_name,
        FALSE,
        jsonb_build_object(
            'previous_assignee_id', v_previous_assignee_id,
            'previous_vehicle_info', v_previous_vehicle_info,
            'assignee_id', p_assignee_id,
            'assignee_name', v_assignee_name,
            'vehicle_info', p_vehicle_info,
            'notes', p_assignment_notes
        )
    );

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 timeline event row inserted, got %', v_rows_affected;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'booking_id', p_booking_id,
        'booking_public_id', v_booking_public_id,
        'previous_status', v_current_status,
        'new_status', v_target_status,
        'previous_assignee_id', v_previous_assignee_id,
        'assignee_id', p_assignee_id,
        'assignee_name', v_assignee_name,
        'vehicle_info', p_vehicle_info,
        'executed_by_role', v_caller_role_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.assign_delivery_personnel_admin(UUID, UUID, TEXT, UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_delivery_personnel_admin(UUID, UUID, TEXT, UUID, TEXT, TEXT, UUID) TO authenticated, service_role;
