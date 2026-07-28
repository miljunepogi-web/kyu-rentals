-- Published package catalog data remains public after a customer signs in.
ALTER POLICY "Public read published packages"
    ON public.packages
    TO anon, authenticated;
