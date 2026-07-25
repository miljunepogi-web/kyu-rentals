"use server";

import { createClient } from "@/lib/supabase/server";

export interface CreateExpensePayload {
  categoryId: string;
  amount: number;
  expenseDate?: string;
  vendor?: string;
  description: string;
  paymentMethod?: string;
  receiptUrl?: string;
  notes?: string;
}

export interface DeleteExpensePayload {
  expenseId: string;
  reason: string;
}

export interface AdminExpenseActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const EXPENSE_ADMIN_ROLES = ["owner", "super_admin", "admin", "support_staff", "franchise_owner"];

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
    .in("name", EXPENSE_ADMIN_ROLES)
    .limit(1) as { data: RoleRow[] | null; error: unknown };

  if (roleLookupError || !roleRows || roleRows.length === 0) {
    return { success: false, error: "Forbidden: Insufficient administrative privileges." };
  }

  return { success: true, userId: user.id, tenantId };
}

/**
 * Server Action: Create Expense Record
 */
export async function createExpenseAction(
  payload: CreateExpensePayload
): Promise<AdminExpenseActionResult> {
  try {
    if (!payload.categoryId?.trim()) {
      return { success: false, error: "Expense category is required." };
    }
    if (!payload.amount || payload.amount <= 0) {
      return { success: false, error: "Please enter a positive expense amount." };
    }
    if (!payload.description?.trim()) {
      return { success: false, error: "Expense description is required." };
    }

    const session = await resolveAdminSession();
    if (!session.success) return { success: false, error: session.error };

    const { tenantId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "create_expense_admin",
      {
        p_tenant_id: tenantId,
        p_category_id: payload.categoryId.trim(),
        p_amount: payload.amount,
        p_expense_date: payload.expenseDate || new Date().toISOString().split("T")[0],
        p_vendor: payload.vendor?.trim() || null,
        p_description: payload.description.trim(),
        p_payment_method: payload.paymentMethod || "CASH",
        p_receipt_url: payload.receiptUrl?.trim() || null,
        p_notes: payload.notes?.trim() || null,
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message || "Failed to create expense record." };
    }

    return { success: true, data: rpcResult };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Server Action: Soft Delete Expense Record
 */
export async function deleteExpenseAction(
  payload: DeleteExpensePayload
): Promise<AdminExpenseActionResult> {
  try {
    if (!payload.expenseId?.trim()) {
      return { success: false, error: "Expense ID is required." };
    }
    if (!payload.reason?.trim() || payload.reason.trim().length < 3) {
      return { success: false, error: "Please provide a valid deletion reason (at least 3 characters)." };
    }

    const session = await resolveAdminSession();
    if (!session.success) return { success: false, error: session.error };

    const { tenantId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "soft_delete_expense_admin",
      {
        p_tenant_id: tenantId,
        p_expense_id: payload.expenseId.trim(),
        p_reason: payload.reason.trim(),
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message || "Failed to delete expense record." };
    }

    return { success: true, data: rpcResult };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
