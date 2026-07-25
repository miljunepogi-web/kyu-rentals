"use server";

import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateInventoryUnitPayload {
  packageId: string;
  serialNumber: string;
  conditionNotes?: string;
}

export interface UpdateInventoryUnitStatusPayload {
  unitId: string;
  currentStatus: string;
  targetStatus: string;
  reason: string;
  notes?: string;
}

export interface AdminInventoryActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Roles permitted to manage inventory
const INVENTORY_ADMIN_ROLES = ["admin", "super_admin", "franchise_owner"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve authenticated session, tenant, and verify admin role.
 * Returns the caller's userId and tenantId, or a structured error.
 */
async function resolveAdminSession(): Promise<
  | { success: true; userId: string; tenantId: string }
  | { success: false; error: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized: No authenticated session. Please log in again." };
  }

  // Resolve tenant from profile
  type ProfileRow = { tenant_id: string };
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .eq("is_deleted", false)
    .maybeSingle() as unknown as { data: ProfileRow | null; error: unknown };

  if (profileError || !profileData) {
    return { success: false, error: "Authorization failed: Could not resolve your user profile." };
  }

  const tenantId = profileData.tenant_id;

  // Verify admin role
  type UserRoleRow = { role_id: string };
  const { data: userRoleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .limit(10) as unknown as { data: UserRoleRow[] | null; error: unknown };

  if (roleError || !userRoleRows || userRoleRows.length === 0) {
    return { success: false, error: "Forbidden: Insufficient administrative privileges." };
  }

  const roleIds = userRoleRows.map((r) => r.role_id);

  type RoleRow = { name: string };
  const { data: roleRows, error: roleLookupError } = await supabase
    .from("roles")
    .select("name")
    .in("id", roleIds)
    .in("name", INVENTORY_ADMIN_ROLES)
    .limit(1) as unknown as { data: RoleRow[] | null; error: unknown };

  if (roleLookupError || !roleRows || roleRows.length === 0) {
    return { success: false, error: "Forbidden: Insufficient administrative privileges." };
  }

  return { success: true, userId: user.id, tenantId };
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Server Action: Create Inventory Unit
 *
 * Security contract:
 *  - "use server" — runs exclusively on the server.
 *  - Auth, tenant, and role resolved from session (no client-supplied IDs trusted).
 *  - Uniqueness enforced by database constraint uq_inventory_units_tenant_serial.
 */
export async function createInventoryUnitAction(
  payload: CreateInventoryUnitPayload
): Promise<AdminInventoryActionResult<{ unitId: string; publicId: string }>> {
  try {
    if (!payload.packageId?.trim()) {
      return { success: false, error: "Package selection is required." };
    }
    // Normalize serial number: trim whitespace, collapse internal spaces, uppercase.
    // The database stores only the normalized form to prevent near-duplicate entries.
    const normalizedSerial = payload.serialNumber.trim().replace(/\s+/g, ' ').toUpperCase();

    if (normalizedSerial.length < 2) {
      return { success: false, error: "Serial number must be at least 2 characters after normalization." };
    }

    const session = await resolveAdminSession();
    if (!session.success) return { success: false, error: session.error };

    const { tenantId } = session;
    const supabase = await createClient();

    // Pre-check uniqueness using the normalized serial
    const { count: existingCount } = await supabase
      .from("inventory_units").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("serial_number", normalizedSerial)
      .eq("is_deleted", false);

    if ((existingCount ?? 0) > 0) {
      return {
        success: false,
        error: `Serial number "${normalizedSerial}" already exists in this tenant. Each unit must have a unique serial number.`,
      };
    }

    type NewUnitRow = { id: string; public_id: string };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: newUnit, error: insertError } = await (supabase as any)
      .from("inventory_units")
      .insert({
        tenant_id: tenantId,
        package_id: payload.packageId.trim(),
        serial_number: normalizedSerial,
        status: "READY_TO_DEPLOY",
        condition_notes: payload.conditionNotes?.trim() || null,
      })
      .select("id, public_id")
      .single() as { data: NewUnitRow | null; error: { message: string } | null };

    if (insertError || !newUnit) {
      return {
        success: false,
        error: insertError?.message || "Failed to create inventory unit.",
      };
    }

    return {
      success: true,
      data: { unitId: newUnit.id, publicId: newUnit.public_id },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Server Action: Update Inventory Unit Status (Admin)
 *
 * Security contract:
 *  - "use server" — runs exclusively on the server.
 *  - All identity and tenant resolution from authenticated session.
 *  - Delegates to hardened update_inventory_unit_status_admin() PostgreSQL RPC.
 *  - RPC enforces: identity verification, RBAC, tenant isolation, state machine, ROW_COUNT.
 */
export async function updateInventoryUnitStatusAction(
  payload: UpdateInventoryUnitStatusPayload
): Promise<AdminInventoryActionResult<{ unitId: string; newStatus: string }>> {
  try {
    if (!payload.unitId?.trim()) {
      return { success: false, error: "Unit ID is required." };
    }
    if (!payload.targetStatus?.trim()) {
      return { success: false, error: "Target status is required." };
    }
    if (!payload.reason?.trim() || payload.reason.trim().length < 3) {
      return { success: false, error: "Please provide a valid reason (at least 3 characters)." };
    }

    const session = await resolveAdminSession();
    if (!session.success) return { success: false, error: session.error };

    const { userId, tenantId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "update_inventory_unit_status_admin",
      {
        p_tenant_id: tenantId,
        p_unit_id: payload.unitId.trim(),
        p_expected_current_status: payload.currentStatus,
        p_target_status: payload.targetStatus.trim(),
        p_admin_profile_id: userId,
        p_reason: payload.reason.trim(),
        p_notes: payload.notes?.trim() || null,
      }
    );

    if (rpcError) {
      const isConflict =
        typeof rpcError.message === "string" && rpcError.message.includes("Concurrency conflict");

      if (isConflict) {
        return {
          success: false,
          error:
            "This unit was updated concurrently by another administrator. Please reload and try again.",
        };
      }
      return {
        success: false,
        error: rpcError.message || "Database status transition failed. Please try again.",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = rpcResult as any;

    if (!response || response.status !== "success") {
      return {
        success: false,
        error:
          response?.message ||
          "Status transition rejected by server state machine. No changes were made.",
      };
    }

    return {
      success: true,
      data: { unitId: response.unit_id, newStatus: response.new_status },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
