import { NextResponse } from "next/server";
import { processPayMongoWebhookEvent } from "@/lib/webhooks/paymongo-processor";
import { logger } from "@/utils/logger";

/**
 * Milestone 3.5: PayMongo Webhook Route Handler (POST /api/webhooks/paymongo).
 * Security: Validates signature header, enforces webhook inbox idempotency,
 * validates financial payment metadata, and executes PENDING_PAYMENT -> CONFIRMED transition.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("paymongo-signature");

    const result = await processPayMongoWebhookEvent(rawBody, signatureHeader);

    if (!result.success) {
      logger.warn("PayMongo Webhook Processing Error", { error: result.error, code: result.code });
      
      const status =
        result.code === "UNAUTHORIZED"
          ? 401
          : result.code === "NOT_FOUND"
          ? 404
          : result.code === "CONFLICT"
          ? 409
          : result.code === "BAD_REQUEST"
          ? 400
          : 500;

      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json(
      {
        received: true,
        eventId: result.data?.eventId,
        duplicate: result.data?.duplicate || false,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("PayMongo Webhook Route Exception", { error: err.message });
    return NextResponse.json({ error: "Internal webhook processor error" }, { status: 500 });
  }
}
