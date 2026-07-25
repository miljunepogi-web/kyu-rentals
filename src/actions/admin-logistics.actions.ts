"use server";

import { createClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssignDeliveryPersonnelPayload {
  bookingId: string;
  currentStatus?: string;
  assigneeId: string;
  vehicleInfo?: string;
  notes?: string;
}

export interface AdminLogisticsActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const LOGISTICS_ADMIN_ROLES = ["admin", "super_admin", "franchise_owner", "support_staff"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    .in("name", LOGISTICS_ADMIN_ROLES)
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
 * Server Action: Assign Delivery Personnel to Booking
 *
 * Security contract:
 *  - "use server" — executes exclusively on the server.
 *  - Auth user identity and tenant derived from session (client input untrusted).
 *  - Invokes public.assign_delivery_personnel_admin() PostgreSQL RPC atomically.
 */
export async function assignDeliveryPersonnelAction(
  payload: AssignDeliveryPersonnelPayload
): Promise<AdminLogisticsActionResult<{ bookingId: string; assigneeName: string; newStatus: string }>> {
  try {
    if (!payload.bookingId?.trim()) {
      return { success: false, error: "Booking ID is required." };
    }
    if (!payload.assigneeId?.trim()) {
      return { success: false, error: "Please select a delivery team member to assign." };
    }

    const session = await resolveAdminSession();
    if (!session.success) return { success: false, error: session.error };

    const { userId, tenantId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "assign_delivery_personnel_admin",
      {
        p_tenant_id: tenantId,
        p_booking_id: payload.bookingId.trim(),
        p_expected_current_status: payload.currentStatus || null,
        p_assignee_id: payload.assigneeId.trim(),
        p_vehicle_info: payload.vehicleInfo?.trim() || null,
        p_assignment_notes: payload.notes?.trim() || null,
        p_admin_profile_id: userId,
      }
    );

    if (rpcError) {
      const isConflict =
        typeof rpcError.message === "string" && rpcError.message.includes("Concurrency conflict");

      if (isConflict) {
        return {
          success: false,
          error:
            "This booking was updated concurrently by another administrator. Please reload and try again.",
        };
      }
      return {
        success: false,
        error: rpcError.message || "Database delivery assignment failed. Please try again.",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = rpcResult as any;

    if (!response || response.status !== "success") {
      return {
        success: false,
        error:
          response?.message ||
          "Delivery assignment rejected by server state machine. No changes were made.",
      };
    }

    return {
      success: true,
      data: {
        bookingId: response.booking_id,
        assigneeName: response.assignee_name,
        newStatus: response.new_status,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected server error occurred.",
    };
  }
}
