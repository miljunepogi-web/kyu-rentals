import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260728142351_format_admin_payment_timeline_amounts.sql",
  ),
  "utf8",
).toLowerCase();

describe("admin payment timeline formatting", () => {
  test("renders zero and non-zero monetary values with two decimal places", () => {
    expect(migration).toContain("to_char(p_amount, 'fm999,999,990.00')");
    expect(migration).toContain("to_char(v_new_balance, 'fm999,999,990.00')");
  });

  test("preserves permission checks and least-privilege execution grants", () => {
    expect(migration).toContain("has_permission('financials.manage'");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated, service_role");
  });
});
