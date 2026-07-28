import { createClient } from "@/lib/supabase/client";
import { throwQueryError } from "@/queries/query-error";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdminFinancialReport {
  grossRevenue: number;
  collectedRevenue: number;
  outstandingBalance: number;
  refundedAmount: number;
  reservationDeposits: number;
  remainingBalances: number;
  bookingCount: number;
  averageBookingValue: number;
}

export interface OperationalFunnelMetric {
  confirmed: number;
  preparing: number;
  deliveryAssigned: number;
  outForDelivery: number;
  rentalActive: number;
  completed: number;
  cancelled: number;
}

export interface PackageUtilizationMetric {
  packageId: string;
  packageName: string;
  packageSlug: string;
  totalBookings: number;
  totalRentalDays: number;
  utilizationPercentage: number;
  revenueGenerated: number;
}

// ---------------------------------------------------------------------------
// Queries — 100% PostgreSQL RPC Aggregated Reporting Architecture
// ---------------------------------------------------------------------------

/**
 * Helper to resolve tenant ID dynamically from authenticated profile.
 */
async function resolveTenantId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throwQueryError("admin.reports.resolve-user", userError);
  if (!user) return null;

  type ProfileRow = { tenant_id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .eq("is_deleted", false)
    .maybeSingle() as { data: ProfileRow | null; error: unknown };

  if (profileError) throwQueryError("admin.reports.resolve-tenant", profileError);

  return profile?.tenant_id || null;
}

/**
 * Fetch aggregated financial metrics computed exclusively inside PostgreSQL RPC.
 */
export async function getAdminFinancialReport(): Promise<AdminFinancialReport> {
  const emptyReport: AdminFinancialReport = {
    grossRevenue: 0,
    collectedRevenue: 0,
    outstandingBalance: 0,
    refundedAmount: 0,
    reservationDeposits: 0,
    remainingBalances: 0,
    bookingCount: 0,
    averageBookingValue: 0,
  };

  const tenantId = await resolveTenantId();
  if (!tenantId) return emptyReport;

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
    "get_admin_financial_report_admin",
    { p_tenant_id: tenantId }
  );

  if (rpcError) throwQueryError("admin.reports.financial", rpcError);
  if (!rpcResult) {
    throwQueryError("admin.reports.financial", new Error("Financial report RPC returned no data"));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = rpcResult as any;
  return {
    grossRevenue: Number(r.gross_revenue) || 0,
    collectedRevenue: Number(r.collected_revenue) || 0,
    outstandingBalance: Number(r.outstanding_balance) || 0,
    refundedAmount: Number(r.refunded_amount) || 0,
    reservationDeposits: Number(r.reservation_deposits) || 0,
    remainingBalances: Number(r.remaining_balances) || 0,
    bookingCount: Number(r.booking_count) || 0,
    averageBookingValue: Number(r.average_booking_value) || 0,
  };
}

/**
 * Fetch operational funnel metrics computed exclusively inside PostgreSQL RPC.
 */
export async function getAdminOperationalFunnel(): Promise<OperationalFunnelMetric> {
  const emptyFunnel: OperationalFunnelMetric = {
    confirmed: 0,
    preparing: 0,
    deliveryAssigned: 0,
    outForDelivery: 0,
    rentalActive: 0,
    completed: 0,
    cancelled: 0,
  };

  const tenantId = await resolveTenantId();
  if (!tenantId) return emptyFunnel;

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
    "get_admin_operational_funnel_admin",
    { p_tenant_id: tenantId }
  );

  if (rpcError) throwQueryError("admin.reports.operational-funnel", rpcError);
  if (!rpcResult) {
    throwQueryError("admin.reports.operational-funnel", new Error("Operational funnel RPC returned no data"));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r = rpcResult as any;
  return {
    confirmed: Number(r.confirmed) || 0,
    preparing: Number(r.preparing) || 0,
    deliveryAssigned: Number(r.delivery_assigned) || 0,
    outForDelivery: Number(r.out_for_delivery) || 0,
    rentalActive: Number(r.rental_active) || 0,
    completed: Number(r.completed) || 0,
    cancelled: Number(r.cancelled) || 0,
  };
}

/**
 * Fetch package utilization analytics computed exclusively inside PostgreSQL RPC.
 */
export async function getAdminPackageUtilization(): Promise<PackageUtilizationMetric[]> {
  const tenantId = await resolveTenantId();
  if (!tenantId) return [];

  const supabase = createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
    "get_admin_package_utilization_admin",
    { p_tenant_id: tenantId }
  );

  if (rpcError) throwQueryError("admin.reports.package-utilization", rpcError);
  if (!Array.isArray(rpcResult)) {
    throwQueryError("admin.reports.package-utilization", new Error("Package utilization RPC returned invalid data"));
  }

  interface RawPackageUtilizationRecord {
    package_id: string;
    package_name: string;
    package_slug: string;
    total_bookings: number;
    total_rental_days: number;
    utilization_percentage: number;
    revenue_generated: number;
  }

  return (rpcResult as RawPackageUtilizationRecord[]).map((u) => ({
    packageId: u.package_id,
    packageName: u.package_name,
    packageSlug: u.package_slug,
    totalBookings: Number(u.total_bookings) || 0,
    totalRentalDays: Number(u.total_rental_days) || 0,
    utilizationPercentage: Number(u.utilization_percentage) || 0,
    revenueGenerated: Number(u.revenue_generated) || 0,
  }));
}
