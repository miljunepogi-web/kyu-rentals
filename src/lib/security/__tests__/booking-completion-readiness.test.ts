import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260728133141_enforce_booking_completion_readiness.sql",
  ),
  "utf8",
);

describe("booking completion readiness", () => {
  test("requires a settled balance before completion", () => {
    expect(migration).toContain("IF COALESCE(v_balance_amount, 0) > 0 THEN");
    expect(migration).toContain("Completion blocked: Booking % has an outstanding balance");
  });

  test("requires the assigned unit to leave IN_USE before completion", () => {
    expect(migration).toContain("IF v_assigned_unit_status = 'IN_USE' THEN");
    expect(migration).toContain("must be inspected and returned to READY_TO_DEPLOY or moved to UNDER_REPAIR");
  });

  test("retains caller authorization and a pinned search path", () => {
    expect(migration).toContain("public.has_permission('bookings.manage', p_tenant_id)");
    expect(migration).toContain("SECURITY DEFINER SET search_path = public");
  });
});
