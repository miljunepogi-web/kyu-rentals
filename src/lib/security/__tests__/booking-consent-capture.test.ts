import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260729173546_capture_booking_terms_consent.sql",
  ),
  "utf8",
);

describe("booking terms consent persistence", () => {
  test("stores the acceptance timestamp and policy identity on the booking", () => {
    expect(migration).toContain("ADD COLUMN terms_accepted_at TIMESTAMPTZ");
    expect(migration).toContain("ADD COLUMN terms_policy_version TEXT");
    expect(migration).toContain("ADD COLUMN terms_policy_path TEXT");
  });

  test("requires recent complete consent for every new web booking", () => {
    expect(migration).toContain("BOOKING_TERMS_ACCEPTANCE_REQUIRED");
    expect(migration).toContain("BOOKING_TERMS_ACCEPTANCE_TIMESTAMP_OUT_OF_RANGE");
    expect(migration).toContain("NEW.created_source <> 'WEB'");
    expect(migration).toContain("BEFORE INSERT ON public.bookings");
  });

  test("does not expose the enforcement function through the Data API", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.enforce_booking_terms_consent() FROM PUBLIC, anon, authenticated",
    );
  });
});
