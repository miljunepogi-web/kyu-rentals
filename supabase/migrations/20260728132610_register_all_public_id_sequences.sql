-- Keep the public ID generator allowlist aligned with every table default that
-- calls it. Missing entries make otherwise valid inserts fail at runtime.
CREATE OR REPLACE FUNCTION public.generate_public_id(
    prefix TEXT,
    seq_name TEXT
)
RETURNS TEXT AS $$
DECLARE
    next_val BIGINT;
    formatted_id TEXT;
    allowed_sequences CONSTANT TEXT[] := ARRAY[
        'tenants_public_id_seq',
        'profiles_public_id_seq',
        'bookings_public_id_seq',
        'inventory_units_public_id_seq',
        'payments_public_id_seq',
        'inventory_maintenance_logs_public_id_seq',
        'delivery_assignment_logs_public_id_seq',
        'cancellation_requests_public_id_seq',
        'reviews_public_id_seq',
        'expense_categories_public_id_seq',
        'expenses_public_id_seq',
        'promo_codes_public_id_seq',
        'delivery_checklists_public_id_seq',
        'proof_of_deliveries_public_id_seq',
        'proof_of_delivery_photos_public_id_seq',
        'incidents_public_id_seq',
        'incident_photos_public_id_seq'
    ];
BEGIN
    IF NOT (seq_name = ANY(allowed_sequences)) THEN
        RAISE EXCEPTION 'Invalid or unauthorized sequence name: %', seq_name
            USING HINT = 'Sequence must be registered in the allowed_sequences whitelist.';
    END IF;

    EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
    formatted_id := UPPER(prefix) || '-' || LPAD(next_val::TEXT, 6, '0');
    RETURN formatted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.generate_public_id(TEXT, TEXT)
IS 'Generates human-readable public IDs with a prefix and whitelisted sequence.';

REVOKE ALL ON FUNCTION public.generate_public_id(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_public_id(TEXT, TEXT) TO service_role;
