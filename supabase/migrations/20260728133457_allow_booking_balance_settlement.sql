ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS chk_bookings_deposit_balance;

ALTER TABLE public.bookings
    ADD CONSTRAINT chk_bookings_deposit_balance
        CHECK (
            deposit_amount >= 0
            AND balance_amount >= 0
            AND deposit_amount <= grand_total
            AND deposit_amount + balance_amount <= grand_total
        );
