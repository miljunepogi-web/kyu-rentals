-- ============================================================================
-- KYU RENTALS — MIGRATION 00007: BOOKINGS, PAYMENTS, LOCKS & WEBHOOK INBOX
-- Version: 1.0.0
-- Date: 2026-07-23
-- Purpose: Implement packages, inventory_units, bookings, inventory_locks,
--          payments, webhook_inbox, idempotency_keys, booking_timeline_events,
--          indexes, triggers, and Row Level Security policies.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEQUENCES
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.bookings_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.bookings_public_id_seq TO postgres, authenticated, service_role;

CREATE SEQUENCE IF NOT EXISTS public.payments_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.payments_public_id_seq TO postgres, authenticated, service_role;

CREATE SEQUENCE IF NOT EXISTS public.inventory_units_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.inventory_units_public_id_seq TO postgres, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 2. PACKAGES & INVENTORY TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug extensions.citext NOT NULL UNIQUE,
    tagline TEXT NULL,
    description TEXT NULL,
    price_4_hours NUMERIC(10, 2) NOT NULL CHECK (price_4_hours >= 0),
    price_8_hours NUMERIC(10, 2) NOT NULL CHECK (price_8_hours >= 0),
    price_full_day NUMERIC(10, 2) NOT NULL CHECK (price_full_day >= 0),
    featured_image_url TEXT NULL,
    gallery_urls TEXT[] NOT NULL DEFAULT '{}',
    max_guests TEXT NULL,
    sound_rating TEXT NULL,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_popular BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    
    -- Soft Delete Standard
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    deletion_reason TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.packages IS 'Rental equipment package definitions and catalog pricing.';

CREATE INDEX IF NOT EXISTS idx_packages_slug ON public.packages (slug);
CREATE INDEX IF NOT EXISTS idx_packages_active ON public.packages (tenant_id, created_at DESC) WHERE is_published = TRUE AND is_deleted = FALSE;

CREATE TRIGGER trg_packages_updated_at
    BEFORE UPDATE ON public.packages
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column('increment_version');


CREATE TABLE IF NOT EXISTS public.inventory_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('INV', 'inventory_units_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
    serial_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'READY_TO_DEPLOY' CHECK (status IN ('READY_TO_DEPLOY', 'IN_USE', 'UNDER_REPAIR', 'RETIRED')),
    condition_notes TEXT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    
    -- Soft Delete Standard
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    deletion_reason TEXT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_units_tenant_serial UNIQUE (tenant_id, serial_number)
);

COMMENT ON TABLE public.inventory_units IS 'Physical deployable karaoke equipment units.';

CREATE INDEX IF NOT EXISTS idx_inventory_units_package ON public.inventory_units (tenant_id, package_id, status) WHERE is_deleted = FALSE;

CREATE TRIGGER trg_inventory_units_updated_at
    BEFORE UPDATE ON public.inventory_units
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column('increment_version');


-- ----------------------------------------------------------------------------
-- 3. BOOKINGS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('BK', 'bookings_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
    assigned_unit_id UUID NULL REFERENCES public.inventory_units(id) ON DELETE SET NULL,
    
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN (
            'DRAFT', 'PENDING_PAYMENT', 'PAYMENT_PROCESSING', 'CONFIRMED', 
            'PREPARING', 'DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY', 'DELIVERED', 
            'RENTAL_ACTIVE', 'PICKUP_SCHEDULED', 'OUT_FOR_PICKUP', 'PICKED_UP', 
            'COMPLETED', 'CANCELLATION_REQUESTED', 'CANCELLED', 'EXPIRED', 
            'REJECTED', 'REFUNDED', 'PAYMENT_FAILED'
        )
    ),
    
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    duration_hours INTEGER NOT NULL CHECK (duration_hours >= 4),
    event_end_time TIMESTAMPTZ NOT NULL,
    
    delivery_address TEXT NOT NULL,
    delivery_zone TEXT NULL,
    special_instructions TEXT NULL,
    
    -- Financial Breakdown
    subtotal_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal_amount >= 0),
    surcharge_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (surcharge_amount >= 0),
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    grand_total NUMERIC(10, 2) NOT NULL CHECK (grand_total >= 0),
    deposit_amount NUMERIC(10, 2) NOT NULL CHECK (deposit_amount >= 0),
    balance_amount NUMERIC(10, 2) NOT NULL CHECK (balance_amount >= 0),
    
    -- Immutable Booking Snapshot (Hardening Improvement #3)
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_source public.created_source_type NOT NULL DEFAULT 'WEB'::public.created_source_type,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_bookings_deposit_balance CHECK (deposit_amount + balance_amount = grand_total)
);

