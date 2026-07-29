"use server";

import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { calculateBookingPrice } from "@/lib/pricing/pricing-engine";
import { checkPackageAvailability } from "@/lib/availability/availability-engine";
import { Result } from "@/types";
import { ErrorCode } from "@/utils/errors";
import { logger } from "@/utils/logger";
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
    const { data: userData } = await supabase.auth.getUser();
    let currentUserId = userData?.user?.id;
    let resolvedTenantId: string | null = null;

    if (currentUserId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: userProfile } = await (supabase.from("profiles") as any)
        .select("id, tenant_id")
        .eq("id", currentUserId)
        .eq("is_deleted", false)
        .maybeSingle();

      if (userProfile?.tenant_id) {
        resolvedTenantId = userProfile.tenant_id;
      }
    }

    if (!currentUserId || !resolvedTenantId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingProfile } = await (adminSupabase.from("profiles") as any)
        .select("id, tenant_id")
        .eq("email", payload.customerEmail)
        .eq("is_deleted", false)
        .maybeSingle();

      if (existingProfile) {
        currentUserId = existingProfile.id;
        resolvedTenantId = existingProfile.tenant_id;
      }
    }

    if (!resolvedTenantId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: pkgTenantData } = await (supabase.from("packages") as any)
        .select("tenant_id")
        .eq("slug", payload.packageSlug)
        .eq("is_published", true)
        .eq("is_deleted", false)
        .maybeSingle();

      if (pkgTenantData?.tenant_id) {
        resolvedTenantId = pkgTenantData.tenant_id;
      }
    }

    if (!resolvedTenantId) {
      return {
        success: false,
        error: "Unable to resolve tenant context for booking creation",
        code: ErrorCode.BAD_REQUEST,
      };
    }

    tenantId = resolvedTenantId;

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

    // E. Fast UX pre-check. The RPC repeats this authoritatively under a lock.
    const availResult = await checkPackageAvailability({
      supabase: adminSupabase,
      tenantId,
      packageId,
      eventDate: payload.eventDate,
      durationHours: payload.durationHours,
    });

    if (!availResult.available) {
      return {
        success: false,
        error: `Selected package is fully booked for date ${payload.eventDate}. Please choose another date.`,
        code: ErrorCode.CONFLICT,
      };
    }

    // F. Pure Server-Side Pricing Calculation
    const pricing = calculateBookingPrice({
      basePrice4Hours: pkg.price_4_hours,
      basePrice8Hours: pkg.price_8_hours,
      basePriceFullDay: pkg.price_full_day,
      durationHours: payload.durationHours,
      eventDate: payload.eventDate,
      addons: payload.addons,
      deliveryZone: payload.deliveryZone,
      promoDiscount: 0,
      isHoliday: false,
    });

    // G. Calculate Schedule Boundaries & Soft Lock Expiry
    const [startHour, startMin] = payload.startTime.split(":").map(Number);
    const startDt = new Date(`${payload.eventDate}T${String(startHour).padStart(2, "0")}:${String(startMin || 0).padStart(2, "0")}:00`);
    const eventEndTime = new Date(startDt.getTime() + payload.durationHours * 3600 * 1000).toISOString();
    const lockExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15-Minute Soft Lock TTL

    // H. Freeze Immutable Booking Snapshot
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
    };

    // I. Register the request only after all read-only validation succeeds.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: keyInsertErr } = await (adminSupabase.from("idempotency_keys") as any).insert({
      tenant_id: tenantId,
      key: idempotencyKey,
      request_path: "/api/v1/bookings/start",
      request_hash: requestHash,
      status: "processing",
    });

    if (keyInsertErr) {
      logger.error("Idempotency key insert error", { error: keyInsertErr });
      return {
        success: false,
        error: "Failed to initialize request idempotency record",
        code: ErrorCode.INTERNAL_ERROR,
      };
    }

    idempotencyRegistered = true;

    // J. TRUE ATOMIC TRANSACTION via PostgreSQL RPC `create_booking_atomic`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcErr } = await (adminSupabase.rpc as any)("create_booking_atomic", {
      p_tenant_id: tenantId,
      p_customer_id: currentUserId || null,
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

    // K. Update Idempotency Key Status to 'completed' with Response Cache
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
