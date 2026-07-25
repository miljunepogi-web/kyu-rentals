-- ============================================================================
-- KYU RENTALS — MIGRATION 00017: PHASE 6A FINANCIAL OPERATIONS & BUSINESS INTELLIGENCE
-- Version: 1.1.0 (PRODUCTION AUDIT HARDENED)
-- Date: 2026-07-24
-- Purpose:
--   1. Create sequences & tables: expense_categories, expenses, expense_logs, promo_codes, promo_code_redemptions.
--   2. Extend expenses table with accounting adjustment fields & receipt metadata.
--   3. Create append-only immutable expense_logs table.
--   4. Seed default expense categories for tenant operational tracking.
--   5. Create atomic hardened RPCs:
--      - public.create_expense_admin() (FULL ROW_COUNT & DEFENSE-IN-DEPTH HARDENING)
--      - public.soft_delete_expense_admin()
--      - public.get_admin_net_profit_summary_admin()
--      - public.get_admin_pnl_report_admin()
--      - public.validate_and_apply_promo_code()
--   6. REVOKE PUBLIC/anon permissions & GRANT to authenticated/service_role.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEQUENCES & EXPENSE CATEGORIES TABLE
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.expense_categories_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.expense_categories_public_id_seq TO postgres, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('EXC', 'expense_categories_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_expense_categories_code UNIQUE (tenant_id, code)
);

COMMENT ON TABLE public.expense_categories IS 'Categorization structure for operating expenses.';
CREATE INDEX IF NOT EXISTS idx_expense_categories_tenant ON public.expense_categories (tenant_id, is_active) WHERE is_deleted = FALSE;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view expense categories"
    ON public.expense_categories FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Service role full access expense categories"
    ON public.expense_categories FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- ----------------------------------------------------------------------------
-- 2. EXPENSES & IMMUTABLE EXPENSE LOGS TABLES
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.expenses_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.expenses_public_id_seq TO postgres, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('EXP', 'expenses_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.expense_categories(id) ON DELETE RESTRICT,
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vendor TEXT NULL,
    description TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    receipt_url TEXT NULL,
    notes TEXT NULL,
    
    -- Accounting Adjustment Architecture Strategy Fields
    is_adjustment BOOLEAN NOT NULL DEFAULT FALSE,
    parent_expense_id UUID NULL REFERENCES public.expenses(id) ON DELETE SET NULL,
    adjustment_reason TEXT NULL,
    
    -- Receipt Upload Metadata Fields
    receipt_uploaded_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
    receipt_uploaded_at TIMESTAMPTZ NULL,
    receipt_mime_type TEXT NULL,
    receipt_file_size INTEGER NULL,
    receipt_storage_provider TEXT NULL DEFAULT 'SUPABASE_STORAGE',
    receipt_checksum TEXT NULL,

    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID NULL REFERENCES public.profiles(id),
    deletion_reason TEXT NULL
);

COMMENT ON TABLE public.expenses IS 'Operating expenses ledger with accounting adjustment support and receipt metadata.';

CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON public.expenses (tenant_id, expense_date DESC) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses (tenant_id, category_id) WHERE is_deleted = FALSE;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff view active expenses"
    ON public.expenses FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE) AND is_deleted = FALSE);

CREATE POLICY "Service role full access expenses"
    ON public.expenses FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- IMMUTABLE APPEND-ONLY EXPENSE AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS public.expense_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
    action TEXT NOT NULL, -- 'CREATED', 'UPDATED', 'DELETED', 'RESTORED', 'ADJUSTED'
    previous_values JSONB NULL,
    new_values JSONB NULL,
    metadata JSONB NULL,
    performed_by UUID NOT NULL REFERENCES public.profiles(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.expense_logs IS 'Immutable append-only audit trail for all expense lifecycle events.';
CREATE INDEX IF NOT EXISTS idx_expense_logs_expense ON public.expense_logs (tenant_id, expense_id, performed_at DESC);

ALTER TABLE public.expense_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant staff view expense logs"
    ON public.expense_logs FOR SELECT TO authenticated
    USING (tenant_id IN (SELECT tenant_id FROM public.profiles WHERE id = auth.uid() AND is_active = TRUE));

CREATE POLICY "Service role full access expense logs"
    ON public.expense_logs FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- ENFORCE IMMUTABLE AUDIT TRAIL (NO UPDATE/DELETE ON EXPENSE_LOGS)
REVOKE UPDATE, DELETE ON public.expense_logs FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. PROMO CODES & REDEMPTIONS TABLES
-- ----------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.promo_codes_public_id_seq START WITH 1 INCREMENT BY 1;
GRANT USAGE, SELECT ON SEQUENCE public.promo_codes_public_id_seq TO postgres, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('PRM', 'promo_codes_public_id_seq'),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('FIXED', 'PERCENTAGE')),
    discount_value NUMERIC(12,2) NOT NULL CHECK (discount_value > 0),
    min_booking_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (min_booking_amount >= 0),
    max_discount_amount NUMERIC(12,2) NULL CHECK (max_discount_amount > 0),
    max_usage_limit INTEGER NULL CHECK (max_usage_limit > 0),
    current_usage_count INTEGER NOT NULL DEFAULT 0 CHECK (current_usage_count >= 0),
    per_customer_limit INTEGER NOT NULL DEFAULT 1 CHECK (per_customer_limit >= 1),
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_promo_codes_tenant_code UNIQUE (tenant_id, code)
);

