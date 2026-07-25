-- ============================================================================
-- KYU RENTALS — MIGRATION 00014: INVENTORY MILESTONE 4.2 PRODUCTION HARDENING
-- Version: 1.0.0
-- Date: 2026-07-23
-- Purpose:
--   1. Safely assert CHECK constraint on inventory_units.status (idempotent).
--   2. Safely assert UNIQUE constraint on (tenant_id, serial_number) (idempotent).
--   3. Replace update_inventory_unit_status_admin() with hardened version that
--      adds a RETIREMENT SAFETY CHECK: blocks RETIRED transition if the unit
--      is currently assigned to any active booking.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ASSERT CHECK CONSTRAINT ON inventory_units.status
--    The constraint was created in migration 00007. This DO block re-asserts it
--    idempotently so that environments where 00007 ran without it are protected.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints
        WHERE constraint_schema = 'public'
          AND constraint_name = 'inventory_units_status_check'
    ) THEN
        ALTER TABLE public.inventory_units
            ADD CONSTRAINT inventory_units_status_check
            CHECK (status IN ('READY_TO_DEPLOY', 'IN_USE', 'UNDER_REPAIR', 'RETIRED'));
        RAISE NOTICE 'Added inventory_units_status_check constraint.';
    ELSE
        RAISE NOTICE 'inventory_units_status_check already exists — skipped.';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. ASSERT UNIQUE CONSTRAINT ON (tenant_id, serial_number)
