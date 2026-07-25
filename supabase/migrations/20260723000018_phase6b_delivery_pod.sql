-- ============================================================================
-- KYU RENTALS — MIGRATION 00018: PHASE 6B DIGITAL DELIVERY OPERATIONS & POD
-- Version: 1.0.0
-- Date: 2026-07-24
-- Purpose:
--   1. Create sequences & tables:
--      - public.delivery_checklists
--      - public.proof_of_deliveries (with signature metadata)
--      - public.proof_of_delivery_photos (multi-photo setup evidence)
--      - public.incidents (equipment damage & incident ledger)
--      - public.incident_photos (supporting damage photos)
--   2. Create RLS policies for tenant data isolation and staff operations.
--   3. Create atomic hardened RPCs:
--      - public.submit_proof_of_delivery_admin()
--      - public.report_incident_admin()
--   4. REVOKE PUBLIC/anon permissions & GRANT to authenticated/service_role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEQUENCES
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.delivery_checklists_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.delivery_checklists_public_id_seq TO postgres, authenticated, service_role;

CREATE SEQUENCE IF NOT EXISTS public.proof_of_deliveries_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.proof_of_deliveries_public_id_seq TO postgres, authenticated, service_role;

CREATE SEQUENCE IF NOT EXISTS public.proof_of_delivery_photos_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.proof_of_delivery_photos_public_id_seq TO postgres, authenticated, service_role;

CREATE SEQUENCE IF NOT EXISTS public.incidents_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.incidents_public_id_seq TO postgres, authenticated, service_role;

