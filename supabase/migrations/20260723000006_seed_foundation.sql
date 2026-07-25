-- ============================================================================
-- KYU RENTALS — MIGRATION 00006: FOUNDATION SEED DATA
-- Version: 1.0.0
-- Date: 2026-07-23
-- Purpose: Seed default subscription plans, default tenant, system roles,
--          permission taxonomy, role_permissions, and default business settings.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEED SUBSCRIPTION PLANS
-- ----------------------------------------------------------------------------

INSERT INTO public.subscription_plans (id, name, slug, price_monthly, price_annual, max_inventory_units, max_staff_accounts, max_bookings_per_month, max_branches, features)
VALUES 
    (
        '00000000-0000-0000-0000-000000000001'::uuid,
        'Starter',
        'starter',
        1499.00,
        14990.00,
        5,
        2,
        50,
        1,
        '{"custom_domain": false, "sms_notifications": true, "advanced_analytics": false}'::jsonb
    ),
    (
        '00000000-0000-0000-0000-000000000002'::uuid,
        'Growth',
        'growth',
        3499.00,
        34990.00,
        20,
        10,
        250,
        3,
        '{"custom_domain": true, "sms_notifications": true, "advanced_analytics": true}'::jsonb
    ),
    (
        '00000000-0000-0000-0000-000000000003'::uuid,
        'Enterprise',
        'enterprise',
        7999.00,
        79990.00,
        -1,
        -1,
        -1,
        -1,
        '{"custom_domain": true, "sms_notifications": true, "advanced_analytics": true, "white_label": true}'::jsonb
    )
ON CONFLICT (slug) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 2. SEED DEFAULT HEADQUARTERS TENANT
-- ----------------------------------------------------------------------------

INSERT INTO public.tenants (id, public_id, name, slug, plan_id, status, billing_email, created_source)
VALUES (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'TEN-000001',
    'KYU Rentals Head Branch',
    'kyu-headquarters',
    '00000000-0000-0000-0000-000000000001'::uuid,
    'active',
    'support@kyurentals.ph',
    'SYSTEM'::public.created_source_type
)
ON CONFLICT (slug) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 3. SEED SYSTEM ROLES
-- ----------------------------------------------------------------------------

INSERT INTO public.roles (id, name, description, is_system_role)
VALUES
    ('22222222-2222-2222-2222-222222222001'::uuid, 'guest', 'Unauthenticated public website visitor', TRUE),
    ('22222222-2222-2222-2222-222222222002'::uuid, 'customer', 'Registered customer who places rentals', TRUE),
    ('22222222-2222-2222-2222-222222222003'::uuid, 'support_staff', 'Support staff managing bookings and inquiries', TRUE),
    ('22222222-2222-2222-2222-222222222004'::uuid, 'driver', 'Delivery and pickup operational staff', TRUE),
    ('22222222-2222-2222-2222-222222222005'::uuid, 'admin', 'Tenant administrator with full operational access', TRUE),
    ('22222222-2222-2222-2222-222222222006'::uuid, 'super_admin', 'SaaS platform super administrator', TRUE),
    ('22222222-2222-2222-2222-222222222007'::uuid, 'franchise_owner', 'Branch or franchise owner', TRUE)
ON CONFLICT (name) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 4. SEED PERMISSION TAXONOMY
-- ----------------------------------------------------------------------------

INSERT INTO public.permissions (id, action, category, description)
VALUES
    ('33333333-3333-3333-3333-333333333001'::uuid, 'bookings:read', 'booking', 'View booking details'),
    ('33333333-3333-3333-3333-333333333002'::uuid, 'bookings:create', 'booking', 'Create new bookings'),
    ('33333333-3333-3333-3333-333333333003'::uuid, 'bookings:update', 'booking', 'Update booking status'),
    ('33333333-3333-3333-3333-333333333004'::uuid, 'inventory:read', 'inventory', 'View inventory units and components'),
    ('33333333-3333-3333-3333-333333333005'::uuid, 'inventory:manage', 'inventory', 'Manage inventory units and maintenance'),
    ('33333333-3333-3333-3333-333333333006'::uuid, 'deliveries:read', 'delivery', 'View delivery assignments'),
    ('33333333-3333-3333-3333-333333333007'::uuid, 'deliveries:manage', 'delivery', 'Update delivery checklists and proof of delivery'),
    ('33333333-3333-3333-3333-333333333008'::uuid, 'settings:manage', 'settings', 'Update tenant business settings'),
    ('33333333-3333-3333-3333-333333333009'::uuid, 'reports:view', 'finance', 'View financial and operational reports')
ON CONFLICT (action) DO NOTHING;


-- ----------------------------------------------------------------------------
-- 5. MAP ROLE PERMISSIONS
-- ----------------------------------------------------------------------------

-- Admin role gets all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '22222222-2222-2222-2222-222222222005'::uuid, id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Driver role gets delivery read/manage
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
    ('22222222-2222-2222-2222-222222222004'::uuid, '33333333-3333-3333-3333-333333333006'::uuid),
    ('22222222-2222-2222-2222-222222222004'::uuid, '33333333-3333-3333-3333-333333333007'::uuid)
ON CONFLICT DO NOTHING;


-- ----------------------------------------------------------------------------
-- 6. SEED DEFAULT TENANT BUSINESS SETTINGS
-- ----------------------------------------------------------------------------

INSERT INTO public.settings (tenant_id, namespace, key, value, data_type, label, description, is_public, is_sensitive)
VALUES
    -- Business Identity
    ('11111111-1111-1111-1111-111111111111'::uuid, 'business', 'name', '"KYU Rentals"'::jsonb, 'string', 'Business Name', 'Official business display name', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'business', 'tagline', '"Premium Karaoke Equipment Rental"'::jsonb, 'string', 'Tagline', 'Short marketing tagline', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'business', 'email', '"info@kyurentals.ph"'::jsonb, 'string', 'Contact Email', 'Primary customer contact email', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'business', 'phone', '"+639170000000"'::jsonb, 'string', 'Contact Phone', 'Primary customer contact phone', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'business', 'currency', '"PHP"'::jsonb, 'string', 'Currency Code', 'ISO currency code', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'business', 'currency_symbol', '"₱"'::jsonb, 'string', 'Currency Symbol', 'Symbol displayed before price', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'business', 'timezone', '"Asia/Manila"'::jsonb, 'string', 'Timezone', 'Business operation timezone', TRUE, FALSE),

    -- Pricing & Policy
    ('11111111-1111-1111-1111-111111111111'::uuid, 'pricing', 'reservation_pct', '30'::jsonb, 'number', 'Reservation Fee Percentage', 'Percentage of total booking charged as reservation deposit', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'pricing', 'overtime_rate_per_hour', '300'::jsonb, 'number', 'Overtime Hourly Rate', 'PHP charged per hour of extended rental', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'policy', 'cancellation_window_full_refund_hrs', '72'::jsonb, 'number', 'Full Refund Window (Hours)', 'Hours before event for 100% refund', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'policy', 'cancellation_window_partial_refund_hrs', '24'::jsonb, 'number', 'Partial Refund Window (Hours)', 'Hours before event for 50% refund', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'policy', 'partial_refund_pct', '50'::jsonb, 'number', 'Partial Refund Percentage', 'Refund percentage in partial window', TRUE, FALSE),
    ('11111111-1111-1111-1111-111111111111'::uuid, 'policy', 'booking_expiry_hours', '2'::jsonb, 'number', 'Booking Expiry (Hours)', 'Hours before unpaid bookings auto-cancel', TRUE, FALSE)
ON CONFLICT (tenant_id, namespace, key) DO NOTHING;