--    The constraint was created in migration 00007. This DO block re-asserts it
--    idempotently. The database remains the final authority on uniqueness.
-- ----------------------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_schema = 'public'
          AND table_name = 'inventory_units'
          AND constraint_name = 'uq_inventory_units_tenant_serial'
          AND constraint_type = 'UNIQUE'
    ) THEN
        ALTER TABLE public.inventory_units
            ADD CONSTRAINT uq_inventory_units_tenant_serial UNIQUE (tenant_id, serial_number);
        RAISE NOTICE 'Added uq_inventory_units_tenant_serial constraint.';
    ELSE
        RAISE NOTICE 'uq_inventory_units_tenant_serial already exists — skipped.';
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. REPLACE update_inventory_unit_status_admin() WITH HARDENED VERSION
--    Adds RETIREMENT SAFETY CHECK: atomically rejects RETIRED transition
--    when the unit is currently assigned to any active booking.
--
--    Active booking statuses:
--      CONFIRMED, PREPARING, DRIVER_ASSIGNED, OUT_FOR_DELIVERY,
--      DELIVERED, RENTAL_ACTIVE
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_inventory_unit_status_admin(
    p_tenant_id UUID,
    p_unit_id UUID,
    p_expected_current_status TEXT,
    p_target_status TEXT,
    p_admin_profile_id UUID,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_current_status TEXT;
    v_unit_public_id TEXT;
    v_serial_number TEXT;
    v_is_valid_transition BOOLEAN := FALSE;
    v_rows_affected INTEGER;
    v_caller_uid UUID;
    v_caller_role_name TEXT;
    v_caller_tenant_id UUID;
    v_active_booking_count INTEGER;
BEGIN
    -- ------------------------------------------------------------------------
    -- 1. DEFENSIVE ASSERTIONS
    -- ------------------------------------------------------------------------
    IF p_tenant_id IS NULL OR p_unit_id IS NULL THEN
        RAISE EXCEPTION 'Defensive validation failed: Tenant ID and Unit ID must be non-null';
    END IF;

    IF p_target_status IS NULL OR length(trim(p_target_status)) = 0 THEN
        RAISE EXCEPTION 'Defensive validation failed: Target status must be a non-empty string';
    END IF;

    IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
        RAISE EXCEPTION 'Defensive validation failed: Administrative reason must be at least 3 characters long';
    END IF;

    IF p_admin_profile_id IS NULL THEN
        RAISE EXCEPTION 'Defensive validation failed: Admin profile ID must be non-null';
    END IF;

    -- ------------------------------------------------------------------------
    -- 2. CALLER IDENTITY VERIFICATION
    --    Prevents forged p_admin_profile_id from poisoning the audit trail.
    -- ------------------------------------------------------------------------
    v_caller_uid := auth.uid();

    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: No authenticated session found';
    END IF;

    IF v_caller_uid != p_admin_profile_id THEN
        RAISE EXCEPTION 'Authorization failed: Supplied admin_profile_id does not match authenticated session. Forged identity rejected.';
    END IF;

    -- ------------------------------------------------------------------------
    -- 3. ROLE & TENANT AUTHORIZATION CHECK
    -- ------------------------------------------------------------------------
    SELECT r.name, ur.tenant_id
    INTO v_caller_role_name, v_caller_tenant_id
    FROM public.user_roles ur
    INNER JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_caller_uid
      AND ur.tenant_id = p_tenant_id
      AND r.name IN ('admin', 'super_admin', 'franchise_owner')
    LIMIT 1;

    IF v_caller_role_name IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: User % does not hold an administrative role in tenant %',
            v_caller_uid, p_tenant_id;
    END IF;

    IF v_caller_tenant_id != p_tenant_id THEN
        RAISE EXCEPTION 'Tenant isolation violation: Caller tenant % does not match target tenant %',
            v_caller_tenant_id, p_tenant_id;
    END IF;

    -- ------------------------------------------------------------------------
    -- 4. LOCK TARGET UNIT ROW & VERIFY CURRENT STATUS
    -- ------------------------------------------------------------------------
    SELECT status, public_id, serial_number
    INTO v_current_status, v_unit_public_id, v_serial_number
    FROM public.inventory_units
    WHERE id = p_unit_id AND tenant_id = p_tenant_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Target inventory unit % not found for tenant %', p_unit_id, p_tenant_id;
    END IF;

    IF p_expected_current_status IS NOT NULL AND v_current_status != p_expected_current_status THEN
        RAISE EXCEPTION 'Concurrency conflict: Unit % status changed concurrently. Expected "%" but found "%". Reload and retry.',
            v_unit_public_id, p_expected_current_status, v_current_status;
    END IF;

    IF v_current_status = p_target_status THEN
        RETURN jsonb_build_object(
            'status', 'no_change',
            'unit_id', p_unit_id,
            'message', 'Unit is already in status ' || p_target_status
        );
    END IF;

    -- ------------------------------------------------------------------------
    -- 5. STATE MACHINE VALIDATION MATRIX
    --
    --    READY_TO_DEPLOY → IN_USE            (booking assignment)
    --    READY_TO_DEPLOY → UNDER_REPAIR      (maintenance required)
    --    IN_USE          → READY_TO_DEPLOY   (returned and cleared)
    --    IN_USE          → UNDER_REPAIR      (damage during rental)
    --    UNDER_REPAIR    → READY_TO_DEPLOY   (maintenance complete)
    --    UNDER_REPAIR    → RETIRED           (beyond repair)
    --    RETIRED         → (terminal — no transitions)
    -- ------------------------------------------------------------------------
    v_is_valid_transition := CASE
        WHEN v_current_status = 'READY_TO_DEPLOY' AND p_target_status IN ('IN_USE', 'UNDER_REPAIR') THEN TRUE
        WHEN v_current_status = 'IN_USE'           AND p_target_status IN ('READY_TO_DEPLOY', 'UNDER_REPAIR') THEN TRUE
        WHEN v_current_status = 'UNDER_REPAIR'     AND p_target_status IN ('READY_TO_DEPLOY', 'RETIRED') THEN TRUE
        WHEN v_current_status = 'RETIRED'           THEN FALSE
        ELSE FALSE
    END;

    IF NOT v_is_valid_transition THEN
        RAISE EXCEPTION 'Illegal state machine transition: Cannot transition unit % from "%" to "%"',
            v_unit_public_id, v_current_status, p_target_status;
    END IF;

    -- ------------------------------------------------------------------------
    -- 6. RETIREMENT SAFETY CHECK
    --    A unit may not be retired while assigned to any active booking.
    --    Active statuses: CONFIRMED, PREPARING, DRIVER_ASSIGNED,
    --                     OUT_FOR_DELIVERY, DELIVERED, RENTAL_ACTIVE
    -- ------------------------------------------------------------------------
    IF p_target_status = 'RETIRED' THEN
        SELECT COUNT(*)
        INTO v_active_booking_count
        FROM public.bookings
        WHERE assigned_unit_id = p_unit_id
          AND status IN (
              'CONFIRMED', 'PREPARING', 'DRIVER_ASSIGNED',
              'OUT_FOR_DELIVERY', 'DELIVERED', 'RENTAL_ACTIVE'
          );

        IF v_active_booking_count > 0 THEN
            RAISE EXCEPTION
                'Retirement blocked: Unit % (%) is currently assigned to % active booking(s). '
                'Reassign or complete all active bookings before retiring this unit.',
                v_unit_public_id, v_serial_number, v_active_booking_count;
        END IF;
    END IF;

    -- ------------------------------------------------------------------------
    -- 7. ATOMIC MUTATION — UPDATE UNIT STATUS
    -- ------------------------------------------------------------------------
    UPDATE public.inventory_units
    SET status = p_target_status,
        updated_at = NOW()
    WHERE id = p_unit_id AND tenant_id = p_tenant_id AND is_deleted = FALSE;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 unit row updated, got %', v_rows_affected;
    END IF;

    -- ------------------------------------------------------------------------
    -- 8. ATOMIC MUTATION — INSERT MAINTENANCE LOG
    -- ------------------------------------------------------------------------
    INSERT INTO public.inventory_maintenance_logs (
        tenant_id,
        unit_id,
        previous_status,
        new_status,
        reason,
        notes,
        performed_by
    )
    VALUES (
        p_tenant_id,
        p_unit_id,
        v_current_status,
        p_target_status,
        p_reason,
        p_notes,
        p_admin_profile_id
    );

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 maintenance log row inserted, got %', v_rows_affected;
    END IF;

    -- ------------------------------------------------------------------------
    -- 9. RETURN SUCCESS PAYLOAD
    -- ------------------------------------------------------------------------
    RETURN jsonb_build_object(
        'status', 'success',
        'unit_id', p_unit_id,
        'unit_public_id', v_unit_public_id,
        'serial_number', v_serial_number,
        'previous_status', v_current_status,
        'new_status', p_target_status,
        'executed_by_role', v_caller_role_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-assert permissions (idempotent)
REVOKE EXECUTE ON FUNCTION public.update_inventory_unit_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.update_inventory_unit_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT
) FROM anon;

GRANT EXECUTE ON FUNCTION public.update_inventory_unit_status_admin(
    UUID, UUID, TEXT, TEXT, UUID, TEXT, TEXT
) TO authenticated, service_role;

COMMENT ON FUNCTION public.update_inventory_unit_status_admin IS
  'Hardened atomic inventory unit status transition RPC (Milestone 4.2 Production Hardening). '
  'Validates caller identity, enforces RBAC, tenant isolation, state machine, '
  'retirement safety (blocks RETIRED if active bookings exist), '
  'and audits every mutation with ROW_COUNT assertions.';
