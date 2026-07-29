ALTER TABLE public.bookings
    ADD COLUMN terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN terms_policy_version TEXT,
    ADD COLUMN terms_policy_path TEXT;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_terms_consent_complete
    CHECK (
        (terms_accepted_at IS NULL
            AND terms_policy_version IS NULL
            AND terms_policy_path IS NULL)
        OR
        (terms_accepted_at IS NOT NULL
            AND NULLIF(BTRIM(terms_policy_version), '') IS NOT NULL
            AND NULLIF(BTRIM(terms_policy_path), '') IS NOT NULL)
    );

COMMENT ON COLUMN public.bookings.terms_accepted_at IS
    'Server-recorded timestamp when the customer accepted the rental terms for this booking.';
COMMENT ON COLUMN public.bookings.terms_policy_version IS
    'Immutable cancellation and refund policy version accepted for this booking.';
COMMENT ON COLUMN public.bookings.terms_policy_path IS
    'Policy document path presented to the customer when consent was captured.';

CREATE OR REPLACE FUNCTION public.enforce_booking_terms_consent()
RETURNS TRIGGER AS $$
DECLARE
    v_terms_accepted TEXT;
    v_accepted_at TIMESTAMPTZ;
    v_policy_version TEXT;
    v_policy_path TEXT;
BEGIN
    IF NEW.created_source <> 'WEB'::public.created_source_type THEN
        RETURN NEW;
    END IF;

    v_terms_accepted := NEW.snapshot #>> '{consent,termsAccepted}';
    v_policy_version := NULLIF(BTRIM(NEW.snapshot #>> '{consent,policyVersion}'), '');
    v_policy_path := NULLIF(BTRIM(NEW.snapshot #>> '{consent,policyPath}'), '');

    BEGIN
        v_accepted_at := (NEW.snapshot #>> '{consent,acceptedAt}')::TIMESTAMPTZ;
    EXCEPTION
        WHEN invalid_text_representation OR datetime_field_overflow THEN
            RAISE EXCEPTION USING
                ERRCODE = '22007',
                MESSAGE = 'INVALID_BOOKING_TERMS_ACCEPTANCE_TIMESTAMP';
    END;

    IF v_terms_accepted IS DISTINCT FROM 'true'
       OR v_accepted_at IS NULL
       OR v_policy_version IS NULL
       OR v_policy_path IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'BOOKING_TERMS_ACCEPTANCE_REQUIRED';
    END IF;

    IF v_accepted_at < NOW() - INTERVAL '5 minutes'
       OR v_accepted_at > NOW() + INTERVAL '1 minute' THEN
        RAISE EXCEPTION USING
            ERRCODE = '23514',
            MESSAGE = 'BOOKING_TERMS_ACCEPTANCE_TIMESTAMP_OUT_OF_RANGE';
    END IF;

    NEW.terms_accepted_at := v_accepted_at;
    NEW.terms_policy_version := v_policy_version;
    NEW.terms_policy_path := v_policy_path;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.enforce_booking_terms_consent() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bookings_enforce_terms_consent ON public.bookings;
CREATE TRIGGER trg_bookings_enforce_terms_consent
    BEFORE INSERT ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_booking_terms_consent();