COMMENT ON TABLE public.bookings IS 'Central booking records containing schedule, status state machine, financial calculation, and frozen snapshots.';

-- Indexes for bookings
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status ON public.bookings (tenant_id, status, event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON public.bookings (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON public.bookings (event_date);

CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column('increment_version');


-- ----------------------------------------------------------------------------
-- 4. INVENTORY RESERVATION LOCKS
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.inventory_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES public.packages(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.inventory_locks IS 'Temporary 15-minute soft reservation locks during checkout.';

CREATE INDEX IF NOT EXISTS idx_inventory_locks_active ON public.inventory_locks (tenant_id, package_id, expires_at);


-- ----------------------------------------------------------------------------
-- 5. PAYMENTS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('PAY', 'payments_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('deposit', 'balance', 'full', 'refund')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('gcash', 'maya', 'card', 'cash', 'bank_transfer')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded')),
    gateway_transaction_id TEXT NULL,
    gateway_response JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.payments IS 'Immutable financial transactions ledger.';

CREATE INDEX IF NOT EXISTS idx_payments_booking ON public.payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_id ON public.payments (gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;

CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


-- ----------------------------------------------------------------------------
-- 6. WEBHOOK INBOX TABLE (Hardening Improvement #2)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.webhook_inbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider TEXT NOT NULL DEFAULT 'paymongo',
    event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'poison')),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT NULL,
    next_retry_at TIMESTAMPTZ NULL,
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.webhook_inbox IS 'Decoupled webhook ingestion inbox ensuring crash survival and duplicate prevention.';

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_pending ON public.webhook_inbox (status, created_at) WHERE status IN ('pending', 'processing');


-- ----------------------------------------------------------------------------
-- 7. IDEMPOTENCY KEYS TABLE (Hardening Improvement #1)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    user_id UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    request_path TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    response_status INTEGER NULL,
    response_body JSONB NULL,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_idempotency_tenant_key UNIQUE (tenant_id, key)
);

COMMENT ON TABLE public.idempotency_keys IS 'API idempotency key registry preventing duplicate booking creation.';

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON public.idempotency_keys (tenant_id, key);


-- ----------------------------------------------------------------------------
-- 8. BOOKING TIMELINE EVENTS TABLE (Hardening Improvement #4)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.booking_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    from_status TEXT NULL,
    to_status TEXT NOT NULL,
    event_label TEXT NOT NULL,
    event_description TEXT NULL,
    performed_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    performed_by_role TEXT NULL,
    is_system_event BOOLEAN NOT NULL DEFAULT FALSE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.booking_timeline_events IS 'Immutable append-only history of booking status state transitions.';

CREATE INDEX IF NOT EXISTS idx_booking_timeline_booking ON public.booking_timeline_events (booking_id, created_at DESC);


-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY & POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_timeline_events ENABLE ROW LEVEL SECURITY;

-- Packages Policies
CREATE POLICY "Public read published packages" ON public.packages FOR SELECT TO anon, authenticated USING (is_published = TRUE AND is_deleted = FALSE);
CREATE POLICY "Service role full access packages" ON public.packages FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Bookings Policies
CREATE POLICY "Customers view own bookings" ON public.bookings FOR SELECT TO authenticated USING (customer_id = auth.uid());
CREATE POLICY "Service role full access bookings" ON public.bookings FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Timeline Events Policies (Read-only for customer, NO update/delete)
CREATE POLICY "Customers view own timeline events" ON public.booking_timeline_events FOR SELECT TO authenticated USING (
    booking_id IN (SELECT id FROM public.bookings WHERE customer_id = auth.uid())
);
CREATE POLICY "Service role full access booking_timeline_events" ON public.booking_timeline_events FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Payments Policies
CREATE POLICY "Customers view own payments" ON public.payments FOR SELECT TO authenticated USING (
    booking_id IN (SELECT id FROM public.bookings WHERE customer_id = auth.uid())
);
CREATE POLICY "Service role full access payments" ON public.payments FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);

-- Service Role ONLY Policies
CREATE POLICY "Service role full access inventory_units" ON public.inventory_units FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role full access inventory_locks" ON public.inventory_locks FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role full access webhook_inbox" ON public.webhook_inbox FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Service role full access idempotency_keys" ON public.idempotency_keys FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
