import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeliveryTeamMember {
  id: string;
  publicId: string;
  fullName: string;
  email: string;
  phone: string | null;
  roleName: string;
}

export interface AdminDeliveryScheduleItem {
  id: string;
  publicId: string;
  customerName: string;
  customerPhone: string;
  packageName: string;
  eventDate: string;
  startTime: string;
  deliveryAddress: string;
  deliveryZone: string | null;
  status: string;
  assignedPersonnelId: string | null;
  assignedPersonnelName: string | null;
  vehicleInfo: string | null;
  createdAt: string;
}

export interface AdminDeliverySummary {
  unassignedDeliveries: number;
  assignedDeliveries: number;
  deliveriesInTransit: number;
  scheduledPickups: number;
}

// Operational roles allowed for delivery assignment
const OPERATIONAL_ROLES = [
  "owner",
  "franchise_owner",
  "super_admin",
  "admin",
  "support_staff",
  "driver",
];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch all active operational team members in the tenant who can be assigned to deliveries.
 */
export async function getAdminDeliveryTeam(): Promise<DeliveryTeamMember[]> {
  const supabase = createClient();

  // First fetch active user_roles with role name join
  type UserRoleWithProfile = {
    user_id: string;
    roles: { name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRoleRows, error: roleError } = await (supabase as any)
    .from("user_roles")
    .select("user_id, roles(name)")
    .limit(100) as { data: UserRoleWithProfile[] | null; error: unknown };

  if (roleError || !userRoleRows) return [];

  // Filter for operational roles
  const validUserRoleMap = new Map<string, string>();
  for (const ur of userRoleRows) {
    const rName = ur.roles?.name?.toLowerCase();
    if (rName && OPERATIONAL_ROLES.includes(rName)) {
      validUserRoleMap.set(ur.user_id, ur.roles?.name || "Staff");
    }
  }

  const validUserIds = Array.from(validUserRoleMap.keys());
  if (validUserIds.length === 0) return [];

  // Fetch profiles for these users
  type ProfileRow = {
    id: string;
    public_id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("id, public_id, full_name, email, phone")
    .in("id", validUserIds)
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("full_name", { ascending: true }) as { data: ProfileRow[] | null; error: unknown };

  if (profileError || !profiles) return [];

  return profiles.map((p) => ({
    id: p.id,
    publicId: p.public_id,
    fullName: p.full_name,
    email: p.email,
    phone: p.phone,
    roleName: validUserRoleMap.get(p.id) || "Staff",
  }));
}

/**
 * Fetch delivery & pickup schedule pipeline with assigned personnel and vehicle notes.
 */
export async function getAdminDeliverySchedule(
  statusFilter?: string
): Promise<AdminDeliveryScheduleItem[]> {
  const supabase = createClient();

  type ScheduleRow = {
    id: string;
    public_id: string;
    event_date: string;
    start_time: string;
    delivery_address: string;
    delivery_zone: string | null;
    status: string;
    assigned_delivery_personnel_id: string | null;
    vehicle_info: string | null;
    created_at: string;
    profiles: { full_name: string; phone: string | null } | null;
    packages: { name: string } | null;
    assigned_personnel?: { full_name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any).from("bookings")
    .select(`
      id, public_id, event_date, start_time, delivery_address, delivery_zone, status,
      assigned_delivery_personnel_id, vehicle_info, created_at,
      profiles!customer_id (full_name, phone),
      packages!package_id (name),
      assigned_personnel:profiles!assigned_delivery_personnel_id (full_name)
    `)
    .eq("is_deleted", false)
    .in("status", [
      "CONFIRMED",
      "PREPARING",
      "DRIVER_ASSIGNED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "RENTAL_ACTIVE",
      "PICKUP_SCHEDULED",
      "OUT_FOR_PICKUP",
    ])
    .order("event_date", { ascending: true });

  if (statusFilter && statusFilter !== "ALL") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query as { data: ScheduleRow[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((b) => ({
    id: b.id,
    publicId: b.public_id,
    customerName: b.profiles?.full_name || "Customer",
    customerPhone: b.profiles?.phone || "—",
    packageName: b.packages?.name || "Package",
    eventDate: b.event_date,
    startTime: b.start_time,
    deliveryAddress: b.delivery_address,
    deliveryZone: b.delivery_zone,
    status: b.status,
    assignedPersonnelId: b.assigned_delivery_personnel_id,
    assignedPersonnelName: b.assigned_personnel?.full_name || null,
    vehicleInfo: b.vehicle_info,
    createdAt: b.created_at,
  }));
}

/**
 * Fetch delivery summary KPI statistics.
 */
export async function getAdminDeliverySummary(): Promise<AdminDeliverySummary> {
  const supabase = createClient();

  type BookingSummaryRow = {
    status: string;
    assigned_delivery_personnel_id: string | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).from("bookings")
    .select("status, assigned_delivery_personnel_id")
    .eq("is_deleted", false)
    .in("status", [
      "CONFIRMED",
      "PREPARING",
      "DRIVER_ASSIGNED",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "RENTAL_ACTIVE",
      "PICKUP_SCHEDULED",
      "OUT_FOR_PICKUP",
    ]) as { data: BookingSummaryRow[] | null; error: unknown };

  if (error || !data) {
    return {
      unassignedDeliveries: 0,
      assignedDeliveries: 0,
      deliveriesInTransit: 0,
      scheduledPickups: 0,
    };
  }

  const unassignedDeliveries = data.filter(
    (b) =>
      ["CONFIRMED", "PREPARING"].includes(b.status) &&
      !b.assigned_delivery_personnel_id
  ).length;

  const assignedDeliveries = data.filter(
    (b) => b.status === "DRIVER_ASSIGNED" || (["PREPARING", "CONFIRMED"].includes(b.status) && Boolean(b.assigned_delivery_personnel_id))
  ).length;

  const deliveriesInTransit = data.filter((b) =>
    ["OUT_FOR_DELIVERY", "OUT_FOR_PICKUP"].includes(b.status)
  ).length;

  const scheduledPickups = data.filter((b) =>
    ["RENTAL_ACTIVE", "PICKUP_SCHEDULED"].includes(b.status)
  ).length;

  return {
    unassignedDeliveries,
    assignedDeliveries,
    deliveriesInTransit,
    scheduledPickups,
  };
}
