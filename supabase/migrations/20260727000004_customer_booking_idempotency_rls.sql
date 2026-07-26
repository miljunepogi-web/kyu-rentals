-- ============================================================================
-- KYU RENTALS — CUSTOMER BOOKING IDEMPOTENCY RLS
-- Date: 2026-07-27
-- Purpose:
--   Allow authenticated customers to create and complete their own booking
--   idempotency records before/after create_booking_atomic().
-- ============================================================================

CREATE POLICY "Tenant members create booking idempotency keys"
    ON public.idempotency_keys
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id IN (
            SELECT p.tenant_id
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.is_active = TRUE
              AND p.is_deleted = FALSE
        )
        AND (
            user_id IS NULL
            OR user_id = auth.uid()
        )
    );

CREATE POLICY "Tenant members view own booking idempotency keys"
    ON public.idempotency_keys
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT p.tenant_id
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.is_active = TRUE
              AND p.is_deleted = FALSE
        )
        AND (
            user_id IS NULL
            OR user_id = auth.uid()
        )
    );

CREATE POLICY "Tenant members update own booking idempotency keys"
    ON public.idempotency_keys
    FOR UPDATE
    TO authenticated
    USING (
        tenant_id IN (
            SELECT p.tenant_id
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.is_active = TRUE
              AND p.is_deleted = FALSE
        )
        AND (
            user_id IS NULL
            OR user_id = auth.uid()
        )
    )
    WITH CHECK (
        tenant_id IN (
            SELECT p.tenant_id
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.is_active = TRUE
              AND p.is_deleted = FALSE
        )
        AND (
            user_id IS NULL
            OR user_id = auth.uid()
        )
    );
