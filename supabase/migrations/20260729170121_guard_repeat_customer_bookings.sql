-- A repeat customer may book again, but cannot hold two active reservations
-- for the same package and event date.
CREATE UNIQUE INDEX bookings_one_active_customer_package_date
    ON public.bookings (tenant_id, customer_id, package_id, event_date)
    WHERE is_deleted = FALSE
      AND status IN (
          'DRAFT',
          'PENDING_PAYMENT',
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
