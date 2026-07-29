-- Cover tenant-scoped cleanup and satisfy the outbox foreign key advisor.
CREATE INDEX IF NOT EXISTS booking_notification_outbox_tenant_id_idx
    ON public.booking_notification_outbox (tenant_id);