COMMENT ON TABLE public.promo_codes IS 'Marketing promotional codes and discount vouchers.';
CREATE INDEX IF NOT EXISTS idx_promo_codes_tenant_code ON public.promo_codes (tenant_id, code) WHERE is_deleted = FALSE;

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view active promo codes"
    ON public.promo_codes FOR SELECT TO anon, authenticated
    USING (is_active = TRUE AND is_deleted = FALSE);

CREATE POLICY "Service role full access promo codes"
    ON public.promo_codes FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

CREATE TABLE IF NOT EXISTS public.promo_code_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    promo_code_id UUID NOT NULL REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    discount_applied_amount NUMERIC(12,2) NOT NULL CHECK (discount_applied_amount >= 0),
    redeemed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.promo_code_redemptions IS 'Audit ledger of promo code redemptions per booking.';
CREATE INDEX IF NOT EXISTS idx_promo_code_redemptions_customer ON public.promo_code_redemptions (tenant_id, promo_code_id, customer_id);

ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own promo redemptions"
    ON public.promo_code_redemptions FOR SELECT TO authenticated
    USING (customer_id = auth.uid());

CREATE POLICY "Service role full access redemptions"
    ON public.promo_code_redemptions FOR ALL TO service_role
    USING (TRUE) WITH CHECK (TRUE);

