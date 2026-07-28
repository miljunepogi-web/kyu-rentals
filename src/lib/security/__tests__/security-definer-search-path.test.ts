import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260728101429_pin_security_definer_search_path.sql"
);
const auditPath = resolve(process.cwd(), "supabase/checks/database_security_audit.sql");

const migrationSql = readFileSync(migrationPath, "utf8");
const auditSql = readFileSync(auditPath, "utf8");

describe("SECURITY DEFINER search_path hardening", () => {
  test("pins every current public SECURITY DEFINER function using identity arguments", () => {
    expect(migrationSql).toMatch(/procedure\.prosecdef\s*=\s*TRUE/i);
    expect(migrationSql).toContain("pg_catalog.pg_get_function_identity_arguments");
    expect(migrationSql).toContain(
      "ALTER FUNCTION %I.%I(%s) SET search_path TO pg_catalog, public, pg_temp"
    );
  });

  test("security audit detects privileged functions without a configured search_path", () => {
    expect(auditSql).toMatch(/procedure\.prosecdef\s*=\s*TRUE/i);
    expect(auditSql).toContain("setting LIKE 'search_path=%'");
  });
});
