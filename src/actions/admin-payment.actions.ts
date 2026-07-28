"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPayMongoRefund } from "@/lib/api/paymongo";

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

export interface IssuePayMongoRefundPayload {
  bookingId: string;
  paymentId: string;
  reason: "merchant_cancellation" | "duplicate" | "fraudulent" | "other";
  notes: string;
}

export async function issuePayMongoRefundAction(
  payload: IssuePayMongoRefundPayload
): Promise<AdminPaymentActionResult> {
  let refundId: string | null = null;

  try {
    if (!payload.bookingId || !payload.paymentId) {
      return { success: false, error: "Booking and payment are required." };
    }
    if (payload.notes.trim().length < 5 || payload.notes.trim().length > 500) {
      return { success: false, error: "Refund notes must be between 5 and 500 characters." };
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized session. Please log in again." };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase.from("profiles") as any)
      .select("tenant_id")
      .eq("id", user.id)
      .eq("is_deleted", false)
      .maybeSingle();
    if (profileError || !profile?.tenant_id) {
      return { success: false, error: "Could not resolve tenant profile." };
    }

    // The RPC rechecks identity, permission, booking status, payment ownership,
    // PayMongo provenance, and the one-refund-per-payment constraint atomically.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: claim, error: claimError } = await (supabase.rpc as any)(
      "begin_paymongo_refund_admin",
      {
        p_tenant_id: profile.tenant_id,
        p_booking_id: payload.bookingId,
        p_payment_id: payload.paymentId,
        p_operator_id: user.id,
        p_reason: payload.reason,
        p_notes: payload.notes.trim(),
      },
    );
    if (claimError || !claim?.success) {
      return { success: false, error: claimError?.message || "Refund could not be authorized." };
    }

    refundId = claim.refund_id;
    const result = await createPayMongoRefund({
      paymentId: claim.gateway_payment_id,
      amount: Number(claim.amount),
      reason:
        payload.reason === "duplicate" || payload.reason === "fraudulent"
          ? payload.reason
          : "others",
      notes: payload.notes.trim(),
    });

    const admin = createAdminClient();
    if (!result.success || !result.data) {
      const uncertain = result.error?.includes("did not return a conclusive response");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.rpc as any)("finalize_paymongo_refund_admin", {
        p_refund_id: refundId,
        p_status: uncertain ? "manual_review" : "failed",
        p_paymongo_refund_id: null,
        p_gateway_response: {},
        p_failure_message: result.error || "PayMongo refund failed.",
      });
      return { success: false, error: result.error || "PayMongo refund failed." };
    }

    const finalStatus = result.data.status === "failed"
      ? "failed"
      : result.data.status === "succeeded"
        ? "succeeded"
        : "manual_review";
    const safeGatewayResponse = {
      refund_id: result.data.refundId,
      status: result.data.status,
      amount: claim.amount,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: finalizeError } = await (admin.rpc as any)(
      "finalize_paymongo_refund_admin",
      {
        p_refund_id: refundId,
        p_status: finalStatus,
        p_paymongo_refund_id: result.data.refundId,
        p_gateway_response: safeGatewayResponse,
        p_failure_message: finalStatus === "failed" ? "PayMongo returned failed status." : null,
      },
    );
    if (finalizeError) {
      return {
        success: false,
        error: "PayMongo accepted the refund, but local reconciliation failed. Do not retry; review the PayMongo dashboard.",
      };
    }

    if (finalStatus === "failed") {
      return { success: false, error: "PayMongo returned a failed refund status." };
    }

    return {
      success: true,
      paymentId: result.data.refundId,
    };
  } catch (err) {
    if (refundId) {
      try {
        const admin = createAdminClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (admin.rpc as any)("finalize_paymongo_refund_admin", {
          p_refund_id: refundId,
          p_status: "manual_review",
          p_paymongo_refund_id: null,
          p_gateway_response: {},
          p_failure_message: "Unexpected server error; verify PayMongo before retrying.",
        });
      } catch {
        // Preserve the original error while leaving the claimed refund non-repeatable.
      }
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected refund error occurred.",
    };
  }
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
