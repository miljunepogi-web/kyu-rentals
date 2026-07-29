import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260729170121_guard_repeat_customer_bookings.sql",
  ),
  "utf8",
);

describe("repeat customer booking guard", () => {
  test("uniquely identifies an active reservation by customer, package, and date", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX bookings_one_active_customer_package_date");
    expect(migration).toContain(
      "ON public.bookings (tenant_id, customer_id, package_id, event_date)",
    );
  });

  test("blocks pending and operational bookings including cancellation review", () => {
    expect(migration).toContain("'PENDING_PAYMENT'");
    expect(migration).toContain("'CONFIRMED'");
    expect(migration).toContain("'CANCELLATION_REQUESTED'");
    expect(migration).toContain("'PICKED_UP'");
  });

  test.each(["CANCELLED", "REJECTED", "EXPIRED", "PAYMENT_FAILED", "REFUNDED", "COMPLETED"])(
    "allows a new reservation after terminal status %s",
    (status) => {
      expect(migration).not.toContain(`'${status}'`);
    },
  );
});