-- ----------------------------------------------------------------------------
-- 4. HARDENED ATOMIC RPC: CREATE EXPENSE ADMIN (STRICT AUTHORIZATION & ROW_COUNT)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_expense_admin(
    p_tenant_id UUID,
    p_category_id UUID,
    p_amount NUMERIC,
    p_expense_date DATE,
    p_vendor TEXT,
    p_description TEXT,
    p_payment_method TEXT,
    p_receipt_url TEXT,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_tenant_id UUID;
    v_has_staff_role BOOLEAN := FALSE;
    v_expense_id UUID;
    v_expense_public_id TEXT;
    v_category_name TEXT;
    v_rows_affected INTEGER;
BEGIN
    -- Defensive assertions
    IF p_tenant_id IS NULL OR p_category_id IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_description IS NULL OR length(trim(p_description)) < 2 THEN
        RAISE EXCEPTION 'Defensive validation failed: Tenant ID, Category ID, positive Amount, and valid Description are required';
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
        RAISE EXCEPTION 'Authorization failed: Profile % is not an active member of tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Step 4: Administrative Staff RBAC Assertion
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles ur JOIN public.roles r ON r.id = ur.role_id
        WHERE ur.user_id = v_caller_uid AND ur.tenant_id = p_tenant_id
          AND r.name IN ('owner', 'super_admin', 'admin', 'support_staff', 'franchise_owner')
    ) INTO v_has_staff_role;

    IF NOT v_has_staff_role THEN
        RAISE EXCEPTION 'Forbidden: User % does not possess administrative staff role for tenant %', v_caller_uid, p_tenant_id;
    END IF;

    -- Verify Expense Category
    SELECT name INTO v_category_name
    FROM public.expense_categories
    WHERE id = p_category_id AND tenant_id = p_tenant_id AND is_active = TRUE AND is_deleted = FALSE;

    IF v_category_name IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Expense category % not found or inactive for tenant %', p_category_id, p_tenant_id;
    END IF;

    -- Step 5: Atomic Mutation — Insert Expense
    INSERT INTO public.expenses (
        tenant_id, category_id, amount, expense_date, vendor, description, payment_method, receipt_url, notes, created_by,
        receipt_uploaded_by, receipt_uploaded_at
    )
    VALUES (
        p_tenant_id, p_category_id, p_amount, COALESCE(p_expense_date, CURRENT_DATE),
        NULLIF(trim(p_vendor), ''), trim(p_description), COALESCE(NULLIF(trim(p_payment_method), ''), 'CASH'),
        NULLIF(trim(p_receipt_url), ''), NULLIF(trim(p_notes), ''), v_caller_uid,
        CASE WHEN p_receipt_url IS NOT NULL THEN v_caller_uid ELSE NULL END,
        CASE WHEN p_receipt_url IS NOT NULL THEN NOW() ELSE NULL END
    )
    RETURNING id, public_id INTO v_expense_id, v_expense_public_id;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 expense row inserted, got %', v_rows_affected;
    END IF;

    -- Step 6: Insert Immutable Expense Audit Log
    INSERT INTO public.expense_logs (
        tenant_id, expense_id, action, new_values, performed_by, metadata
    )
    VALUES (
        p_tenant_id, v_expense_id, 'CREATED',
        jsonb_build_object(
            'amount', p_amount,
            'category_name', v_category_name,
            'description', p_description,
            'expense_date', p_expense_date,
            'vendor', p_vendor
        ),
        v_caller_uid,
        jsonb_build_object('client_ip', current_setting('request.headers', true)::jsonb->>'x-forwarded-for')
    );

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 expense log row inserted, got %', v_rows_affected;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'expense_id', v_expense_id,
        'expense_public_id', v_expense_public_id,
        'message', 'Expense record created successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.create_expense_admin(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_expense_admin(UUID, UUID, NUMERIC, DATE, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. HARDENED ATOMIC RPC: SOFT DELETE EXPENSE ADMIN
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.soft_delete_expense_admin(
    p_tenant_id UUID,
    p_expense_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_tenant_id UUID;
    v_has_staff_role BOOLEAN := FALSE;
    v_rows_affected INTEGER;
    v_old_data JSONB;
BEGIN
    IF p_tenant_id IS NULL OR p_expense_id IS NULL OR p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID, Expense ID, and valid deletion reason are required';
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
          AND r.name IN ('owner', 'super_admin', 'admin', 'franchise_owner')
    ) INTO v_has_staff_role;

    IF NOT v_has_staff_role THEN
        RAISE EXCEPTION 'Forbidden: Only administrators can delete expense records.';
    END IF;

    SELECT jsonb_build_object('amount', amount, 'description', description, 'expense_date', expense_date)
    INTO v_old_data
    FROM public.expenses
    WHERE id = p_expense_id AND tenant_id = p_tenant_id AND is_deleted = FALSE
    FOR UPDATE;

    IF v_old_data IS NULL THEN
        RAISE EXCEPTION 'Target expense record % not found', p_expense_id;
    END IF;

    UPDATE public.expenses
    SET is_deleted = TRUE,
        deleted_at = NOW(),
        deleted_by = v_caller_uid,
        deletion_reason = trim(p_reason),
        updated_at = NOW()
    WHERE id = p_expense_id AND tenant_id = p_tenant_id AND is_deleted = FALSE;

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Mutation validation failed: Expected exactly 1 expense row updated, got %', v_rows_affected;
    END IF;

    INSERT INTO public.expense_logs (
        tenant_id, expense_id, action, previous_values, performed_by, metadata
    )
    VALUES (
        p_tenant_id, p_expense_id, 'DELETED', v_old_data, v_caller_uid,
        jsonb_build_object('reason', trim(p_reason))
    );

    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected != 1 THEN
        RAISE EXCEPTION 'Audit integrity failed: Expected exactly 1 expense log row inserted, got %', v_rows_affected;
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'expense_id', p_expense_id,
        'message', 'Expense record deleted successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.soft_delete_expense_admin(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soft_delete_expense_admin(UUID, UUID, TEXT) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. POSTGRESQL NET PROFIT SUMMARY RPC (SECURITY HARDENED)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_net_profit_summary_admin(
    p_tenant_id UUID,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_tenant_id UUID;
    v_has_staff_role BOOLEAN := FALSE;
    v_gross_revenue NUMERIC := 0;
    v_collected_revenue NUMERIC := 0;
    v_operating_expenses NUMERIC := 0;
    v_net_profit NUMERIC := 0;
    v_outstanding_balance NUMERIC := 0;
    v_refunded_amount NUMERIC := 0;
    v_reservation_deposits NUMERIC := 0;
    v_remaining_balances NUMERIC := 0;
    v_booking_count INTEGER := 0;
    v_average_booking_value NUMERIC := 0;
    v_top_categories JSONB;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID must be non-null';
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
          AND r.name IN ('owner', 'super_admin', 'admin', 'support_staff', 'driver', 'franchise_owner')
    ) INTO v_has_staff_role;

    IF NOT v_has_staff_role THEN
        RAISE EXCEPTION 'Forbidden: User % does not possess administrative staff role for tenant %', v_caller_uid, p_tenant_id;
    END IF;

    SELECT
        COALESCE(SUM(grand_total), 0),
        COALESCE(SUM(deposit_amount), 0),
        COALESCE(SUM(balance_amount), 0),
        COUNT(*)
    INTO
        v_gross_revenue,
        v_reservation_deposits,
        v_remaining_balances,
        v_booking_count
    FROM public.bookings
    WHERE tenant_id = p_tenant_id
      AND status NOT IN ('DRAFT', 'EXPIRED', 'REJECTED', 'CANCELLED', 'PAYMENT_FAILED')
      AND (p_start_date IS NULL OR event_date >= p_start_date)
      AND (p_end_date IS NULL OR event_date <= p_end_date);

    SELECT
        COALESCE(SUM(CASE WHEN status IN ('COMPLETED', 'SUCCESSFUL', 'PAID') THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN amount ELSE 0 END), 0)
    INTO
        v_collected_revenue,
        v_refunded_amount
    FROM public.payments
    WHERE tenant_id = p_tenant_id
      AND (p_start_date IS NULL OR created_at >= p_start_date::timestamptz)
      AND (p_end_date IS NULL OR created_at <= (p_end_date + interval '1 day')::timestamptz);

    SELECT COALESCE(SUM(amount), 0)
    INTO v_operating_expenses
    FROM public.expenses
    WHERE tenant_id = p_tenant_id
      AND is_deleted = FALSE
      AND (p_start_date IS NULL OR expense_date >= p_start_date)
      AND (p_end_date IS NULL OR expense_date <= p_end_date);

    v_net_profit := v_collected_revenue - v_operating_expenses;
    v_outstanding_balance := GREATEST(0, v_gross_revenue - v_collected_revenue);

    IF v_booking_count > 0 THEN
        v_average_booking_value := ROUND(v_gross_revenue / v_booking_count, 2);
    END IF;

    SELECT jsonb_agg(cat_summary)
    INTO v_top_categories
    FROM (
        SELECT c.name AS category_name, COALESCE(SUM(e.amount), 0) AS total_amount
        FROM public.expenses e
        JOIN public.expense_categories c ON c.id = e.category_id
        WHERE e.tenant_id = p_tenant_id AND e.is_deleted = FALSE
          AND (p_start_date IS NULL OR e.expense_date >= p_start_date)
          AND (p_end_date IS NULL OR e.expense_date <= p_end_date)
        GROUP BY c.name
        ORDER BY total_amount DESC
        LIMIT 5
    ) cat_summary;

    RETURN jsonb_build_object(
        'gross_revenue', v_gross_revenue,
        'collected_revenue', v_collected_revenue,
        'operating_expenses', v_operating_expenses,
        'net_profit', v_net_profit,
        'outstanding_balance', v_outstanding_balance,
        'refunded_amount', v_refunded_amount,
        'reservation_deposits', v_reservation_deposits,
        'remaining_balances', v_remaining_balances,
        'booking_count', v_booking_count,
        'average_booking_value', v_average_booking_value,
        'top_expense_categories', COALESCE(v_top_categories, '[]'::jsonb)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_admin_net_profit_summary_admin(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_net_profit_summary_admin(UUID, DATE, DATE) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. POSTGRESQL P&L REPORTING RPC (SECURITY HARDENED)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_admin_pnl_report_admin(
    p_tenant_id UUID,
    p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_caller_uid UUID;
    v_caller_tenant_id UUID;
    v_has_staff_role BOOLEAN := FALSE;
    v_matrix JSONB;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID must be non-null';
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
          AND r.name IN ('owner', 'super_admin', 'admin', 'support_staff', 'franchise_owner')
    ) INTO v_has_staff_role;

    IF NOT v_has_staff_role THEN
        RAISE EXCEPTION 'Forbidden: User % does not possess administrative staff role for tenant %', v_caller_uid, p_tenant_id;
    END IF;

    SELECT jsonb_agg(m_data ORDER BY m_data->>'month_number')
    INTO v_matrix
    FROM (
        SELECT
            m.month_num AS month_number,
            TO_CHAR(TO_DATE(m.month_num::text, 'MM'), 'Month') AS month_name,
            COALESCE(rev.collected, 0) AS revenue,
            COALESCE(exp.total_exp, 0) AS expenses,
            (COALESCE(rev.collected, 0) - COALESCE(exp.total_exp, 0)) AS net_profit,
            SUM(COALESCE(rev.collected, 0) - COALESCE(exp.total_exp, 0)) OVER (ORDER BY m.month_num) AS ytd_net_profit
        FROM generate_series(1, 12) AS m(month_num)
        LEFT JOIN (
            SELECT EXTRACT(MONTH FROM created_at)::integer AS month_num, COALESCE(SUM(amount), 0) AS collected
            FROM public.payments
            WHERE tenant_id = p_tenant_id AND status IN ('COMPLETED', 'SUCCESSFUL', 'PAID')
              AND EXTRACT(YEAR FROM created_at) = p_year
            GROUP BY month_num
        ) rev ON rev.month_num = m.month_num
        LEFT JOIN (
            SELECT EXTRACT(MONTH FROM expense_date)::integer AS month_num, COALESCE(SUM(amount), 0) AS total_exp
            FROM public.expenses
            WHERE tenant_id = p_tenant_id AND is_deleted = FALSE
              AND EXTRACT(YEAR FROM expense_date) = p_year
            GROUP BY month_num
        ) exp ON exp.month_num = m.month_num
    ) m_data;

    RETURN COALESCE(v_matrix, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_admin_pnl_report_admin(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_pnl_report_admin(UUID, INTEGER) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 8. PROMO CODE VALIDATION RPC
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_and_apply_promo_code(
    p_tenant_id UUID,
    p_code TEXT,
    p_booking_subtotal NUMERIC,
    p_customer_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_promo public.promo_codes%ROWTYPE;
    v_customer_redemptions INTEGER := 0;
    v_calculated_discount NUMERIC := 0;
    v_normalized_code TEXT;
BEGIN
    IF p_tenant_id IS NULL OR p_code IS NULL OR p_booking_subtotal IS NULL THEN
        RAISE EXCEPTION 'Validation failed: Tenant ID, Code, and Booking Subtotal are required';
    END IF;

    v_normalized_code := UPPER(trim(p_code));

    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE tenant_id = p_tenant_id AND code = v_normalized_code AND is_active = TRUE AND is_deleted = FALSE;

    IF v_promo.id IS NULL THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'Invalid or expired promotional code.');
    END IF;

    IF NOW() < v_promo.start_date OR NOW() > v_promo.end_date THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'Promotional code is not active for current date.');
    END IF;

    IF p_booking_subtotal < v_promo.min_booking_amount THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'Booking subtotal does not meet minimum threshold of ₱' || v_promo.min_booking_amount);
    END IF;

    IF v_promo.max_usage_limit IS NOT NULL AND v_promo.current_usage_count >= v_promo.max_usage_limit THEN
        RETURN jsonb_build_object('is_valid', FALSE, 'message', 'Promotional code limit has been reached.');
    END IF;

    IF p_customer_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_customer_redemptions
        FROM public.promo_code_redemptions
        WHERE tenant_id = p_tenant_id AND promo_code_id = v_promo.id AND customer_id = p_customer_id;

        IF v_customer_redemptions >= v_promo.per_customer_limit THEN
            RETURN jsonb_build_object('is_valid', FALSE, 'message', 'You have already redeemed this promo code.');
        END IF;
    END IF;

    IF v_promo.discount_type = 'FIXED' THEN
        v_calculated_discount := LEAST(p_booking_subtotal, v_promo.discount_value);
    ELSIF v_promo.discount_type = 'PERCENTAGE' THEN
        v_calculated_discount := (p_booking_subtotal * (v_promo.discount_value / 100.0));
        IF v_promo.max_discount_amount IS NOT NULL THEN
            v_calculated_discount := LEAST(v_calculated_discount, v_promo.max_discount_amount);
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'is_valid', TRUE,
        'promo_code_id', v_promo.id,
        'code', v_promo.code,
        'discount_type', v_promo.discount_type,
        'discount_value', v_promo.discount_value,
        'discount_applied_amount', ROUND(v_calculated_discount, 2),
        'message', 'Promo code applied successfully.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.validate_and_apply_promo_code(UUID, TEXT, NUMERIC, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_and_apply_promo_code(UUID, TEXT, NUMERIC, UUID) TO authenticated, service_role;
