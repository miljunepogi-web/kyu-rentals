"use server";

import { createClient } from "@/lib/supabase/server";

export interface UpdateBookingStatusPayload {
  bookingId: string;
  currentStatus: string;
  targetStatus: string;
  reason: string;
}

export interface AdminActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Server Action: Update Booking Status (Admin)
 *
 * Security contract:
 *  - Runs ONLY on the server ("use server" directive).
 *  - Derives tenant_id and admin_profile_id from the authenticated Supabase session.
 *    No client-supplied identifiers are trusted for these fields.
 *  - Enforces role authorization (admin | super_admin | franchise_owner | support_staff)
 *    inside the PostgreSQL RPC function via auth.uid() comparison.
 *  - Passes p_admin_profile_id = session user ID so the RPC can verify it matches
 *    auth.uid() and reject forged values.
 *
 * Executes state machine transition via:
 *   public.transition_booking_status_admin() PostgreSQL RPC (atomic, SECURITY DEFINER)
 */
export async function updateBookingStatusAdminAction(
  payload: UpdateBookingStatusPayload
): Promise<AdminActionResult<{ bookingId: string; newStatus: string }>> {
  try {
    // -------------------------------------------------------------------------
    // 1. INPUT VALIDATION
    // -------------------------------------------------------------------------
    if (!payload.bookingId || payload.bookingId.trim().length === 0) {
      return { success: false, error: "Booking ID is required." };
    }

    if (!payload.targetStatus || payload.targetStatus.trim().length === 0) {
      return { success: false, error: "Target status is required." };
    }

    if (!payload.reason || payload.reason.trim().length < 3) {
      return { success: false, error: "Please provide a valid reason (at least 3 characters)." };
    }

    // -------------------------------------------------------------------------
    // 2. AUTHENTICATION — Resolve authenticated session from server cookies.
    //    No client-supplied identity is trusted.
    // -------------------------------------------------------------------------
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Unauthorized: No authenticated session. Please log in again.",
      };
    }

    const adminProfileId = user.id;

    // -------------------------------------------------------------------------
    // 3. TENANT RESOLUTION — Derive from profiles table for this authenticated user.
    //    Never accept tenant_id from the client payload.
    // -------------------------------------------------------------------------
    type ProfileRow = { tenant_id: string };
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", adminProfileId)
      .eq("is_deleted", false)
      .maybeSingle() as unknown as { data: ProfileRow | null; error: unknown };

    if (profileError || !profileData) {
      return {
        success: false,
        error: "Authorization failed: Could not resolve your user profile. Contact support.",
      };
    }

    const tenantId: string = profileData.tenant_id;

    // -------------------------------------------------------------------------
    // 4. ROLE AUTHORIZATION — Verify the caller holds an admin-level role
    //    within their resolved tenant before invoking the RPC.
    //    This is an application-layer pre-check; the RPC enforces it again at
    //    the database layer as a defence-in-depth measure.
    // -------------------------------------------------------------------------
    const ADMIN_ROLES = ["admin", "super_admin", "franchise_owner", "support_staff"];

    // Fetch the caller's role IDs within the resolved tenant, then cross-check
    // against allowed admin role names. Two explicit casts are used to prevent
    // Supabase TypeScript inference from resolving query results as 'never' on
    // chained .in() filters that do not appear in the generated Database types.
    type UserRoleRow = { role_id: string };
    const { data: userRoleRows, error: roleError } = await supabase
      .from("user_roles")
      .select("role_id")
      .eq("user_id", adminProfileId)
      .eq("tenant_id", tenantId)
      .limit(10) as unknown as { data: UserRoleRow[] | null; error: unknown };

    if (roleError || !userRoleRows || userRoleRows.length === 0) {
      return {
        success: false,
        error: "Forbidden: You do not have sufficient administrative privileges to perform status transitions.",
      };
    }

    const roleIds = userRoleRows.map((r) => r.role_id);

    type RoleRow = { name: string };
    const { data: roleRows, error: roleLookupError } = await supabase
      .from("roles")
      .select("name")
      .in("id", roleIds)
      .in("name", ADMIN_ROLES)
      .limit(1) as unknown as { data: RoleRow[] | null; error: unknown };

    if (roleLookupError || !roleRows || roleRows.length === 0) {
      return {
        success: false,
        error: "Forbidden: You do not have sufficient administrative privileges to perform status transitions.",
      };
    }

    // -------------------------------------------------------------------------
    // 5. ATOMIC RPC INVOCATION
    //    p_admin_profile_id is sourced from auth session (step 2), NOT from client.
    //    The RPC will re-verify that auth.uid() === p_admin_profile_id internally.
    // -------------------------------------------------------------------------
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "transition_booking_status_admin",
      {
        p_tenant_id: tenantId,
        p_booking_id: payload.bookingId,
        p_expected_current_status: payload.currentStatus,
        p_target_status: payload.targetStatus.trim(),
        p_admin_profile_id: adminProfileId,
        p_reason: payload.reason.trim(),
      }
    );

    if (rpcError) {
      // Surface concurrency conflict as a user-friendly message.
      const isConflict =
        typeof rpcError.message === "string" &&
        rpcError.message.includes("Concurrency conflict");

      if (isConflict) {
        return {
          success: false,
          error:
            "This booking was updated concurrently by another administrator. Please close the detail panel, reload the booking list, and try again.",
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
          "Status transition was rejected by the server state machine. No changes were made.",
      };
    }

    return {
      success: true,
      data: {
        bookingId: response.booking_id,
        newStatus: response.new_status,
      },
    };
  } catch (err) {
    const errorMsg =
      err instanceof Error ? err.message : "An unexpected server error occurred.";
    return { success: false, error: errorMsg };
  }
}
