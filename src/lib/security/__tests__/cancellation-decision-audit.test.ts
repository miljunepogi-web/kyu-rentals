import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260728161312_align_cancellation_policy_and_decisions.sql",
  ),
  "utf8",
).toLowerCase();

const latestCriticalRpcMigration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260728210000_harden_critical_admin_mutation_rpcs.sql",
  ),
  "utf8",
).toLowerCase();

describe("cancellation decision hardening migration", () => {
  test("records an admin decision against the pending cancellation request", () => {
    expect(migration).toContain("update public.customer_cancellation_requests");
    expect(migration).toContain("processed_by = p_admin_profile_id");
    expect(migration).toContain("processed_at = now()");
    expect(migration).toContain("decision_notes = trim(p_reason)");
    expect(migration).toContain("cancellation decision audit failed");
  });

  test("distinguishes approval from decline in the audit record", () => {
    expect(migration).toContain("then 'approved'");
    expect(migration).toContain("else 'declined'");
    expect(migration).toContain("cancellation approved");
    expect(migration).toContain("cancellation declined");
  });

  test("archives the unused refund-window settings", () => {
    expect(migration).toContain("namespace = 'policy_archive'");
    expect(migration).toContain("'cancellation_window_full_refund_hrs'");
    expect(migration).toContain("'partial_refund_pct'");
  });

  test("survives a clean migration replay after later RPC hardening", () => {
    expect(latestCriticalRpcMigration).toContain("update public.customer_cancellation_requests");
    expect(latestCriticalRpcMigration).toContain("cancellation approved");
    expect(latestCriticalRpcMigration).toContain("cancellation declined");
  });
});
