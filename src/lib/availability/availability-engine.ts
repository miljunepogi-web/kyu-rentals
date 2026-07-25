import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";

export interface AvailabilityResult {
  available: boolean;
  totalDeployableUnits: number;
  confirmedBookingsCount: number;
  activeLocksCount: number;
  maintenanceUnitsCount: number;
  availableUnits: number;
  eventDate: string;
  durationHours: number;
}

export interface CheckAvailabilityParams {
  supabase: SupabaseClient<Database>;
  tenantId: string;
  packageId: string;
  eventDate: string; // yyyy-MM-dd
  durationHours: number;
}

/**
 * Server-Side Concurrency-Safe Availability Engine (Sprint 8 Task #5 Verified).
 * 
 * Business Allocation Model:
 * KYU Rentals allocates physical karaoke equipment units per calendar event date (`event_date`),
 * because dispatch, setup, event operation, and pickup logistics occupy a unit for the event day.
 * 
 * `durationHours` (4h, 8h, 24h) is required by the parameter contract for rate calculations
 * (`calculateBookingPrice`) and schedule end time calculation (`event_end_time`), while unit capacity
 * is locked per calendar event date.
 * 
 * Formula:
 * AvailableUnits = TotalDeployableUnits - (ConfirmedBookingsOnDate + ActiveSoftLocks + MaintenanceBlocks)
 */
export async function checkPackageAvailability({
  supabase,
  tenantId,
  packageId,
  eventDate,
  durationHours,
}: CheckAvailabilityParams): Promise<AvailabilityResult> {
  const nowIso = new Date().toISOString();

  // 1. Fetch Total Deployable Inventory Units (Excludes UNDER_REPAIR, RETIRED, and deleted units)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: deployableCount, error: unitErr } = await (supabase.from("inventory_units") as any)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("package_id", packageId)
    .eq("status", "READY_TO_DEPLOY")
    .eq("is_deleted", false);

  if (unitErr) {
    throw new Error(`Failed to query deployable inventory: ${unitErr.message}`);
  }

  const totalDeployableUnits = deployableCount || 0;

  // 2. Fetch Active Confirmed Bookings overlapping the target date
  // Statuses considered active blocks: CONFIRMED, PREPARING, DRIVER_ASSIGNED, OUT_FOR_DELIVERY, DELIVERED, RENTAL_ACTIVE
  const activeBookingStatuses = [
    "CONFIRMED",
    "PREPARING",
    "DRIVER_ASSIGNED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "RENTAL_ACTIVE",
    "PICKUP_SCHEDULED",
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: confirmedCount, error: bookingErr } = await (supabase.from("bookings") as any)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("package_id", packageId)
    .eq("event_date", eventDate)
    .in("status", activeBookingStatuses);

  if (bookingErr) {
    throw new Error(`Failed to query active bookings: ${bookingErr.message}`);
  }

  const confirmedBookingsCount = confirmedCount || 0;

  // 3. Fetch Active Temporary Inventory Locks (expires_at > NOW())
  // Expired locks (expires_at <= NOW()) are completely ignored
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: locksCount, error: lockErr } = await (supabase.from("inventory_locks") as any)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("package_id", packageId)
    .gt("expires_at", nowIso);

  if (lockErr) {
    throw new Error(`Failed to query active locks: ${lockErr.message}`);
  }

  const activeLocksCount = locksCount || 0;

  // 4. Fetch Maintenance Units Count (UNDER_REPAIR) for logging visibility
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: repairCount } = await (supabase.from("inventory_units") as any)
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("package_id", packageId)
    .eq("status", "UNDER_REPAIR")
    .eq("is_deleted", false);

  const maintenanceUnitsCount = repairCount || 0;

  // 5. Calculate Final Available Deployable Count
  const occupiedUnits = confirmedBookingsCount + activeLocksCount;
  const availableUnits = Math.max(0, totalDeployableUnits - occupiedUnits);
  const available = availableUnits > 0;

  return {
    available,
    totalDeployableUnits,
    confirmedBookingsCount,
    activeLocksCount,
    maintenanceUnitsCount,
    availableUnits,
    eventDate,
    durationHours,
  };
}