CREATE SEQUENCE IF NOT EXISTS public.incident_photos_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.incident_photos_public_id_seq TO postgres, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 2. DELIVERY CHECKLISTS TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.delivery_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('CHK', 'delivery_checklists_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    checklist_type TEXT NOT NULL CHECK (checklist_type IN ('PRE_DELIVERY', 'POST_PICKUP')),
    microphones_ok BOOLEAN NOT NULL DEFAULT TRUE,
    speakers_ok BOOLEAN NOT NULL DEFAULT TRUE,
    display_screen_ok BOOLEAN NOT NULL DEFAULT TRUE,
    cables_remote_ok BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NULL,
    inspected_by UUID NOT NULL REFERENCES public.profiles(id),
    inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.delivery_checklists IS 'Equipment component health verification checklist logs.';
CREATE INDEX IF NOT EXISTS idx_delivery_checklists_booking ON public.delivery_checklists (tenant_id, booking_id, checklist_type);

ALTER TABLE public.delivery_checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff view delivery checklists"
    ON public.delivery_checklists FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Service role full access delivery checklists"
    ON public.delivery_checklists FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- ----------------------------------------------------------------------------
-- 3. PROOF OF DELIVERIES & PHOTOS TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.proof_of_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('POD', 'proof_of_deliveries_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    customer_signature_url TEXT NULL,
    
    -- Digital Signature Audit Metadata Fields
    signed_at TIMESTAMPTZ NULL,
    signer_name TEXT NULL,
    signer_contact TEXT NULL,
    device_type TEXT NULL,
    signature_version TEXT NULL DEFAULT 'V1',
    
    notes TEXT NULL,
    delivered_by UUID NOT NULL REFERENCES public.profiles(id),
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.proof_of_deliveries IS 'Digital proof of delivery handover record with customer signature metadata.';
CREATE INDEX IF NOT EXISTS idx_proof_of_deliveries_booking ON public.proof_of_deliveries (tenant_id, booking_id);

ALTER TABLE public.proof_of_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff view proof of deliveries"
    ON public.proof_of_deliveries FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Customers view own booking PoD"
    ON public.proof_of_deliveries FOR SELECT TO authenticated
    USING (booking_id IN (SELECT id FROM public.bookings WHERE customer_id = auth.uid()));

CREATE POLICY "Service role full access proof of deliveries"
    ON public.proof_of_deliveries FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

CREATE TABLE IF NOT EXISTS public.proof_of_delivery_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('PDP', 'proof_of_delivery_photos_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    pod_id UUID NOT NULL REFERENCES public.proof_of_deliveries(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type TEXT NOT NULL DEFAULT 'SETUP' CHECK (photo_type IN ('FRONT_SETUP', 'SPEAKER_PLACEMENT', 'TV_DISPLAY', 'MICROPHONES', 'SETUP')),
    caption TEXT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.proof_of_delivery_photos IS 'Multiple supporting photo evidence attached to proof of delivery.';
CREATE INDEX IF NOT EXISTS idx_pod_photos_pod ON public.proof_of_delivery_photos (tenant_id, pod_id);

ALTER TABLE public.proof_of_delivery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff view pod photos"
    ON public.proof_of_delivery_photos FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Service role full access pod photos"
    ON public.proof_of_delivery_photos FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- ----------------------------------------------------------------------------
-- 4. INCIDENTS & INCIDENT PHOTOS TABLES
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('INC', 'incidents_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    unit_id UUID NULL REFERENCES public.inventory_units(id) ON DELETE SET NULL,
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    incident_type TEXT NOT NULL CHECK (incident_type IN ('DAMAGE', 'MISSING_ITEM', 'EQUIPMENT_FAILURE', 'ACCIDENT')),
    description TEXT NOT NULL,
    estimated_cost NUMERIC(12,2) NULL CHECK (estimated_cost >= 0),
    status TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'UNDER_REVIEW', 'RESOLVED')),
    reported_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.incidents IS 'Equipment damage and operational incident tracking ledger.';
CREATE INDEX IF NOT EXISTS idx_incidents_booking ON public.incidents (tenant_id, booking_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents (tenant_id, status, severity);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff view incidents"
    ON public.incidents FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Service role full access incidents"
    ON public.incidents FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

CREATE TABLE IF NOT EXISTS public.incident_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('INP', 'incident_photos_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    caption TEXT NULL,
    uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.incident_photos IS 'Supporting photo evidence attached to damage incidents.';
CREATE INDEX IF NOT EXISTS idx_incident_photos_incident ON public.incident_photos (tenant_id, incident_id);

ALTER TABLE public.incident_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff view incident photos"
    ON public.incident_photos FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Service role full access incident photos"
    ON public.incident_photos FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- ----------------------------------------------------------------------------
-- 5. HARDENED ATOMIC RPC: SUBMIT PROOF OF DELIVERY ADMIN
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_proof_of_delivery_admin(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_signature_url TEXT,
    p_photo_url TEXT,
    p_signer_name TEXT,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_tenant_id UUID;
    v_has_staff_role BOOLEAN := FALSE;
    v_current_status TEXT;
    v_booking_public_id TEXT;
    v_pod_id UUID;
    v_pod_public_id TEXT;
    v_rows_affected INTEGER;
BEGIN
    IF p_tenant_id IS NULL OR p_booking_id IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID and Booking ID are required';
    END IF;

    -- Step 1: Session Verification
    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: No authenticated session found';
    END IF;

    -- Step 2 & 3: Profile Existence & Tenant Ownership Verification
    SELECT tenant_id INTO v_caller_tenant_id
    FROM public.profiles
    WHERE id = v_caller_uid AND tenant_id = p_tenant_id AND is_active = TRUE AND is_deleted = FALSE;

    IF v_caller_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: Profile % is not active member of tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Step 4: Administrative Staff / Driver RBAC Assertion
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_caller_uid AND ur.tenant_id = p_tenant_id
          AND r.name IN ('owner', 'super_admin', 'admin', 'driver', 'support_staff', 'franchise_owner')
    ) INTO v_has_staff_role;

    IF NOT v_has_staff_role THEN
        RAISE EXCEPTION 'Forbidden: User % does not possess delivery or staff role for tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Lock Booking Row & Check Valid Status
    SELECT status, public_id INTO v_current_status, v_booking_public_id
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = p_tenant_id
    FOR UPDATE;

    IF v_current_status IS NULL THEN
        RAISE EXCEPTION 'Target booking % not found', p_booking_id;
    END IF;

    IF v_current_status NOT IN ('DRIVER_ASSIGNED', 'OUT_FOR_DELIVERY') THEN
        RAISE EXCEPTION 'Transition rejected: Cannot submit Proof of Delivery for booking % in status "%". Status must be DRIVER_ASSIGNED or OUT_FOR_DELIVERY.',
            v_booking_public_id, v_current_status;
    END IF;

    -- Step 5: Update Booking Status -> RENTAL_ACTIVE
    UPDATE public.bookings
    SET status = 'RENTAL_ACTIVE',
        updated_at = NOW()
    WHERE id = p_booking_id AND tenant_id = p_tenant_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 booking row updated, got %', v_rows_affected;
    END IF;

    -- Insert Proof of Delivery Record
    INSERT INTO public.proof_of_deliveries (
        tenant_id, booking_id, customer_signature_url, signed_at, signer_name, notes, delivered_by
    )
    VALUES (
        p_tenant_id, p_booking_id, NULLIF(trim(p_signature_url), ''),
        CASE WHEN p_signature_url IS NOT NULL THEN NOW() ELSE NULL END,
        NULLIF(trim(p_signer_name), ''), NULLIF(trim(p_notes), ''), v_caller_uid
    )
    RETURNING id, public_id INTO v_pod_id, v_pod_public_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 PoD row inserted, got %', v_rows_affected;
    END IF;

    -- Insert Primary Setup Photo if provided
    IF p_photo_url IS NOT NULL AND length(trim(p_photo_url)) > 0 THEN
        INSERT INTO public.proof_of_delivery_photos (
            tenant_id, pod_id, photo_url, photo_type, caption, uploaded_by
        )
        VALUES (
            p_tenant_id, v_pod_id, trim(p_photo_url), 'SETUP', 'Completed Equipment Setup Photo', v_caller_uid
        );
    END IF;

    -- Insert Booking Timeline Event
    INSERT INTO public.booking_timeline_events (
        tenant_id, booking_id, from_status, to_status, event_label, event_description, performed_by, performed_by_role
    )
    VALUES (
        p_tenant_id, p_booking_id, v_current_status, 'RENTAL_ACTIVE',
        'Proof of Delivery Submitted',
        'Equipment handed over to customer. Rental is now active.',
        v_caller_uid, 'driver'
    );

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 timeline event row inserted, got %', v_rows_affected;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'booking_id', p_booking_id,
        'pod_id', v_pod_id,
        'pod_public_id', v_pod_public_id,
        'previous_status', v_current_status,
        'new_status', 'RENTAL_ACTIVE',
        'message', 'Proof of delivery submitted successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.submit_proof_of_delivery_admin(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_proof_of_delivery_admin(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. HARDENED ATOMIC RPC: REPORT INCIDENT ADMIN
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.report_incident_admin(
    p_tenant_id UUID,
    p_booking_id UUID,
    p_unit_id UUID,
    p_severity TEXT,
    p_incident_type TEXT,
    p_description TEXT,
    p_estimated_cost NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_tenant_id UUID;
    v_has_staff_role BOOLEAN := FALSE;
    v_incident_id UUID;
    v_incident_public_id TEXT;
    v_rows_affected INTEGER;
BEGIN
    IF p_tenant_id IS NULL OR p_booking_id IS NULL OR p_severity IS NULL OR p_incident_type IS NULL OR p_description IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID, Booking ID, Severity, Type, and Description are required';
    END IF;

    v_caller_uid := auth.uid();
    IF v_caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: No authenticated session found';
    END IF;

    SELECT tenant_id INTO v_caller_tenant_id
    FROM public.profiles
    WHERE id = v_caller_uid AND tenant_id = p_tenant_id AND is_active = TRUE AND is_deleted = FALSE;

    IF v_caller_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Authorization failed: Profile % is not active member of tenant %', v_caller_uid, p_tenant_id;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_caller_uid AND ur.tenant_id = p_tenant_id
          AND r.name IN ('owner', 'super_admin', 'admin', 'driver', 'support_staff', 'franchise_owner')
    ) INTO v_has_staff_role;

    IF NOT v_has_staff_role THEN
        RAISE EXCEPTION 'Forbidden: User % does not possess staff or driver role for tenant %', v_caller_uid, p_tenant_id;
    END IF;

    INSERT INTO public.incidents (
        tenant_id, booking_id, unit_id, severity, incident_type, description, estimated_cost, reported_by
    )
    VALUES (
        p_tenant_id, p_booking_id, p_unit_id, p_severity, p_incident_type, trim(p_description),
        p_estimated_cost, v_caller_uid
    )
    RETURNING id, public_id INTO v_incident_id, v_incident_public_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 incident row inserted, got %', v_rows_affected;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'incident_id', v_incident_id,
        'incident_public_id', v_incident_public_id,
        'message', 'Incident report created successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.report_incident_admin(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_incident_admin(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC) TO authenticated, service_role;
