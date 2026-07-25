"use server";

import { createClient } from "@/lib/supabase/server";
import { tenantSettingsSchema, TenantSettingsInput } from "@/lib/validations/settings.schema";

export interface AdminSettingsActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const SETTINGS_ADMIN_ROLES = ["admin", "super_admin", "franchise_owner"];

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
    return { success: false, error: "Unauthorized: No authenticated session found." };
  }

  type ProfileRow = { tenant_id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .eq("is_deleted", false)
    .maybeSingle() as { data: ProfileRow | null; error: unknown };

  if (profileError || !profileData) {
    return { success: false, error: "Authorization failed: Could not resolve profile." };
  }

  const tenantId = profileData.tenant_id;

  type UserRoleRow = { role_id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRoleRows, error: roleError } = await (supabase as any)
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .limit(10) as { data: UserRoleRow[] | null; error: unknown };

  if (roleError || !userRoleRows || userRoleRows.length === 0) {
    return { success: false, error: "Forbidden: Insufficient administrative privileges." };
  }

  const roleIds = userRoleRows.map((r) => r.role_id);

  type RoleRow = { name: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roleRows, error: roleLookupError } = await (supabase as any)
    .from("roles")
    .select("name")
    .in("id", roleIds)
    .in("name", SETTINGS_ADMIN_ROLES)
    .limit(1) as { data: RoleRow[] | null; error: unknown };

  if (roleLookupError || !roleRows || roleRows.length === 0) {
    return { success: false, error: "Forbidden: Insufficient administrative privileges." };
  }

  return { success: true, userId: user.id, tenantId };
}

/**
 * Server Action: Update Tenant Settings
 *
 * Validates input against Zod schema before executing upserts to public.settings.
 */
export async function updateTenantSettingsAction(
  rawInput: TenantSettingsInput
): Promise<AdminSettingsActionResult> {
  try {
    const parseResult = tenantSettingsSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || "Invalid settings input.";
      return { success: false, error: firstError };
    }

    const session = await resolveAdminSession();
    if (!session.success) return { success: false, error: session.error };

    const { userId, tenantId } = session;
    const input = parseResult.data;
    const supabase = await createClient();

    const updates = [
      { namespace: "business", key: "name", value: JSON.stringify(input.businessName), data_type: "string", label: "Business Name" },
      { namespace: "business", key: "tagline", value: JSON.stringify(input.tagline || ""), data_type: "string", label: "Tagline" },
      { namespace: "business", key: "email", value: JSON.stringify(input.contactEmail), data_type: "string", label: "Contact Email" },
      { namespace: "business", key: "phone", value: JSON.stringify(input.contactPhone), data_type: "string", label: "Contact Phone" },
      { namespace: "pricing", key: "reservation_pct", value: JSON.stringify(input.reservationPct), data_type: "number", label: "Reservation Fee Percentage" },
      { namespace: "pricing", key: "overtime_rate_per_hour", value: JSON.stringify(input.overtimeRatePerHour), data_type: "number", label: "Overtime Hourly Rate" },
      { namespace: "policy", key: "cancellation_window_full_refund_hrs", value: JSON.stringify(input.cancellationWindowFullRefundHrs), data_type: "number", label: "Full Refund Window (Hours)" },
      { namespace: "policy", key: "cancellation_window_partial_refund_hrs", value: JSON.stringify(input.cancellationWindowPartialRefundHrs), data_type: "number", label: "Partial Refund Window (Hours)" },
      { namespace: "policy", key: "partial_refund_pct", value: JSON.stringify(input.partialRefundPct), data_type: "number", label: "Partial Refund Percentage" },
      { namespace: "policy", key: "booking_expiry_hours", value: JSON.stringify(input.bookingExpiryHours), data_type: "number", label: "Booking Expiry (Hours)" },
    ];

    for (const item of updates) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: upsertError } = await (supabase as any)
        .from("settings")
        .upsert(
          {
            tenant_id: tenantId,
            namespace: item.namespace,
            key: item.key,
            value: item.value,
            data_type: item.data_type,
            label: item.label,
            updated_by: userId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tenant_id,namespace,key" }
        );

      if (upsertError) {
        return {
          success: false,
          error: `Failed to save setting "${item.label}": ${upsertError.message}`,
        };
      }
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
