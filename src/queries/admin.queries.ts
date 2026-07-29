import { createClient } from "@/lib/supabase/client";
import {
  getBookingCustomerContact,
  getBookingPackageSnapshot,
} from "@/queries/booking-snapshot";
import { calculateInventoryAvailability } from "@/queries/inventory-metrics";
import { throwQueryError } from "@/queries/query-error";

export interface ScheduleItem {
  id: string;
  publicId: string;
  customerName: string;
  packageName: string;
  eventDate: string;
  startTime: string;
  status: string;
  deliveryZone: string;
  assignedDriverName?: string | null;
}

export interface AdminDashboardStats {
  todayDeliveries: number;
  todayPickups: number;
  pendingConfirmations: number;
  activeRentals: number;
  totalRevenue: number;

  scheduleTimeline: ScheduleItem[];

  inventoryAvailability: {
    totalUnits: number;
    availableUnits: number;
    reservedUnits: number;
    maintenanceUnits: number;
    utilizationPct: number;
    availablePct: number;
  };

  bookingHealth: {
    healthy: number;
    waitingPayment: number;
    pendingBalance: number;
    requiresAction: number;
    unassignedDriver: number;
  };
}

export interface AdminBookingListItem {
  id: string;
  publicId: string;
  customerName: string;
  customerPhone: string;
  packageName: string;
  eventDate: string;
  status: string;
  grandTotal: number;
  depositAmount: number;
  balanceAmount: number;
  deliveryZone: string;
  assignedUnitSerial?: string | null;
  assignedDriverName?: string | null;
  createdAt: string;
}

export interface AdminBookingDetail {
  id: string;
  publicId: string;
  tenantId: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  packageName: string;
  packageSlug: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  eventEndTime: string | null;
  deliveryAddress: string;
  deliveryZone: string | null;
  specialInstructions: string | null;
  status: string;

  // Financial Breakdown
  subtotalAmount: number;
  surchargeAmount: number;
  deliveryFee: number;
  discountAmount: number;
  grandTotal: number;
  depositAmount: number;
  balanceAmount: number;
  canViewPayments: boolean;
  canManagePayments: boolean;

  // Operational Snapshot Items
  assignedUnitId: string | null;
  assignedUnitSerial: string | null;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  vehicleInfo?: string | null;
  lockStatus: {
    isLocked: boolean;
    expiresAt: string | null;
  };

  payments: {
    id: string;
    publicId: string;
    amount: number;
    status: string;
    paymentType: string;
    paymentMethod: string;
    gatewayProvider: string | null;
    gatewayTransactionId: string | null;
    createdAt: string;
  }[];

