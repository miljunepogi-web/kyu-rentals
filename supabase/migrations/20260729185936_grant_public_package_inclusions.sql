-- Expose only the structured inclusion list added to the public package catalog.
GRANT SELECT (inclusions) ON TABLE public.packages TO anon;
