"use server";

import { createClient } from "@/lib/supabase/server";

export interface RequestCancellationPayload {
  bookingId: string;
  currentStatus?: string;
  reason: string;
}

export interface SubmitReviewPayload {
  bookingId: string;
  rating: number;
  comment?: string;
}

export interface UpdateProfilePayload {
  fullName: string;
  phone?: string;
}

export interface CustomerActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

async function resolveCustomerSession(): Promise<
  | { success: true; userId: string; tenantId: string }
  | { success: false; error: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized: No authenticated session. Please log in." };
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
    return { success: false, error: "Could not resolve your customer profile." };
  }

  return { success: true, userId: user.id, tenantId: profileData.tenant_id };
}

/**
 * Server Action: Customer Request Booking Cancellation
 *
 * Executes request_booking_cancellation_customer RPC atomically.
 */
export async function requestBookingCancellationAction(
  payload: RequestCancellationPayload
): Promise<CustomerActionResult> {
  try {
    if (!payload.bookingId?.trim()) {
      return { success: false, error: "Booking ID is required." };
    }
    if (!payload.reason?.trim() || payload.reason.trim().length < 3) {
      return { success: false, error: "Please provide a valid cancellation reason (at least 3 characters)." };
    }

    const session = await resolveCustomerSession();
    if (!session.success) return { success: false, error: session.error };

    const { userId, tenantId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "request_booking_cancellation_customer",
      {
        p_tenant_id: tenantId,
        p_booking_id: payload.bookingId.trim(),
        p_expected_current_status: payload.currentStatus || null,
        p_reason: payload.reason.trim(),
        p_customer_id: userId,
      }
    );

    if (rpcError) {
      return {
        success: false,
        error: rpcError.message || "Failed to submit cancellation request.",
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = rpcResult as any;
    if (!response || response.status !== "success") {
      return {
        success: false,
        error: response?.message || "Cancellation request rejected.",
      };
    }

    return { success: true, data: response };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Server Action: Submit Verified Customer Review for Completed Booking
 */
export async function submitCustomerReviewAction(
  payload: SubmitReviewPayload
): Promise<CustomerActionResult> {
  try {
    if (!payload.bookingId?.trim()) {
      return { success: false, error: "Booking ID is required." };
    }
    if (!payload.rating || payload.rating < 1 || payload.rating > 5) {
      return { success: false, error: "Please provide a rating between 1 and 5 stars." };
    }

    const session = await resolveCustomerSession();
    if (!session.success) return { success: false, error: session.error };

    const { userId, tenantId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "submit_customer_review",
      {
        p_tenant_id: tenantId,
        p_booking_id: payload.bookingId.trim(),
        p_customer_id: userId,
        p_rating: payload.rating,
        p_comment: payload.comment?.trim() || null,
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message || "Failed to submit review." };
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
 * Server Action: Update Customer Profile Details
 */
export async function updateCustomerProfileAction(
  payload: UpdateProfilePayload
): Promise<CustomerActionResult> {
  try {
    if (!payload.fullName?.trim()) {
      return { success: false, error: "Full name is required." };
    }

    const session = await resolveCustomerSession();
    if (!session.success) return { success: false, error: session.error };

    const { userId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("profiles")
      .update({
        full_name: payload.fullName.trim(),
        phone: payload.phone?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      return { success: false, error: updateError.message || "Failed to update profile." };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