  timelineEvents: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    eventLabel: string;
    eventDescription: string | null;
    performedByRole: string | null;
    createdAt: string;
  }[];
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = createClient();

  const todayStr = new Date().toISOString().split("T")[0];

  // Fetch bookings data using existing columns
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookingsData, error: bookingsError } = await (supabase.from("bookings") as any)
    .select(`
      id, public_id, status, event_date, start_time, grand_total, deposit_amount, balance_amount, delivery_zone, snapshot,
      profiles!customer_id (full_name),
      packages!package_id (name),
      assigned_personnel:profiles!assigned_delivery_personnel_id (full_name)
    `)
    .eq("is_deleted", false);

  if (bookingsError) throwQueryError("admin.dashboard.bookings", bookingsError);
  if (!bookingsData) {
    throwQueryError("admin.dashboard.bookings", new Error("Dashboard bookings query returned no data"));
  }

  const bookings = bookingsData || [];

  const todayBookings = bookings.filter((b: { event_date: string }) => b.event_date === todayStr);

  const todayDeliveries = todayBookings.filter(
    (b: { status: string }) => ["CONFIRMED", "PREPARING", "DRIVER_ASSIGNED", "OUT_FOR_DELIVERY"].includes(b.status)
  ).length;

  const todayPickups = todayBookings.filter(
    (b: { status: string }) => ["COMPLETED", "RETRIEVED"].includes(b.status)
  ).length;

  const pendingConfirmations = bookings.filter(
    (b: { status: string }) => b.status === "PENDING_PAYMENT"
  ).length;

  const activeRentals = bookings.filter(
    (b: { status: string }) => ["DELIVERED", "RENTAL_ACTIVE"].includes(b.status)
  ).length;

  const totalRevenue = bookings
    .filter((b: { status: string }) => !["CANCELLED", "REJECTED", "EXPIRED", "DRAFT"].includes(b.status))
    .reduce((sum: number, b: { grand_total: number }) => sum + (Number(b.grand_total) || 0), 0);

  interface RawTodayBookingRecord {
    id: string;
    public_id: string;
    status: string;
    event_date: string;
    start_time: string;
    delivery_zone: string | null;
    snapshot?: unknown;
    profiles?: { full_name?: string | null } | null;
    packages?: { name?: string | null } | null;
    assigned_personnel?: { full_name?: string | null } | null;
  }

  // Today's schedule timeline items
  const scheduleTimeline: ScheduleItem[] = (todayBookings as unknown as RawTodayBookingRecord[]).map((b) => {
    const customer = getBookingCustomerContact(b.snapshot);
    const frozenPackage = getBookingPackageSnapshot(b.snapshot);
    return {
      id: b.id,
      publicId: b.public_id,
      customerName: customer.fullName || b.profiles?.full_name || "Customer",
      packageName: frozenPackage.name || b.packages?.name || "Karaoke Setup",
      eventDate: b.event_date,
      startTime: b.start_time || "09:00 AM",
      status: b.status,
      deliveryZone: b.delivery_zone || "Metro Manila",
      assignedDriverName: b.assigned_personnel?.full_name || null,
    };
  });

  // Inventory availability & utilization percentages
  const { data: inventoryData, error: inventoryError } = await supabase
    .from("inventory_units")
    .select("status")
    .eq("is_deleted", false);

  if (inventoryError) throwQueryError("admin.dashboard.inventory", inventoryError);
  if (!inventoryData) {
    throwQueryError("admin.dashboard.inventory", new Error("Dashboard inventory query returned no data"));
  }

  const inventoryAvailability = calculateInventoryAvailability(inventoryData);

  // Booking health metrics
  const healthy = bookings.filter((b: { status: string }) =>
    ["CONFIRMED", "PREPARING", "DRIVER_ASSIGNED", "DELIVERED", "COMPLETED"].includes(b.status)
  ).length;

  const waitingPayment = bookings.filter((b: { status: string }) => b.status === "PENDING_PAYMENT").length;

  const pendingBalance = bookings.filter((b: { status: string; balance_amount: number }) =>
    ["CONFIRMED", "DRIVER_ASSIGNED", "DELIVERED"].includes(b.status) && (Number(b.balance_amount) || 0) > 0
  ).length;

  const requiresAction = bookings.filter((b: { status: string }) =>
    ["CANCELLATION_REQUESTED", "PAYMENT_FAILED"].includes(b.status)
  ).length;

  const unassignedDriver = bookings.filter((b: { status: string; assigned_personnel: unknown }) =>
    ["CONFIRMED", "PREPARING"].includes(b.status) && !b.assigned_personnel
  ).length;

  return {
    todayDeliveries,
    todayPickups,
    pendingConfirmations,
    activeRentals,
    totalRevenue,
    scheduleTimeline,
    inventoryAvailability,
    bookingHealth: {
      healthy,
      waitingPayment,
      pendingBalance,
      requiresAction,
      unassignedDriver,
    },
  };
}

export async function getAdminBookings(
  statusFilter?: string,
  dateFilter?: string
): Promise<AdminBookingListItem[]> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("bookings") as any)
    .select(`
      id, public_id, status, event_date, grand_total, deposit_amount, balance_amount, snapshot,
      delivery_zone, created_at,
      profiles!customer_id (full_name, phone),
      packages!package_id (name)
    `)
    .eq("is_deleted", false)
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "ALL") {
    query = query.eq("status", statusFilter);
  }

  if (dateFilter) {
    query = query.eq("event_date", dateFilter);
  }

  const { data, error } = await query;

  if (error) throwQueryError("admin.bookings.list", error);
  if (!data) throwQueryError("admin.bookings.list", new Error("Bookings query returned no data"));

  interface RawAdminBookingRow {
    id: string;
    public_id: string;
    event_date: string;
    status: string;
    grand_total: number;
    deposit_amount: number;
    balance_amount: number;
    delivery_zone: string | null;
    created_at?: string;
    snapshot?: unknown;
    profiles?: { full_name?: string | null; phone?: string | null } | null;
    packages?: { name?: string | null } | null;
  }

  return (data as unknown as RawAdminBookingRow[]).map((b) => {
    const customer = getBookingCustomerContact(b.snapshot);
    const frozenPackage = getBookingPackageSnapshot(b.snapshot);
    return {
      id: b.id,
      publicId: b.public_id,
      customerName: customer.fullName || b.profiles?.full_name || "Guest Customer",
      customerPhone: customer.phone || b.profiles?.phone || "N/A",
      packageName: frozenPackage.name || b.packages?.name || "Karaoke Package",
      eventDate: b.event_date,
      status: b.status,
      grandTotal: Number(b.grand_total) || 0,
      depositAmount: Number(b.deposit_amount) || 0,
      balanceAmount: Number(b.balance_amount) || 0,
      deliveryZone: b.delivery_zone || "Metro Manila",
      createdAt: b.created_at || new Date().toISOString(),
    };
  });
}

