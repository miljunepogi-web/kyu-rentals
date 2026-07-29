import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260729164623_prevent_atomic_booking_overflow.sql",
  ),
  "utf8",
);

describe("atomic booking capacity", () => {
  test("serializes capacity checks per tenant, package, and event date", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("p_tenant_id::TEXT || ':' || p_package_id::TEXT || ':' || p_event_date::TEXT");
    expect(migration).toContain("MESSAGE = 'PACKAGE_FULLY_BOOKED'");
  });

  test("counts date-scoped bookings and soft locks inside the transaction", () => {
    expect(migration).toContain("event_date = p_event_date");
    expect(migration).toContain("expires_at > NOW()");
    expect(migration).toContain("v_serviceable_units <= (v_active_bookings + v_active_locks)");
  });

  test("removes the obsolete ten-parameter overload", () => {
    expect(migration).toContain("DROP FUNCTION IF EXISTS public.create_booking_atomic(");
    expect(migration).toContain("UUID, UUID, UUID, DATE, TIME WITHOUT TIME ZONE, INTEGER");
  });

  test("keeps booking creation server-only", () => {
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });
});
