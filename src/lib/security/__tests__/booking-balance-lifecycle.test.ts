import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260728133457_allow_booking_balance_settlement.sql",
  ),
  "utf8",
);

describe("booking balance lifecycle constraint", () => {
  test("allows the remaining balance to decrease after settlement", () => {
    expect(migration).toContain("deposit_amount + balance_amount <= grand_total");
    expect(migration).not.toContain("deposit_amount + balance_amount = grand_total");
  });

  test("retains non-negative and grand-total bounds", () => {
    expect(migration).toContain("deposit_amount >= 0");
    expect(migration).toContain("balance_amount >= 0");
    expect(migration).toContain("deposit_amount <= grand_total");
  });
});
