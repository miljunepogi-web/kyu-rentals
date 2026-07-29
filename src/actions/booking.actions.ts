"use server";

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateBookingPrice } from "@/lib/pricing/pricing-engine";
import { Result } from "@/types";
import { ErrorCode } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { BOOKING_ADDONS } from "@/config/booking-options.config";
import { CANCELLATION_POLICY } from "@/config/cancellation-policy.config";
import {
  createBookingInputSchema,
  type CreateBookingInput,
} from "@/schemas/booking.schema";

export interface CreateBookingResponse {
  bookingId: string;
  bookingPublicId: string;
  expiresAt: string;
  grandTotal: number;
  depositAmount: number;
  balanceAmount: number;
  isIdempotentReplay?: boolean;
}

/**
 * Milestone 3.3 (Hardened & RPC Validated): Booking Creation API & Server Action.
 * Executes true atomic database transaction via `public.create_booking_atomic()` RPC.
 * Performs strict response verification on RPC output before finalizing idempotency.
 */
export async function createBookingAction(
  input: CreateBookingInput,
  idempotencyKey: string
): Promise<Result<CreateBookingResponse>> {
  // A. Server-Side Input Validation
  const parsed = createBookingInputSchema.safeParse(input);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => i.message).join(", ");
    return {
      success: false,
      error: `Validation error: ${errorDetails}`,
      code: ErrorCode.VALIDATION_ERROR,
    };
  }

  if (!idempotencyKey || !idempotencyKey.trim()) {
    return {
      success: false,
      error: "Header 'Idempotency-Key' is required for booking creation",
      code: ErrorCode.BAD_REQUEST,
    };
  }

  const payload = parsed.data;
  const requestHash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  let idempotencyRegistered = false;
  let tenantId = "";

  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // B. Tenant & Customer Context Resolution
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: "Please sign in before creating a booking.",
        code: ErrorCode.UNAUTHORIZED,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: userProfile, error: profileError } = await (supabase.from("profiles") as any)
      .select("id, tenant_id, email")
      .eq("id", user.id)
      .eq("is_active", true)
      .eq("is_deleted", false)
      .maybeSingle();

    if (profileError || !userProfile?.tenant_id || !userProfile?.email) {
      return {
        success: false,
        error: "Unable to resolve an active customer profile for this booking.",
        code: ErrorCode.UNAUTHORIZED,
      };
    }

    if (userProfile.email.trim().toLowerCase() !== payload.customerEmail.trim().toLowerCase()) {
      return {
        success: false,
        error: "Booking email must match the authenticated customer account.",
        code: ErrorCode.CONFLICT,
      };
    }

    const currentUserId = user.id;
    tenantId = userProfile.tenant_id;

    // C. Idempotency Key Processing & Processing Lock Check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingKeyData } = await (adminSupabase.from("idempotency_keys") as any)
      .select("status, response_body, request_hash")
      .eq("tenant_id", tenantId)
      .eq("key", idempotencyKey)
      .maybeSingle();

    interface IdempotencyRecord {
      status: "processing" | "completed" | "failed";
      response_body: CreateBookingResponse | null;
      request_hash: string;
    }

    const existingKey = existingKeyData as IdempotencyRecord | null;

    if (existingKey) {
      if (existingKey.request_hash !== requestHash) {
        return {
          success: false,
          error: "Idempotency-Key collision: Key was previously used with different request parameters",
          code: ErrorCode.CONFLICT,
        };
      }

      if (existingKey.status === "completed" && existingKey.response_body) {
        logger.info("Idempotent replay served", { idempotencyKey });
        return {
          success: true,
          data: {
            ...existingKey.response_body,
            isIdempotentReplay: true,
          },
        };
      }

      if (existingKey.status === "processing") {
        return {
          success: false,
          error: "A booking creation request with this Idempotency-Key is currently in progress",
          code: ErrorCode.CONFLICT,
        };
      }
    }

    // D. Package Lookup & Strict Price Verification
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pkgData, error: pkgErr } = await (supabase.from("packages") as any)
      .select("id, name, slug, price_4_hours, price_8_hours, price_full_day")
      .eq("tenant_id", tenantId)
      .eq("slug", payload.packageSlug)
      .eq("is_published", true)
      .eq("is_deleted", false)
      .maybeSingle();

    interface PkgRecord {
      id: string;
      name: string;
      slug: string;
      price_4_hours: number;
      price_8_hours: number;
      price_full_day: number;
    }

    const pkg = pkgData as PkgRecord | null;

    if (pkgErr || !pkg) {
      logger.warn("Package lookup failed during booking creation", { slug: payload.packageSlug, error: pkgErr });
      return {
        success: false,
        error: `Requested package '${payload.packageSlug}' is not available or does not exist`,
        code: ErrorCode.NOT_FOUND,
      };
    }

    const packageId = pkg.id;
    const packageName = pkg.name;
    const canonicalAddons = payload.addons.map((selection) => {
      const addon = BOOKING_ADDONS[selection.id];
      return {
        id: selection.id,
        name: addon.name,
        unitPrice: addon.unitPrice,
        quantity: selection.quantity,
      };
    });

    // E. Pure Server-Side Pricing Calculation
    const pricing = calculateBookingPrice({
      basePrice4Hours: pkg.price_4_hours,
      basePrice8Hours: pkg.price_8_hours,
      basePriceFullDay: pkg.price_full_day,
      durationHours: payload.durationHours,
      eventDate: payload.eventDate,
      addons: canonicalAddons,
      deliveryZone: payload.deliveryZone,
      promoDiscount: 0,
      isHoliday: false,
    });

    // F. Calculate Schedule Boundaries & Soft Lock Expiry
    const [startHour, startMin] = payload.startTime.split(":").map(Number);
    const startDt = new Date(`${payload.eventDate}T${String(startHour).padStart(2, "0")}:${String(startMin || 0).padStart(2, "0")}:00`);
    const eventEndTime = new Date(startDt.getTime() + payload.durationHours * 3600 * 1000).toISOString();
    const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15-Minute Soft Lock TTL

    // G. Freeze Immutable Booking Snapshot
    const snapshot = {
      snapshotTimestamp: new Date().toISOString(),
      package: {
        id: packageId,
        name: packageName,
        slug: payload.packageSlug,
        selectedDuration: payload.durationHours,
        appliedBasePrice: pricing.basePackagePrice,
      },
      pricingBreakdown: pricing,
      customer: {
        fullName: payload.customerFullName,
        email: payload.customerEmail,
        phone: payload.customerPhone,
        deliveryAddress: payload.deliveryAddress,
        deliveryZone: payload.deliveryZone,
        specialInstructions: payload.specialInstructions,
      },
      consent: {
        termsAccepted: true,
        acceptedAt: new Date().toISOString(),
        policyVersion: CANCELLATION_POLICY.version,
        policyPath: CANCELLATION_POLICY.path,
      },
    };

    // H. Register the request only after all read-only validation succeeds.
    let keyInsertErr: { message?: string } | null = null;
    if (existingKey?.status === "failed") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: claimedKey, error } = await (adminSupabase.from("idempotency_keys") as any)
        .update({
          status: "processing",
          response_status: null,
          response_body: null,
        })
        .eq("tenant_id", tenantId)
        .eq("key", idempotencyKey)
        .eq("status", "failed")
        .select("id")
        .maybeSingle();
      keyInsertErr = error;
      if (!error && !claimedKey) {
        return {
          success: false,
          error: "This booking retry is already being processed.",
          code: ErrorCode.CONFLICT,
        };
      }
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (adminSupabase.from("idempotency_keys") as any).insert({
        tenant_id: tenantId,
        key: idempotencyKey,
        user_id: currentUserId,
        request_path: "/api/v1/bookings/start",
        request_hash: requestHash,
        status: "processing",
      });
      keyInsertErr = error;
    }

    if (keyInsertErr) {
      logger.error("Idempotency key insert error", { error: keyInsertErr });
      return {
        success: false,
        error: "Failed to initialize request idempotency record",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }

    idempotencyRegistered = true;

    // I. TRUE ATOMIC TRANSACTION via PostgreSQL RPC `create_booking_atomic`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcErr } = await (adminSupabase.rpc as any)("create_booking_atomic", {
      p_tenant_id: tenantId,
      p_customer_id: currentUserId,
      p_customer_email: payload.customerEmail,
      p_customer_name: payload.customerFullName,
      p_customer_phone: payload.customerPhone,
      p_package_id: packageId,
      p_event_date: payload.eventDate,
      p_start_time: payload.startTime,
      p_duration_hours: payload.durationHours,
      p_event_end_time: eventEndTime,
      p_delivery_address: payload.deliveryAddress,
      p_delivery_zone: payload.deliveryZone || null,
      p_special_instructions: payload.specialInstructions || null,
      p_subtotal_amount: pricing.subtotalBeforeSurcharges,
      p_surcharge_amount: pricing.totalSurcharges,
      p_delivery_fee: pricing.deliveryFee,
      p_discount_amount: pricing.discountAmount,
      p_grand_total: pricing.grandTotal,
      p_deposit_amount: pricing.depositAmount,
      p_balance_amount: pricing.balanceAmount,
      p_snapshot: snapshot,
      p_lock_expires_at: lockExpiresAt,
      p_idempotency_key: idempotencyKey,
    });

    // Task #1 Hardening: Verify RPC Response Payload Structure
    if (
      rpcErr ||
      !rpcResult ||
      !rpcResult.booking_id ||
      !rpcResult.booking_public_id ||
      !rpcResult.expires_at
    ) {
      logger.error("Atomic RPC transaction create_booking_atomic returned malformed payload", {
        rpcErr,
        rpcResult,
      });

      if (idempotencyRegistered) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase.from("idempotency_keys") as any)
          .update({ status: "failed" })
          .eq("tenant_id", tenantId)
          .eq("key", idempotencyKey);
      }

      if (rpcErr?.message?.includes("PACKAGE_FULLY_BOOKED")) {
        return {
          success: false,
          error: `Selected package is fully booked for date ${payload.eventDate}. Please choose another date.`,
          code: ErrorCode.CONFLICT,
        };
      }

      if (rpcErr?.message?.includes("CUSTOMER_ALREADY_HAS_ACTIVE_BOOKING")) {
        return {
          success: false,
          error: `You already have an active booking for this package on ${payload.eventDate}. Please open your dashboard instead of creating another reservation.`,
          code: ErrorCode.CONFLICT,
        };
      }

      if (
        rpcErr?.code === "23505" &&
        rpcErr?.message?.includes("bookings_one_active_customer_package_date")
      ) {
        return {
          success: false,
          error: `You already have an active booking for this package on ${payload.eventDate}. Please open your dashboard instead of creating another reservation.`,
          code: ErrorCode.CONFLICT,
        };
      }

      return {
        success: false,
        error: "Atomic transaction failed or returned an invalid payload structure",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }

    const bookingId = rpcResult.booking_id;
    const bookingPublicId = rpcResult.booking_public_id;

    const responsePayload: CreateBookingResponse = {
      bookingId,
      bookingPublicId,
      expiresAt: lockExpiresAt,
      grandTotal: pricing.grandTotal,
      depositAmount: pricing.depositAmount,
      balanceAmount: pricing.balanceAmount,
    };

    // J. Update Idempotency Key Status to 'completed' with Response Cache
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase.from("idempotency_keys") as any)
      .update({
        status: "completed",
        response_status: 201,
        response_body: responsePayload,
      })
      .eq("tenant_id", tenantId)
      .eq("key", idempotencyKey);

    logger.info("Atomic booking created successfully", {
      bookingId,
      bookingPublicId,
      idempotencyKey,
      grandTotal: pricing.grandTotal,
    });

    return {
      success: true,
      data: responsePayload,
    };
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("createBookingAction exception", { error: err.message });

    if (idempotencyRegistered && tenantId) {
      try {
        const adminSupabase = createAdminClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase.from("idempotency_keys") as any)
          .update({ status: "failed" })
          .eq("tenant_id", tenantId)
          .eq("key", idempotencyKey);
      } catch {
        // Ignore secondary cleanup error
      }
    }

    return {
      success: false,
      error: err.message || "Internal server error during booking creation",
      code: ErrorCode.INTERNAL_ERROR,
    };
  }
}
