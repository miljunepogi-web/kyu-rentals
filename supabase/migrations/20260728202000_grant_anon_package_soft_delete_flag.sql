-- Allow public catalog queries to filter the RLS-protected soft-delete flag.
-- The packages SELECT policy still exposes only published, non-deleted rows.
GRANT SELECT (is_deleted) ON TABLE public.packages TO anon;
