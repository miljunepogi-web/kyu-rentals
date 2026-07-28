CREATE POLICY "No direct client access to payment refunds"
    ON public.payment_refunds
    FOR ALL
    TO authenticated
    USING (FALSE)
    WITH CHECK (FALSE);
