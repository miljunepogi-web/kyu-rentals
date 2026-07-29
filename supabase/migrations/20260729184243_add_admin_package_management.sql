-- Make the Supabase package catalog editable by authorized tenant admins.

INSERT INTO public.permissions (action, category, description)
VALUES ('catalog.manage', 'catalog', 'Create, edit, publish, and archive rental packages')
ON CONFLICT (action) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE LOWER(r.name::TEXT) IN ('super_admin', 'owner', 'franchise_owner', 'admin')
  AND p.action = 'catalog.manage'
ON CONFLICT DO NOTHING;

ALTER TABLE public.packages
    ADD COLUMN IF NOT EXISTS inclusions JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(inclusions) = 'array');

UPDATE public.packages
SET inclusions = CASE slug::TEXT
    WHEN 'kyu-mini' THEN
        '[
          {"id":"inc-1","name":"Heavy Duty Powered Speaker (10-inch)","quantity":1,"iconName":"speaker"},
          {"id":"inc-2","name":"UHF Wireless Microphones","quantity":2,"iconName":"mic"},
          {"id":"inc-3","name":"HD Songbook Player (100k+ Songs)","quantity":1,"iconName":"music"},
          {"id":"inc-4","name":"Heavy Duty Tripod Stand","quantity":1,"iconName":"stand"},
          {"id":"inc-5","name":"HDMI & Aux Cables","quantity":1,"iconName":"cable"}
        ]'::JSONB
    WHEN 'kyu-party-pro' THEN
        '[
          {"id":"inc-1","name":"Dual Powered Speakers (12-inch)","quantity":2,"iconName":"speaker"},
          {"id":"inc-2","name":"Pro Vocal Wireless Microphones","quantity":2,"iconName":"mic"},
          {"id":"inc-3","name":"HD Player (Latest Hits)","quantity":1,"iconName":"music"},
          {"id":"inc-4","name":"RGB Disco Party Laser Light","quantity":1,"iconName":"sparkles"},
          {"id":"inc-5","name":"Songbook Tablet Controller","quantity":1,"iconName":"tablet"},
          {"id":"inc-6","name":"10m Extension Cable","quantity":1,"iconName":"cable"}
        ]'::JSONB
    WHEN 'kyu-concert-master' THEN
        '[
          {"id":"inc-1","name":"Dual Concert Speakers (15-inch)","quantity":2,"iconName":"speaker"},
          {"id":"inc-2","name":"15-inch Subwoofer Enclosure","quantity":1,"iconName":"subwoofer"},
          {"id":"inc-3","name":"UHF Quad Wireless Microphones","quantity":4,"iconName":"mic"},
          {"id":"inc-4","name":"Smart Song System + Dual Monitors","quantity":1,"iconName":"monitor"},
          {"id":"inc-5","name":"DMX Stage Lighting Bar","quantity":1,"iconName":"sparkles"},
          {"id":"inc-6","name":"White-Glove Delivery & Sound Engineer Setup","quantity":1,"iconName":"wrench"}
        ]'::JSONB
    ELSE inclusions
END
WHERE inclusions = '[]'::JSONB;

GRANT SELECT ON TABLE public.packages TO authenticated;
GRANT INSERT (
    id, tenant_id, name, slug, tagline, description,
    price_4_hours, price_8_hours, price_full_day,
    featured_image_url, gallery_urls, inclusions,
    max_guests, sound_rating, is_featured, is_popular, is_published
) ON TABLE public.packages TO authenticated;
GRANT UPDATE (
    name, slug, tagline, description,
    price_4_hours, price_8_hours, price_full_day,
    featured_image_url, gallery_urls, inclusions,
    max_guests, sound_rating, is_featured, is_popular, is_published,
    is_deleted, deleted_at, deleted_by, deletion_reason
) ON TABLE public.packages TO authenticated;

ALTER POLICY "Public read published packages"
    ON public.packages TO anon;

DROP POLICY IF EXISTS "Authenticated view permitted packages" ON public.packages;
CREATE POLICY "Authenticated view permitted packages"
    ON public.packages FOR SELECT TO authenticated
    USING (
        (is_published = TRUE AND is_deleted = FALSE)
        OR public.has_permission('catalog.manage', tenant_id)
    );

DROP POLICY IF EXISTS "Catalog managers create tenant packages" ON public.packages;
CREATE POLICY "Catalog managers create tenant packages"
    ON public.packages FOR INSERT TO authenticated
    WITH CHECK (public.has_permission('catalog.manage', tenant_id));

DROP POLICY IF EXISTS "Catalog managers update tenant packages" ON public.packages;
CREATE POLICY "Catalog managers update tenant packages"
    ON public.packages FOR UPDATE TO authenticated
    USING (public.has_permission('catalog.manage', tenant_id))
    WITH CHECK (public.has_permission('catalog.manage', tenant_id));

INSERT INTO storage.buckets (
    id, name, public, file_size_limit, allowed_mime_types
)
VALUES (
    'package-images',
    'package-images',
    TRUE,
    8388608,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Catalog managers upload package images" ON storage.objects;
CREATE POLICY "Catalog managers upload package images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'package-images'
        AND (storage.foldername(name))[1] ~
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.has_permission(
            'catalog.manage',
            ((storage.foldername(name))[1])::UUID
        )
    );

DROP POLICY IF EXISTS "Catalog managers update package images" ON storage.objects;
CREATE POLICY "Catalog managers update package images"
    ON storage.objects FOR UPDATE TO authenticated
    USING (
        bucket_id = 'package-images'
        AND (storage.foldername(name))[1] ~
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.has_permission(
            'catalog.manage',
            ((storage.foldername(name))[1])::UUID
        )
    )
    WITH CHECK (
        bucket_id = 'package-images'
        AND (storage.foldername(name))[1] ~
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.has_permission(
            'catalog.manage',
            ((storage.foldername(name))[1])::UUID
        )
    );

DROP POLICY IF EXISTS "Catalog managers delete package images" ON storage.objects;
CREATE POLICY "Catalog managers delete package images"
    ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'package-images'
        AND (storage.foldername(name))[1] ~
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND public.has_permission(
            'catalog.manage',
            ((storage.foldername(name))[1])::UUID
        )
    );