export async function getAdminBookingDetail(bookingId: string): Promise<AdminBookingDetail | null> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: b, error } = await (supabase.from("bookings") as any)
    .select(`
      id, public_id, tenant_id, status, created_at, event_date, start_time, duration_hours,
      event_end_time, delivery_address, delivery_zone, special_instructions,
      subtotal_amount, surcharge_amount, delivery_fee, discount_amount,
      grand_total, deposit_amount, balance_amount, assigned_unit_id, snapshot,
      assigned_delivery_personnel_id, vehicle_info,
      profiles!customer_id (full_name, email, phone),
      packages!package_id (name, slug),
      inventory_units!assigned_unit_id (serial_number),
      assigned_personnel:profiles!assigned_delivery_personnel_id (full_name)
    `)
    .eq("id", bookingId)
    .eq("is_deleted", false)
    .single();

  if (error) throwQueryError("admin.bookings.detail", error);
  if (!b) return null;

  const [
    { data: canViewPayments, error: viewPaymentsPermissionError },
    { data: canManagePayments, error: managePaymentsPermissionError },
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("has_permission", {
      p_permission_key: "financials.view",
      p_tenant_id: b.tenant_id,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)("has_permission", {
      p_permission_key: "financials.manage",
      p_tenant_id: b.tenant_id,
    }),
  ]);

  if (viewPaymentsPermissionError) {
    throwQueryError("admin.bookings.detail.permissions.view_payments", viewPaymentsPermissionError);
  }
  if (managePaymentsPermissionError) {
    throwQueryError("admin.bookings.detail.permissions.manage_payments", managePaymentsPermissionError);
  }

  let paymentsData: unknown[] = [];
  if (canViewPayments === true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error: paymentsError } = await (supabase.from("payments") as any)
      .select("id, public_id, amount, status, payment_type, payment_method, gateway_provider, gateway_transaction_id, created_at")
      .eq("booking_id", bookingId);

    if (paymentsError) throwQueryError("admin.bookings.detail.payments", paymentsError);
    paymentsData = data || [];
  }

  // Fetch timeline events
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: timelineData, error: timelineError } = await (supabase.from("booking_timeline_events") as any)
    .select("id, from_status, to_status, event_label, event_description, performed_by_role, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  // Fetch lock status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lockData, error: lockError } = await (supabase.from("inventory_locks") as any)
    .select("expires_at")
    .eq("session_id", bookingId)
    .maybeSingle();

  if (timelineError) throwQueryError("admin.bookings.detail.timeline", timelineError);
  if (lockError) throwQueryError("admin.bookings.detail.lock", lockError);

  const customer = getBookingCustomerContact(b.snapshot);
  const frozenPackage = getBookingPackageSnapshot(b.snapshot);

  return {
    id: b.id,
    publicId: b.public_id,
    tenantId: b.tenant_id,
    createdAt: b.created_at,
    customerName: customer.fullName || b.profiles?.full_name || "Guest Customer",
    customerEmail: customer.email || b.profiles?.email || "customer@example.com",
    customerPhone: customer.phone || b.profiles?.phone || "N/A",
    packageName: frozenPackage.name || b.packages?.name || "Karaoke Package",
    packageSlug: frozenPackage.slug || b.packages?.slug || "kyu-party-pro",
    eventDate: b.event_date,
    startTime: b.start_time,
    durationHours: b.duration_hours,
    eventEndTime: b.event_end_time || null,
    deliveryAddress: b.delivery_address,
    deliveryZone: b.delivery_zone || null,
    specialInstructions: b.special_instructions,
    status: b.status,

    subtotalAmount: Number(b.subtotal_amount) || 0,
    surchargeAmount: Number(b.surcharge_amount) || 0,
    deliveryFee: Number(b.delivery_fee) || 0,
    discountAmount: Number(b.discount_amount) || 0,
    grandTotal: Number(b.grand_total) || 0,
    depositAmount: Number(b.deposit_amount) || 0,
    balanceAmount: Number(b.balance_amount) || 0,
    canViewPayments: canViewPayments === true,
    canManagePayments: canManagePayments === true,

    assignedUnitId: b.assigned_unit_id || null,
    assignedUnitSerial: b.inventory_units?.serial_number || null,
    assignedDriverId: b.assigned_delivery_personnel_id || null,
    assignedDriverName: b.assigned_personnel?.full_name || null,
    vehicleInfo: b.vehicle_info || null,

    lockStatus: {
      isLocked: Boolean(lockData?.expires_at && new Date(lockData.expires_at) > new Date()),
      expiresAt: lockData?.expires_at || null,
    },

    payments: ((paymentsData as Array<{ id: string; public_id: string; amount: number; status: string; payment_type: string; payment_method: string; gateway_provider: string | null; gateway_transaction_id: string | null; created_at: string }>) || []).map((p) => ({
      id: p.id,
      publicId: p.public_id,
      amount: Number(p.amount) || 0,
      status: p.status,
      paymentType: p.payment_type,
      paymentMethod: p.payment_method,
      gatewayProvider: p.gateway_provider,
      gatewayTransactionId: p.gateway_transaction_id,
      createdAt: p.created_at,
    })),

    timelineEvents: ((timelineData as Array<{ id: string; from_status: string | null; to_status: string; event_label: string; event_description: string | null; performed_by_role: string | null; created_at: string }>) || []).map((t) => ({
      id: t.id,
      fromStatus: t.from_status,
      toStatus: t.to_status,
      eventLabel: t.event_label,
      eventDescription: t.event_description,
      performedByRole: t.performed_by_role,
      createdAt: t.created_at,
    })),
  };
}
