-- ============================================================================
-- KYU RENTALS — CATALOG SEED DATA & TABLE PRIVILEGES
-- Date: 2026-07-27
-- Purpose:
--   1. Grant API roles table privileges required for PostgREST/RLS evaluation.
--   2. Seed the published package catalog used by the booking wizard.
--   3. Seed one deployable inventory unit per package for availability checks.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. POSTGREST TABLE/SEQUENCE PRIVILEGES
-- ----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT SELECT ON TABLE public.packages TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. PACKAGE CATALOG SEED
-- ----------------------------------------------------------------------------

INSERT INTO public.packages (
    tenant_id,
    name,
    slug,
    tagline,
    description,
    price_4_hours,
    price_8_hours,
    price_full_day,
    featured_image_url,
    gallery_urls,
    max_guests,
    sound_rating,
    is_featured,
    is_popular,
    is_published,
    is_deleted
)
VALUES
    (
        '11111111-1111-1111-1111-111111111111'::uuid,
        'KYU Mini Party',
        'kyu-mini',
        'Compact power for intimate home gatherings',
        'Perfect for condo celebrations, small family dinners, and private room parties. Crystal clear vocal output with zero distortion.',
        1800,
        2500,
        3000,
        'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
        ARRAY[
            'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80'
        ],
        '10-20 Guests',
        '300 Watts',
        TRUE,
        FALSE,
        TRUE,
        FALSE
    ),
    (
        '11111111-1111-1111-1111-111111111111'::uuid,
        'KYU Party Pro',
        'kyu-party-pro',
        'Our most popular setup for birthdays and backyard events',
        'High-impact dual speaker setup with dedicated wireless mics, party laser lights, and songbook tablet interface.',
        2800,
        3600,
        4200,
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
        ARRAY[
            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80'
        ],
        '30-60 Guests',
        '800 Watts',
        TRUE,
        TRUE,
        TRUE,
        FALSE
    ),
    (
        '11111111-1111-1111-1111-111111111111'::uuid,
        'KYU Concert Master',
        'kyu-concert-master',
        'Unbeatable sound clarity for outdoor events & company parties',
        'Full venue audio package with dual subwoofers, 4 wireless microphones, stage lighting, and priority setup service.',
        4800,
        6200,
        7500,
        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
        ARRAY[
            'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80',
            'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80'
        ],
        '80-150 Guests',
        '2000 Watts',
        TRUE,
        FALSE,
        TRUE,
        FALSE
    )
ON CONFLICT (slug) DO UPDATE
SET
    tenant_id = EXCLUDED.tenant_id,
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    price_4_hours = EXCLUDED.price_4_hours,
    price_8_hours = EXCLUDED.price_8_hours,
    price_full_day = EXCLUDED.price_full_day,
    featured_image_url = EXCLUDED.featured_image_url,
    gallery_urls = EXCLUDED.gallery_urls,
    max_guests = EXCLUDED.max_guests,
    sound_rating = EXCLUDED.sound_rating,
    is_featured = EXCLUDED.is_featured,
    is_popular = EXCLUDED.is_popular,
    is_published = TRUE,
    is_deleted = FALSE,
    updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 3. BASE INVENTORY SEED
-- ----------------------------------------------------------------------------

INSERT INTO public.inventory_units (
    tenant_id,
    package_id,
    serial_number,
    status,
    condition_notes,
    is_deleted
)
SELECT
    p.tenant_id,
    p.id,
    seed.serial_number,
    'READY_TO_DEPLOY',
    'Seeded baseline unit for booking availability checks.',
    FALSE
FROM (
    VALUES
        ('kyu-mini', 'KYU-MINI-001'),
        ('kyu-party-pro', 'KYU-PRO-001'),
        ('kyu-concert-master', 'KYU-CONCERT-001')
) AS seed(slug, serial_number)
JOIN public.packages p ON p.slug = seed.slug
ON CONFLICT (tenant_id, serial_number) DO UPDATE
SET
    package_id = EXCLUDED.package_id,
    status = 'READY_TO_DEPLOY',
    is_deleted = FALSE,
    condition_notes = EXCLUDED.condition_notes,
    updated_at = NOW();
