"use server";

import { createClient } from "@/lib/supabase/server";

export interface AssignInventoryUnitPayload {
  bookingId: string;
  unitId: string | null; // null = unassign unit
}

export interface AdminInventoryAssignResult {
  success: boolean;
  unitSerial?: string | null;
  error?: string;
}

const INVENTORY_ROLES = ["admin", "super_admin", "franchise_owner", "support_staff"];

export async function assignInventoryUnitAction(
  payload: AssignInventoryUnitPayload
): Promise<AdminInventoryAssignResult> {
  try {
    if (!payload.bookingId?.trim()) {
      return { success: false, error: "Booking ID is required." };
    }

    const supabase = await createClient();

    // 1. Session & Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized session." };
    }

    // 2. Profile & Tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("tenant_id")
      .eq("id", user.id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (!profile?.tenant_id) {
      return { success: false, error: "Could not resolve tenant profile." };
    }

    const tenantId = profile.tenant_id;

    // 3. Admin RBAC check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userRoles } = await (supabase.from("user_roles") as any)
      .select("role_id")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId);

    if (!userRoles || userRoles.length === 0) {
      return { success: false, error: "Forbidden: Insufficient privileges." };
    }

    const roleIds = userRoles.map((r: { role_id: string }) => r.role_id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: validRoles } = await (supabase.from("roles") as any)
      .select("name")
      .in("id", roleIds)
      .in("name", INVENTORY_ROLES);

    if (!validRoles || validRoles.length === 0) {
      return { success: false, error: "Forbidden: Insufficient administrative privileges." };
    }

    // 4. Execute TRUE ATOMIC TRANSACTION via PostgreSQL RPC `assign_inventory_unit_atomic`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcErr } = await (supabase.rpc as any)("assign_inventory_unit_atomic", {
      p_tenant_id: tenantId,
      p_booking_id: payload.bookingId,
      p_unit_id: payload.unitId,
    });

    if (rpcErr || !rpcResult || !rpcResult.success) {
      return {
        success: false,
        error: rpcErr?.message || "Failed to assign inventory unit atomically.",
      };
    }

    return {
      success: true,
      unitSerial: rpcResult.unit_serial,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected server error occurred.",
    };
  }
}
