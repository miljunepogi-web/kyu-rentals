-- ============================================================================
-- KYU RENTALS - PAYMENTS PAYMONGO CHECKOUT ALIGNMENT
-- Date: 2026-07-27
-- Purpose:
--   Align public.payments with the PayMongo checkout action and later admin/RPC
--   flows that use uppercase payment/status values.
-- ============================================================================

ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS gateway_provider TEXT NULL,
    ADD COLUMN IF NOT EXISTS gateway_checkout_session_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS gateway_payment_intent_id TEXT NULL,
    ADD COLUMN IF NOT EXISTS gateway_checkout_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'PHP';

ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_payment_type_check,
    DROP CONSTRAINT IF EXISTS payments_payment_method_check,
    DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE public.payments
    ADD CONSTRAINT payments_payment_type_check
        CHECK (payment_type IN (
            'deposit', 'balance', 'full', 'refund',
            'DEPOSIT', 'BALANCE_SETTLEMENT', 'RESERVATION_DEPOSIT', 'FULL_PAYMENT', 'ADJUSTMENT'
        )),
    ADD CONSTRAINT payments_payment_method_check
        CHECK (payment_method IN (
            'gcash', 'maya', 'card', 'cash', 'bank_transfer',
            'PAYMONGO_CHECKOUT', 'PAYMONGO_GCASH', 'PAYMONGO_MAYA', 'PAYMONGO_CARD', 'MANUAL'
        )),
    ADD CONSTRAINT payments_status_check
        CHECK (status IN (
            'pending', 'processing', 'paid', 'failed', 'refunded',
            'PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUNDED', 'SUCCESSFUL', 'COMPLETED'
        ));

CREATE INDEX IF NOT EXISTS idx_payments_checkout_session
    ON public.payments (gateway_checkout_session_id)
    WHERE gateway_checkout_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_gateway_payment_intent
    ON public.payments (gateway_payment_intent_id)
    WHERE gateway_payment_intent_id IS NOT NULL;
