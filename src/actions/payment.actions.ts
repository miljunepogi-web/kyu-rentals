"use server";

import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createPayMongoCheckoutSession } from "@/lib/api/paymongo";
import { Result } from "@/types";
import { ErrorCode } from "@/utils/errors";
import { logger } from "@/utils/logger";

const initializePaymentInputSchema = z.object({
  bookingId: z.string().uuid("Invalid booking identifier format"),
});

export type InitializePaymentInput = z.infer<typeof initializePaymentInputSchema>;

export interface InitializePaymentResponse {
  paymentId: string;
  checkoutSessionId: string;
  checkoutUrl: string;
  depositAmount: number;
  currency: string;
  paymentIntentId?: string;
}

/**
 * Milestone 3.4 (Refactored): Payment Layer - Initialize PayMongo Checkout Session.
 * Addresses all Code Review findings:
 * 1. Single consistent return contract.
 * 2. Removed duplicate logger.error() calls.
 * 3. Optional payment_intent handling.
 * 4. Server authoritative deposit calculation from snapshot.
 */
export async function initializeBookingPaymentAction(
  input: InitializePaymentInput
): Promise<Result<InitializePaymentResponse>> {
  const parsed = initializePaymentInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid input parameter for payment initialization",
      code: ErrorCode.VALIDATION_ERROR,
    };
  }

  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // 1. Fetch Booking Record & Verify Ownership Context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: bookingData, error: bookingErr } = await (supabase.from("bookings") as any)
      .select("id, public_id, tenant_id, package_id, status, deposit_amount, snapshot, customer_id")
      .eq("id", parsed.data.bookingId)
      .eq("is_deleted", false)
      .maybeSingle();

    interface BookingRecord {
      id: string;
      public_id: string;
      tenant_id: string;
      package_id: string;
      status: string;
      deposit_amount: number;
      snapshot: {
        package?: { name?: string };
        customer?: { fullName?: string; email?: string; phone?: string };
      };
    }

    const booking = bookingData as BookingRecord | null;

    if (bookingErr || !booking) {
      return {
        success: false,
        error: "Booking record not found for payment initialization",
        code: ErrorCode.NOT_FOUND,
      };
    }

    if (booking.status !== "PENDING_PAYMENT") {
      return {
        success: false,
        error: `Cannot initialize checkout: Booking is in '${booking.status}' status`,
        code: ErrorCode.BAD_REQUEST,
      };
    }

    // 2. Idempotency Check: Reuse active pending payment session if it already exists.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingPaymentData } = await (adminSupabase.from("payments") as any)
      .select("id, gateway_checkout_session_id, gateway_checkout_url, gateway_payment_intent_id, status")
      .eq("booking_id", booking.id)
      .in("status", ["PROCESSING", "PENDING"])
      .maybeSingle();

    interface ExistingPayment {
      id: string;
      gateway_checkout_session_id: string;
      gateway_checkout_url: string;
      gateway_payment_intent_id?: string;
      status: "PROCESSING" | "PENDING";
    }

    const existingPayment = existingPaymentData as ExistingPayment | null;

    if (existingPayment?.gateway_checkout_url) {
      logger.info("Reusing existing active PayMongo Checkout Session", {
        bookingId: booking.id,
        checkoutSessionId: existingPayment.gateway_checkout_session_id,
      });

      return {
        success: true,
        data: {
          paymentId: existingPayment.id,
          checkoutSessionId: existingPayment.gateway_checkout_session_id,
          checkoutUrl: existingPayment.gateway_checkout_url,
          paymentIntentId: existingPayment.gateway_payment_intent_id,
          depositAmount: booking.deposit_amount,
          currency: "PHP",
        },
      };
    }

    if (existingPayment?.status === "PROCESSING") {
      return {
        success: false,
        error: "A PayMongo checkout session is already being initialized. Please retry shortly.",
        code: ErrorCode.CONFLICT,
      };
    }

    // 3. Claim the one active checkout slot before making the external API call.
    // The database partial unique index prevents concurrent tabs from creating
    // multiple payable sessions for the same reservation deposit.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: claimedPayment, error: claimError } = await (adminSupabase.from("payments") as any)
      .insert({
        tenant_id: booking.tenant_id,
        booking_id: booking.id,
        payment_type: "RESERVATION_DEPOSIT",
        payment_method: "PAYMONGO_CHECKOUT",
        gateway_provider: "PAYMONGO",
        amount: booking.deposit_amount,
        currency: "PHP",
        status: "PROCESSING",
      })
      .select("id")
      .single();

    if (claimError || !claimedPayment) {
      if (claimError?.code === "23505") {
        return {
          success: false,
          error: "A PayMongo checkout session already exists or is being initialized. Please retry shortly.",
          code: ErrorCode.CONFLICT,
        };
      }

      logger.error("Failed to claim PayMongo checkout initialization", { error: claimError });
      return {
        success: false,
        error: "Failed to initialize a unique payment session",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }

    // 4. Call PayMongo API Client
    const packageName = booking.snapshot?.package?.name || "KYU Rental Setup";
    const customerName = booking.snapshot?.customer?.fullName || "Valued Customer";
    const customerEmail = booking.snapshot?.customer?.email || "customer@example.com";
    const customerPhone = booking.snapshot?.customer?.phone || "09170000000";

    const gatewayResult = await createPayMongoCheckoutSession({
      bookingId: booking.id,
      bookingPublicId: booking.public_id,
      packageName,
      customerFullName: customerName,
      customerEmail,
      customerPhone,
      depositAmount: booking.deposit_amount,
    });

    if (!gatewayResult.success || !gatewayResult.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase.from("payments") as any)
        .update({ status: "FAILED" })
        .eq("id", claimedPayment.id)
        .eq("status", "PROCESSING");
      return {
        success: false,
        error: gatewayResult.error || "Failed to generate payment gateway session",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }

    const { checkoutSessionId, checkoutUrl, paymentIntentId } = gatewayResult.data;

    // 5. Finalize the claimed payment row with the hosted checkout details.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: paymentRecord, error: paymentUpdateErr } = await (adminSupabase.from("payments") as any)
      .update({
        gateway_checkout_session_id: checkoutSessionId,
        gateway_payment_intent_id: paymentIntentId || null,
        gateway_checkout_url: checkoutUrl,
        status: "PENDING",
      })
      .eq("id", claimedPayment.id)
      .eq("status", "PROCESSING")
      .select("id")
      .single();

    if (paymentUpdateErr || !paymentRecord) {
      logger.error("PayMongo created a checkout but local finalization failed", {
        error: paymentUpdateErr,
        checkoutSessionId,
        paymentId: claimedPayment.id,
      });
      return {
        success: false,
        error: "Checkout was created but local reconciliation is incomplete. Do not retry; contact support.",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }

    // 6. Audit Event Insertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase.from("booking_timeline_events") as any).insert({
      tenant_id: booking.tenant_id,
      booking_id: booking.id,
      from_status: "PENDING_PAYMENT",
      to_status: "PENDING_PAYMENT",
      event_label: "PayMongo Checkout Session Created",
      event_description: `Generated Checkout Session ${checkoutSessionId} for deposit ₱${booking.deposit_amount}`,
      performed_by_role: "customer",
      is_system_event: true,
      metadata: {
        checkoutSessionId,
        depositAmount: booking.deposit_amount,
      },
    });

    logger.info("PayMongo Checkout Session initialized successfully", {
      bookingId: booking.id,
      checkoutSessionId,
      depositAmount: booking.deposit_amount,
    });

    return {
      success: true,
      data: {
        paymentId: paymentRecord.id,
        checkoutSessionId,
        checkoutUrl,
        paymentIntentId,
        depositAmount: booking.deposit_amount,
        currency: "PHP",
      },
    };
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("initializeBookingPaymentAction exception", { error: err.message });
    return {
      success: false,
      error: err.message || "Internal server error during payment initialization",
      code: ErrorCode.INTERNAL_ERROR,
    };
  }
}
