-- ============================================================================
-- KYU RENTALS — MIGRATION 00001: EXTENSIONS & FOUNDATIONAL FUNCTIONS
-- Version: 1.2.0 (Production Final)
-- Date: 2026-07-23
-- Purpose: Enable PostgreSQL extensions, custom ENUM types, and foundational trigger functions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------

-- pgcrypto: Provides UUID generation (gen_random_uuid) and cryptographic helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- citext: Provides case-insensitive text data type for emails and slugs
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;

-- pg_trgm: Provides trigram matching for fast fuzzy search on names and text
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Ensure public schema can reference extension types
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. CUSTOM ENUMS
-- ----------------------------------------------------------------------------

-- Enforce strict type safety for record source tracking
DO $$ BEGIN
    CREATE TYPE public.created_source_type AS ENUM ('WEB', 'ADMIN', 'SYSTEM', 'API', 'MOBILE', 'AUTOMATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

COMMENT ON TYPE public.created_source_type IS 'Source mechanism through which a record was originally created.';


-- ----------------------------------------------------------------------------
-- 3. FOUNDATIONAL TRIGGER FUNCTIONS
-- ----------------------------------------------------------------------------

/**
 * Trigger Function: update_updated_at_column
 * Description: Automatically sets `updated_at = NOW()` and increments `version`
 *              on row updates for mutable tables.
 */
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();

    -- Automatically increment optimistic locking version if requested via trigger argument
    IF TG_OP = 'UPDATE' THEN
        IF (TG_ARGV[0] IS NOT NULL AND TG_ARGV[0] = 'increment_version') THEN
            NEW.version = OLD.version + 1;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.update_updated_at_column() IS 'Sets updated_at to NOW() and increments row version on UPDATE.';


/**
 * Function: generate_public_id
 * Description: Generates a formatted public ID (e.g. TEN-000001) using a whitelisted sequence.
 */
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
        'payments_public_id_seq'
    ];
BEGIN
    -- Whitelist validation to prevent arbitrary sequence execution
    IF NOT (seq_name = ANY(allowed_sequences)) THEN
        RAISE EXCEPTION 'Invalid or unauthorized sequence name: %', seq_name
            USING HINT = 'Sequence must be registered in the allowed_sequences whitelist.';
    END IF;

    -- Execute sequence nextval dynamically
    EXECUTE format('SELECT nextval(%L)', seq_name) INTO next_val;
    formatted_id := UPPER(prefix) || '-' || LPAD(next_val::TEXT, 6, '0');
    RETURN formatted_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.generate_public_id(TEXT, TEXT) IS 'Generates human-readable public IDs with a prefix and whitelisted sequence.';


/**
 * Trigger Function: handle_new_user
 * Description: Automatically creates a `public.profiles` entry when a new user
 *              registers in Supabase `auth.users`.
 */
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_tenant_id UUID;
    user_full_name TEXT;
BEGIN
    -- Scalable default tenant resolution strategy:
    -- Select the oldest active non-deleted tenant
    SELECT id INTO default_tenant_id 
    FROM public.tenants 
    WHERE is_deleted = FALSE 
    ORDER BY created_at ASC 
    LIMIT 1;

    IF default_tenant_id IS NULL THEN
        RAISE EXCEPTION 'handle_new_user failed: No active tenant found in database for user %', NEW.id;
    END IF;

    -- Extract full name from raw_user_meta_data or fallback to email username part
    user_full_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
        NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
        'User'
    );

    BEGIN
        INSERT INTO public.profiles (
            id,
            tenant_id,
            email,
            full_name,
            phone,
            avatar_url,
            is_active,
            created_source,
            version
        )
        VALUES (
            NEW.id,
            default_tenant_id,
            NEW.email,
            user_full_name,
            NEW.raw_user_meta_data->>'phone',
            NEW.raw_user_meta_data->>'avatar_url',
            TRUE,
            'WEB'::public.created_source_type,
            1
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            version = public.profiles.version + 1,
            updated_at = NOW();
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'handle_new_user failed for user % (SQLSTATE %): %', NEW.id, SQLSTATE, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.handle_new_user() IS 'Trigger function creating public.profiles record when auth.users is inserted with exception handling and optimistic locking support.';
