"use server";

import { createClient } from "@/lib/supabase/server";

export interface RecordAdminPaymentPayload {
  bookingId: string;
  paymentType: "BALANCE_SETTLEMENT" | "RESERVATION_DEPOSIT" | "FULL_PAYMENT" | "ADJUSTMENT";
  paymentMethod: "CASH" | "GCASH" | "MAYA" | "BANK_TRANSFER" | "OTHER";
  amount: number;
  referenceNumber?: string;
  notes?: string;
}

export interface AdminPaymentActionResult {
  success: boolean;
  paymentId?: string;
  newBalance?: number;
  isFullyPaid?: boolean;
  error?: string;
}

export async function recordAdminPaymentAction(
  payload: RecordAdminPaymentPayload
): Promise<AdminPaymentActionResult> {
  try {
    if (!payload.bookingId?.trim()) {
      return { success: false, error: "Booking ID is required." };
    }
    if (!payload.amount || payload.amount <= 0 || payload.amount > 1000000) {
      return { success: false, error: "Payment amount must be greater than ₱0 and under ₱1,000,000." };
    }
    if (payload.referenceNumber && payload.referenceNumber.length > 100) {
      return { success: false, error: "Reference number cannot exceed 100 characters." };
    }

    const supabase = await createClient();

    // 1. Session & Identity Validation
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized session. Please log in again." };
    }

    // 2. Profile & Tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase.from("profiles") as any)
      .select("tenant_id, full_name")
      .eq("id", user.id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (profileError || !profile?.tenant_id) {
      return { success: false, error: "Could not resolve tenant profile." };
    }

    const tenantId = profile.tenant_id;
    const operatorName = profile.full_name || "Staff Admin";

    // 3. Permission check. The database RPC repeats this check authoritatively.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: canManageFinancials, error: permissionError } = await (supabase.rpc as any)(
      "has_permission",
      {
        p_permission_key: "financials.manage",
        p_tenant_id: tenantId,
      },
    );

    if (permissionError || canManageFinancials !== true) {
      return { success: false, error: "Forbidden: financials.manage permission is required." };
    }

    const paymentAmount = Number(payload.amount);

    // 4. Execute TRUE ATOMIC TRANSACTION via PostgreSQL RPC `record_admin_payment_atomic`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcErr } = await (supabase.rpc as any)("record_admin_payment_atomic", {
      p_tenant_id: tenantId,
      p_booking_id: payload.bookingId,
      p_payment_type: payload.paymentType,
      p_payment_method: payload.paymentMethod,
      p_amount: paymentAmount,
      p_reference_number: payload.referenceNumber?.trim() || null,
      p_operator_id: user.id,
      p_operator_name: operatorName,
    });

    if (rpcErr || !rpcResult || !rpcResult.success) {
      return {
        success: false,
        error: rpcErr?.message || "Failed to record payment atomically.",
      };
    }

    return {
      success: true,
      paymentId: rpcResult.payment_id,
      newBalance: rpcResult.new_balance,
      isFullyPaid: rpcResult.is_fully_paid,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected server error occurred.",
    };
  }
}
