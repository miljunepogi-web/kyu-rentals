import { describe, expect, test } from "vitest";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/availability/availability-engine";

describe("cancellation availability policy", () => {
  test("keeps inventory reserved while a cancellation request is under review", () => {
    expect(ACTIVE_BOOKING_STATUSES).toContain("CANCELLATION_REQUESTED");
  });

  test.each(["CANCELLED", "REJECTED", "EXPIRED"])(
    "does not block inventory for terminal status %s",
    (status) => {
      expect(ACTIVE_BOOKING_STATUSES).not.toContain(status);
    },
  );
});
