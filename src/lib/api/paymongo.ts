import { z } from "zod";
import { logger } from "@/utils/logger";
import { ErrorCode } from "@/utils/errors";
import { Result } from "@/types";

// Environment Variable Validation Schema
export const paymongoEnvSchema = z.object({
  PAYMONGO_SECRET_KEY: z.string().min(1, "PAYMONGO_SECRET_KEY environment variable is required"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

/**
 * Get validated PayMongo configuration from process.env.
 * Prohibits mock checkout keys in production environment (NODE_ENV === 'production').
 */
export function getPayMongoConfig() {
  const isProduction = process.env.NODE_ENV === "production";
  const secretKey = process.env.PAYMONGO_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (isProduction && (!secretKey || secretKey.startsWith("sk_test_mock"))) {
    throw new Error("PAYMONGO_SECRET_KEY environment variable must be a valid live/test key in production environment.");
  }

  const effectiveSecretKey = secretKey || "sk_test_mock_paymongo_key_kyu_rentals";
  return { secretKey: effectiveSecretKey, appUrl };
}

export interface CreateCheckoutSessionInput {
  bookingId: string;
  bookingPublicId: string;
  customerFullName: string;
  customerEmail: string;
  customerPhone: string;
  packageName: string;
  depositAmount: number; // In Philippine Pesos (PHP)
}

export interface PayMongoCheckoutSessionResponse {
  checkoutSessionId: string;
  checkoutUrl: string;
  paymentIntentId?: string;
}

export interface CreatePayMongoRefundInput {
  paymentId: string;
  amount: number;
  reason: "duplicate" | "fraudulent" | "others";
  notes: string;
}

export interface PayMongoRefundResponse {
  refundId: string;
  status: string;
  raw: Record<string, unknown>;
}

export async function createPayMongoRefund(
  input: CreatePayMongoRefundInput
): Promise<Result<PayMongoRefundResponse>> {
  const { secretKey } = getPayMongoConfig();
  const amountInCentavos = Math.round(input.amount * 100);

  if (amountInCentavos < 100) {
    return {
      success: false,
      error: "PayMongo refunds must be at least PHP 1.00.",
      code: ErrorCode.BAD_REQUEST,
    };
  }

  if (secretKey.startsWith("sk_test_mock")) {
    if (process.env.NODE_ENV === "production") {
      return {
        success: false,
        error: "Mock refunds are disabled in production.",
        code: ErrorCode.BAD_REQUEST,
      };
    }
    return {
      success: true,
      data: {
        refundId: `ref_mock_${Date.now()}`,
        status: "succeeded",
        raw: { mode: "mock", amount: amountInCentavos },
      },
    };
  }

  try {
    const response = await fetch("https://api.paymongo.com/v1/refunds", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`,
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amountInCentavos,
            payment_id: input.paymentId,
            reason: input.reason,
            notes: input.notes,
          },
        },
      }),
    });
    const responseJson = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: responseJson?.errors?.[0]?.detail || "PayMongo rejected the refund.",
        code: ErrorCode.BAD_REQUEST,
      };
    }

    return {
      success: true,
      data: {
        refundId: responseJson.data.id,
        status: responseJson.data.attributes?.status || "pending",
        raw: responseJson,
      },
    };
  } catch (error) {
    logger.error("PayMongo refund request outcome is uncertain", {
      error: error instanceof Error ? error.message : "Unknown network error",
    });
    return {
      success: false,
      error: "PayMongo did not return a conclusive response. Review the PayMongo dashboard before retrying.",
      code: ErrorCode.INTERNAL_ERROR,
    };
  }
}

/**
 * Creates a PayMongo Checkout Session for 30% reservation deposit payment.
 * Server-authoritative: Amount is passed strictly from pricing engine calculation.
 * Parse response.json() exactly once.
 * Treats payment_intent as optional.
 * Restricts mock engine to non-production environments.
 */
export async function createPayMongoCheckoutSession(
  input: CreateCheckoutSessionInput
): Promise<Result<PayMongoCheckoutSessionResponse>> {
  const { secretKey, appUrl } = getPayMongoConfig();

  // Convert PHP amount to centavos (PayMongo integer format: ₱100.00 = 10000 centavos)
  const amountInCentavos = Math.round(input.depositAmount * 100);

  const payload = {
    data: {
      attributes: {
        amount: amountInCentavos,
        currency: "PHP",
        description: `KYU Rentals 30% Reservation Deposit for ${input.bookingPublicId}`,
        line_items: [
          {
            name: `${input.packageName} (30% Non-Refundable Reservation Deposit)`,
            amount: amountInCentavos,
            currency: "PHP",
            quantity: 1,
            description: `Event date reservation lock for ${input.customerFullName}`,
          },
        ],
        payment_method_types: ["gcash", "paymaya", "card", "grab_pay"],
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        cancel_url: `${appUrl}/packages?canceled=true`,
        success_url: `${appUrl}/dashboard?booking=${input.bookingId}&success=true`,
        metadata: {
          booking_id: input.bookingId,
          booking_public_id: input.bookingPublicId,
          customer_email: input.customerEmail,
          customer_name: input.customerFullName,
        },
      },
    },
  };

  // Mock Checkout Engine restricted strictly to development/test environments
  if (secretKey.startsWith("sk_test_mock")) {
    if (process.env.NODE_ENV === "production") {
      return {
        success: false,
        error: "Mock checkout engine is disabled in production environment.",
        code: ErrorCode.BAD_REQUEST,
      };
    }

    logger.info("Using PayMongo Mock Checkout Engine (Development/Test Mode Only)", {
      bookingId: input.bookingId,
      depositAmount: input.depositAmount,
    });

    return {
      success: true,
      data: {
        checkoutSessionId: `cs_mock_${Date.now()}`,
        checkoutUrl: `${appUrl}/dashboard?booking=${input.bookingId}&mock_checkout=true`,
        paymentIntentId: `pi_mock_${Date.now()}`,
      },
    };
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;

    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(payload),
    });

    // Parse response.json() EXACTLY ONCE (Finding #2)
    const responseJson = await response.json();

    if (!response.ok) {
      logger.error("PayMongo API Checkout Session creation failed", { responseJson });
      return {
        success: false,
        error: responseJson?.errors?.[0]?.detail || "PayMongo Checkout API call failed",
        code: ErrorCode.BAD_REQUEST,
      };
    }

    const sessionData = responseJson.data;

    // Treat payment_intent as optional (Finding #6)
    const paymentIntentId = sessionData?.attributes?.payment_intent?.id || undefined;

    return {
      success: true,
      data: {
        checkoutSessionId: sessionData.id,
        checkoutUrl: sessionData.attributes.checkout_url,
        paymentIntentId,
      },
    };
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("createPayMongoCheckoutSession exception", { error: err.message });
    return {
      success: false,
      error: err.message || "Failed to communicate with PayMongo payment gateway",
      code: ErrorCode.INTERNAL_ERROR,
    };
  }
}
