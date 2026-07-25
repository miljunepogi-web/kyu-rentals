import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InventoryUnitStatus = "READY_TO_DEPLOY" | "IN_USE" | "UNDER_REPAIR" | "RETIRED";

export interface AdminInventoryUnit {
  id: string;
  publicId: string;
  tenantId: string;
  packageId: string;
  packageName: string;
  serialNumber: string;
  status: InventoryUnitStatus;
  conditionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceLogEntry {
  id: string;
  publicId: string;
  previousStatus: string;
  newStatus: string;
  reason: string;
  notes: string | null;
  performedBy: string | null;
  createdAt: string;
}

export interface AdminInventoryUnitDetail extends AdminInventoryUnit {
  maintenanceLogs: MaintenanceLogEntry[];
  activeBookingCount: number;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Fetch all inventory units for the default tenant, optionally filtered by status.
 * Joins to packages for package name.
 */
export async function getAdminInventoryUnits(
  statusFilter?: InventoryUnitStatus | "ALL"
): Promise<AdminInventoryUnit[]> {
  const supabase = createClient();

  type UnitRow = {
    id: string;
    public_id: string;
    tenant_id: string;
    package_id: string;
    serial_number: string;
    status: string;
    condition_notes: string | null;
    created_at: string;
    updated_at: string;
    packages: { name: string } | null;
  };

  let query = supabase
    .from("inventory_units")
    .select("id, public_id, tenant_id, package_id, serial_number, status, condition_notes, created_at, updated_at, packages(name)")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "ALL") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = query as unknown as { data: UnitRow[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    publicId: row.public_id,
    tenantId: row.tenant_id,
    packageId: row.package_id,
    packageName: row.packages?.name ?? "Unknown Package",
    serialNumber: row.serial_number,
    status: row.status as InventoryUnitStatus,
    conditionNotes: row.condition_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Fetch full operational detail for a single inventory unit.
 * Includes maintenance log history and active booking count.
 */
export async function getAdminInventoryUnitDetail(
  unitId: string
): Promise<AdminInventoryUnitDetail | null> {
  const supabase = createClient();

  type UnitDetailRow = {
    id: string;
    public_id: string;
    tenant_id: string;
    package_id: string;
    serial_number: string;
    status: string;
    condition_notes: string | null;
    created_at: string;
    updated_at: string;
    packages: { name: string } | null;
  };

  const { data: unit, error: unitError } = await supabase
    .from("inventory_units")
    .select("id, public_id, tenant_id, package_id, serial_number, status, condition_notes, created_at, updated_at, packages(name)")
    .eq("id", unitId)
    .eq("is_deleted", false)
    .maybeSingle() as unknown as { data: UnitDetailRow | null; error: unknown };

  if (unitError || !unit) return null;

  type MaintenanceLogRow = {
    id: string;
    public_id: string;
    previous_status: string;
    new_status: string;
    reason: string;
    notes: string | null;
    performed_by: string | null;
    created_at: string;
  };

  const { data: logs } = await supabase
    .from("inventory_maintenance_logs")
    .select("id, public_id, previous_status, new_status, reason, notes, performed_by, created_at")
    .eq("unit_id", unitId)
    .order("created_at", { ascending: false }) as unknown as { data: MaintenanceLogRow[] | null; error: unknown };

  // Count active bookings using this unit
  const { count: activeBookingCount } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("assigned_unit_id", unitId)
    .in("status", ["CONFIRMED", "PREPARING", "DRIVER_ASSIGNED", "OUT_FOR_DELIVERY", "DELIVERED", "RENTAL_ACTIVE"]);

  return {
    id: unit.id,
    publicId: unit.public_id,
    tenantId: unit.tenant_id,
    packageId: unit.package_id,
    packageName: unit.packages?.name ?? "Unknown Package",
    serialNumber: unit.serial_number,
    status: unit.status as InventoryUnitStatus,
    conditionNotes: unit.condition_notes,
    createdAt: unit.created_at,
    updatedAt: unit.updated_at,
    maintenanceLogs: (logs ?? []).map((log) => ({
      id: log.id,
      publicId: log.public_id,
      previousStatus: log.previous_status,
      newStatus: log.new_status,
      reason: log.reason,
      notes: log.notes,
      performedBy: log.performed_by,
      createdAt: log.created_at,
    })),
    activeBookingCount: activeBookingCount ?? 0,
  };
}
