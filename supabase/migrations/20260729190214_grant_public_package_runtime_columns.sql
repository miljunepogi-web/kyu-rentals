-- Permit anonymous catalog queries to select/filter the versioned soft-delete fields.
-- RLS still limits rows to published, non-deleted packages.
GRANT SELECT (version, is_deleted) ON TABLE public.packages TO anon;
