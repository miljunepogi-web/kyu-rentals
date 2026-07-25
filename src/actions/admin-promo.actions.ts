"use server";

import { createClient } from "@/lib/supabase/server";

export interface CreatePromoCodePayload {
  code: string;
  discountType: "FIXED" | "PERCENTAGE";
  discountValue: number;
  minBookingAmount?: number;
  maxDiscountAmount?: number;
  maxUsageLimit?: number;
  perCustomerLimit?: number;
  startDate: string;
  endDate: string;
}

export interface AdminPromoActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const PROMO_ADMIN_ROLES = ["owner", "super_admin", "admin", "franchise_owner"];

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
    .in("name", PROMO_ADMIN_ROLES)
    .limit(1) as { data: RoleRow[] | null; error: unknown };

  if (roleLookupError || !roleRows || roleRows.length === 0) {
    return { success: false, error: "Forbidden: Insufficient administrative privileges." };
  }

  return { success: true, userId: user.id, tenantId };
}

/**
 * Server Action: Create Promo Code Campaign
 */
export async function createPromoCodeAction(
  payload: CreatePromoCodePayload
): Promise<AdminPromoActionResult> {
  try {
    if (!payload.code?.trim()) {
      return { success: false, error: "Promo code string is required." };
    }
    if (!payload.discountValue || payload.discountValue <= 0) {
      return { success: false, error: "Please enter a positive discount value." };
    }
    if (!payload.startDate || !payload.endDate) {
      return { success: false, error: "Campaign start and end dates are required." };
    }

    const session = await resolveAdminSession();
    if (!session.success) return { success: false, error: session.error };

    const { userId, tenantId } = session;
    const supabase = await createClient();

    const normalizedCode = payload.code.trim().toUpperCase();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: promo, error: insertError } = await (supabase as any)
      .from("promo_codes")
      .insert({
        tenant_id: tenantId,
        code: normalizedCode,
        discount_type: payload.discountType,
        discount_value: payload.discountValue,
        min_booking_amount: payload.minBookingAmount || 0,
        max_discount_amount: payload.maxDiscountAmount || null,
        max_usage_limit: payload.maxUsageLimit || null,
        per_customer_limit: payload.perCustomerLimit || 1,
        start_date: new Date(payload.startDate).toISOString(),
        end_date: new Date(payload.endDate).toISOString(),
        created_by: userId,
      })
      .select("id, public_id, code")
      .single();

    if (insertError) {
      return {
        success: false,
        error: insertError.message.includes("uq_promo_codes_tenant_code")
          ? `Promo code "${normalizedCode}" already exists.`
          : insertError.message,
      };
    }

    return { success: true, data: promo };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
