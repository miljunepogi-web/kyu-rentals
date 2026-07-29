import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729182329_harden_payment_confirmation_pipeline.sql",
  ),
  "utf8",
);

const paymentAction = readFileSync(
  resolve(process.cwd(), "src/actions/payment.actions.ts"),
  "utf8",
);

describe("critical payment confirmation hardening", () => {
  test("serializes late payment capacity decisions and routes conflicts to manual review", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("v_has_live_lock");
    expect(migration).toContain("PAYMENT_CAPACITY_CONFLICT");
    expect(migration).toContain("'status', 'manual_review'");
    expect(migration).toContain("SET status = 'PAYMENT_PROCESSING'");
  });

  test("enforces one active hosted deposit checkout per booking", () => {
    expect(migration).toContain("payments_one_active_paymongo_deposit_session");
    expect(migration).toContain("status IN ('PROCESSING', 'PENDING')");
    expect(paymentAction).toContain('status: "PROCESSING"');
    expect(paymentAction).toContain('claimError?.code === "23505"');
  });

  test("persists confirmation delivery state for webhook retries", () => {
    expect(migration).toContain("booking_notification_outbox");
    expect(migration).toContain("booking_notification_outbox_booking_type_key");
    expect(migration).toContain("'BOOKING_CONFIRMED'");
  });

  test("keeps internal staff timeline notes out of customer-visible history", () => {
    expect(migration).toContain("visibility = 'CUSTOMER'");
    expect(migration).toContain("SET visibility = 'INTERNAL'");
  });
});
