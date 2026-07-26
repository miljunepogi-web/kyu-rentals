import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminNetProfitSummary {
  grossRevenue: number;
  collectedRevenue: number;
  operatingExpenses: number;
  netProfit: number;
  outstandingBalance: number;
  refundedAmount: number;
  reservationDeposits: number;
  remainingBalances: number;
  bookingCount: number;
  averageBookingValue: number;
  topExpenseCategories: {
    categoryName: string;
    totalAmount: number;
  }[];
}

export interface PnLMonthlyRow {
  monthNumber: number;
  monthName: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  ytdNetProfit: number;
}

export interface AdminExpenseListItem {
  id: string;
  publicId: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  expenseDate: string;
  vendor: string | null;
  description: string;
  paymentMethod: string;
  receiptUrl: string | null;
  createdAt: string;
}

export interface AdminExpenseCategoryItem {
  id: string;
  publicId: string;
  name: string;
  code: string;
  description: string | null;
}

export interface AdminPromoCodeItem {
  id: string;
  publicId: string;
  code: string;
  discountType: "FIXED" | "PERCENTAGE";
  discountValue: number;
  minBookingAmount: number;
  maxDiscountAmount: number | null;
  maxUsageLimit: number | null;
  currentUsageCount: number;
  perCustomerLimit: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveTenantId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  type ProfileRow = { tenant_id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .eq("is_deleted", false)
    .maybeSingle() as { data: ProfileRow | null };

  return profile?.tenant_id || null;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch Net Profit summary computed exclusively inside PostgreSQL RPC.
 */
export async function getAdminNetProfitSummary(
  startDate?: string,
  endDate?: string
): Promise<AdminNetProfitSummary> {
  const emptySummary: AdminNetProfitSummary = {
    grossRevenue: 0,
    collectedRevenue: 0,
    operatingExpenses: 0,
    netProfit: 0,
    outstandingBalance: 0,
    refundedAmount: 0,
    reservationDeposits: 0,
    remainingBalances: 0,
    bookingCount: 0,
    averageBookingValue: 0,
    topExpenseCategories: [],
  };

  const tenantId = await resolveTenantId();
  if (!tenantId) return emptySummary;

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
    "get_admin_net_profit_summary_admin",
    {
      p_tenant_id: tenantId,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
    }
  );

  if (rpcError || !rpcResult) return emptySummary;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = rpcResult as any;
  return {
    grossRevenue: Number(r.gross_revenue) || 0,
    collectedRevenue: Number(r.collected_revenue) || 0,
    operatingExpenses: Number(r.operating_expenses) || 0,
    netProfit: Number(r.net_profit) || 0,
    outstandingBalance: Number(r.outstanding_balance) || 0,
    refundedAmount: Number(r.refunded_amount) || 0,
    reservationDeposits: Number(r.reservation_deposits) || 0,
    remainingBalances: Number(r.remaining_balances) || 0,
    bookingCount: Number(r.booking_count) || 0,
    averageBookingValue: Number(r.average_booking_value) || 0,
    topExpenseCategories: ((r.top_expense_categories as Array<{ category_name: string; total_amount: number }>) || []).map((c) => ({
      categoryName: c.category_name,
      totalAmount: Number(c.total_amount) || 0,
    })),
  };
}

/**
 * Fetch 12-month P&L matrix computed exclusively inside PostgreSQL RPC.
 */
export async function getAdminPnLReport(year?: number): Promise<PnLMonthlyRow[]> {
  const tenantId = await resolveTenantId();
  if (!tenantId) return [];

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
    "get_admin_pnl_report_admin",
    {
      p_tenant_id: tenantId,
      p_year: year || new Date().getFullYear(),
    }
  );

  if (rpcError || !rpcResult || !Array.isArray(rpcResult)) return [];

  interface RawPnLRecord {
    month_number: number;
    month_name: string;
    revenue: number;
    expenses: number;
    net_profit: number;
    ytd_net_profit: number;
  }

  return (rpcResult as RawPnLRecord[]).map((m) => ({
    monthNumber: Number(m.month_number) || 0,
    monthName: String(m.month_name).trim(),
    revenue: Number(m.revenue) || 0,
    expenses: Number(m.expenses) || 0,
    netProfit: Number(m.net_profit) || 0,
    ytdNetProfit: Number(m.ytd_net_profit) || 0,
  }));
}

/**
 * Fetch list of expenses joined with category names.
 */
export async function getAdminExpenses(): Promise<AdminExpenseListItem[]> {
  const supabase = createClient();

  type ExpenseRow = {
    id: string;
    public_id: string;
    category_id: string;
    amount: number;
    expense_date: string;
    vendor: string | null;
    description: string;
    payment_method: string;
    receipt_url: string | null;
    created_at: string;
    expense_categories: { name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("expenses")
    .select(`
      id, public_id, category_id, amount, expense_date, vendor, description,
      payment_method, receipt_url, created_at,
      expense_categories!category_id (name)
    `)
    .eq("is_deleted", false)
    .order("expense_date", { ascending: false }) as { data: ExpenseRow[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((e) => ({
    id: e.id,
    publicId: e.public_id,
    categoryId: e.category_id,
    categoryName: e.expense_categories?.name || "General Expense",
    amount: Number(e.amount) || 0,
    expenseDate: e.expense_date,
    vendor: e.vendor,
    description: e.description,
    paymentMethod: e.payment_method,
    receiptUrl: e.receipt_url,
    createdAt: e.created_at,
  }));
}

/**
 * Fetch active expense categories.
 */
export async function getAdminExpenseCategories(): Promise<AdminExpenseCategoryItem[]> {
  const supabase = createClient();

  type CategoryRow = {
    id: string;
    public_id: string;
    name: string;
    code: string;
    description: string | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("expense_categories")
    .select("id, public_id, name, code, description")
    .eq("is_deleted", false)
    .eq("is_active", true)
    .order("name", { ascending: true }) as { data: CategoryRow[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((c) => ({
    id: c.id,
    publicId: c.public_id,
    name: c.name,
    code: c.code,
    description: c.description,
  }));
}

/**
 * Fetch active promo code campaigns.
 */
export async function getAdminPromoCodes(): Promise<AdminPromoCodeItem[]> {
  const supabase = createClient();

  type PromoRow = {
    id: string;
    public_id: string;
    code: string;
    discount_type: "FIXED" | "PERCENTAGE";
    discount_value: number;
    min_booking_amount: number;
    max_discount_amount: number | null;
    max_usage_limit: number | null;
    current_usage_count: number;
    per_customer_limit: number;
    start_date: string;
    end_date: string;
    is_active: boolean;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("promo_codes")
    .select("id, public_id, code, discount_type, discount_value, min_booking_amount, max_discount_amount, max_usage_limit, current_usage_count, per_customer_limit, start_date, end_date, is_active")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false }) as { data: PromoRow[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    publicId: p.public_id,
    code: p.code,
    discountType: p.discount_type,
    discountValue: Number(p.discount_value) || 0,
    minBookingAmount: Number(p.min_booking_amount) || 0,
    maxDiscountAmount: p.max_discount_amount ? Number(p.max_discount_amount) : null,
    maxUsageLimit: p.max_usage_limit ? Number(p.max_usage_limit) : null,
    currentUsageCount: Number(p.current_usage_count) || 0,
    perCustomerLimit: Number(p.per_customer_limit) || 1,
    startDate: p.start_date,
    endDate: p.end_date,
    isActive: p.is_active,
  }));
}
