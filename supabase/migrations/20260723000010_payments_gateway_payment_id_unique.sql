-- ============================================================================
-- KYU RENTALS — MIGRATION 00010: PAYMENTS GATEWAY TRANSACTION ID UNIQUE CONSTRAINT
-- Version: 1.0.1 (COLUMN & INDEX MATCHED)
-- Date: 2026-07-24
-- Purpose: Enforce unique constraint on gateway_transaction_id in public.payments.
--          Prevents duplicate gateway payment transaction IDs from being attached
--          to multiple bookings or payment records in multi-tenant architecture.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_gateway_transaction_id_unique
ON public.payments (gateway_transaction_id)
WHERE gateway_transaction_id IS NOT NULL;

COMMENT ON INDEX public.idx_payments_gateway_transaction_id_unique IS 'Guarantees that a PayMongo gateway_transaction_id is unique across payments.';
