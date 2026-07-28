ALTER TABLE public.payments
    DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE public.payments
    ADD CONSTRAINT payments_payment_method_check
        CHECK (payment_method IN (
            'gcash',
            'maya',
            'card',
            'cash',
            'bank_transfer',
            'PAYMONGO_CHECKOUT',
            'PAYMONGO_GCASH',
            'PAYMONGO_MAYA',
            'PAYMONGO_CARD',
            'MANUAL',
            'CASH',
            'GCASH',
            'MAYA',
            'BANK_TRANSFER',
            'OTHER'
        ));
