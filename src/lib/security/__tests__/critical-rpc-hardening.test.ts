import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260728210000_harden_critical_admin_mutation_rpcs.sql",
  ),
  "utf8",
).toLowerCase();

describe("critical admin RPC hardening migration", () => {
  test.each([
    ["record_admin_payment_atomic", "financials.manage"],
    ["assign_inventory_unit_atomic", "inventory.manage"],
    ["transition_booking_status_admin", "bookings.manage"],
  ])("%s verifies the authenticated caller and permission", (functionName, permission) => {
    const start = migration.indexOf(`create or replace function public.${functionName}`);
    expect(start).toBeGreaterThanOrEqual(0);

    const nextFunction = migration.indexOf("create or replace function public.", start + 1);
    const definition = migration.slice(start, nextFunction === -1 ? undefined : nextFunction);

    expect(definition).toContain("auth.uid()");
    expect(definition).toContain(`has_permission('${permission}'`);
    expect(definition).toContain("security definer set search_path = public");
  });
});
