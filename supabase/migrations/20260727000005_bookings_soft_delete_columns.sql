-- ============================================================================
-- KYU RENTALS — BOOKINGS SOFT DELETE COLUMN BACKFILL
-- Date: 2026-07-27
-- Purpose:
--   Align public.bookings with queries/RPCs that already filter is_deleted.
-- ============================================================================

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deletion_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_active
    ON public.bookings (tenant_id, event_date, status)
    WHERE is_deleted = FALSE;
