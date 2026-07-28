import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260728133353_align_admin_payment_methods.sql",
  ),
  "utf8",
);

describe("admin payment method constraint", () => {
  test.each(["CASH", "GCASH", "MAYA", "BANK_TRANSFER", "OTHER"])(
    "accepts the %s method allowed by the admin payment RPC",
    (method) => {
      expect(migration).toContain(`'${method}'`);
    },
  );

  test("retains PayMongo checkout methods", () => {
    expect(migration).toContain("'PAYMONGO_CHECKOUT'");
    expect(migration).toContain("'PAYMONGO_GCASH'");
    expect(migration).toContain("'PAYMONGO_MAYA'");
    expect(migration).toContain("'PAYMONGO_CARD'");
  });
});
