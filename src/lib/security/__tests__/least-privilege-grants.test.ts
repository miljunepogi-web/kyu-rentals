import { describe, test, expect, beforeEach } from "vitest";
import { newDb, DataType } from "pg-mem";

/**
 * PR 3 — Least Privilege Table & Function Grants Specification Test Suite (pg-mem)
 *
 * Validates least privilege grant expectations, privilege assertions, and fail-closed behaviors:
 * - has_table_privilege simulation
 * - has_function_privilege simulation
 * - has_sequence_privilege simulation
 * - packages-only anon catalog read access
 * - immutable ledger write restrictions
 */
describe("PR 3 — Least Privilege Table & Function Grants Specification Tests (pg-mem)", () => {
  let db: ReturnType<typeof newDb>;

  beforeEach(() => {
    db = newDb();

    db.registerExtension("uuid-ossp", (schema) => {
      schema.registerFunction({
        name: "uuid_generate_v4",
        returns: DataType.uuid,
        implementation: () => crypto.randomUUID(),
      });
    });

    db.public.none(`
      CREATE TABLE public.packages (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        name TEXT NOT NULL,
        is_published BOOLEAN NOT NULL DEFAULT TRUE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE public.payments (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        booking_id UUID NOT NULL,
        amount NUMERIC NOT NULL
      );

      CREATE TABLE public.audit_logs (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        action TEXT NOT NULL
      );

      CREATE TABLE public.reviews (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        booking_id UUID NOT NULL UNIQUE,
        rating INTEGER NOT NULL,
        is_approved BOOLEAN NOT NULL DEFAULT FALSE
      );
    `);

    // Privilege Simulation Table
    const tablePrivileges: Record<string, Record<string, string[]>> = {
      anon: {
        "public.packages": ["SELECT"],
        "public.payments": [],
        "public.audit_logs": [],
        "public.reviews": [],
      },
      authenticated: {
        "public.packages": ["SELECT"],
        "public.payments": ["SELECT"],
        "public.audit_logs": ["SELECT"],
        "public.reviews": ["SELECT", "INSERT"],
      },
    };

    db.public.registerFunction({
      name: "has_table_privilege",
      args: [DataType.text, DataType.text, DataType.text],
      returns: DataType.bool,
      implementation: (role: string, table: string, privilege: string) => {
        const rolePrivs = tablePrivileges[role];
        if (!rolePrivs) return false;
        const targetTable = table.includes(".") ? table : `public.${table}`;
        const privs = rolePrivs[targetTable] || [];
        return privs.includes(privilege.toUpperCase());
      },
    });

    const functionPrivileges: Record<string, string[]> = {
      "public.create_booking_atomic": ["service_role"],
      "public.record_admin_payment_atomic": ["authenticated", "service_role"],
      "public.process_paymongo_webhook_atomic": ["service_role"],
      "public.generate_public_id": ["service_role"],
    };

    db.public.registerFunction({
      name: "has_function_privilege",
      args: [DataType.text, DataType.text, DataType.text],
      returns: DataType.bool,
      implementation: (role: string, funcSignature: string, privilege: string) => {
        if (privilege.toUpperCase() !== "EXECUTE") return false;
        const allowedRoles = functionPrivileges[funcSignature] || [];
        return allowedRoles.includes(role);
      },
    });

    const sequencePrivileges: Record<string, string[]> = {
      "public.bookings_public_id_seq": ["service_role"],
      "public.payments_public_id_seq": ["service_role"],
    };

    db.public.registerFunction({
      name: "has_sequence_privilege",
      args: [DataType.text, DataType.text, DataType.text],
      returns: DataType.bool,
      implementation: (role: string, seq: string, _privilege: string) => {
        const allowedRoles = sequencePrivileges[seq] || [];
        return allowedRoles.includes(role);
      },
    });
  });

  test("PR 3 Privilege Assertions: Table Privilege Simulation Check", () => {
    const anonPackageSelect = db.public.many(`SELECT public.has_table_privilege('anon', 'public.packages', 'SELECT') AS res;`);
    expect(Boolean(anonPackageSelect[0]?.res)).toBe(true);

    const anonPaymentSelect = db.public.many(`SELECT public.has_table_privilege('anon', 'public.payments', 'SELECT') AS res;`);
    expect(Boolean(anonPaymentSelect[0]?.res)).toBe(false);

    const anonReviewSelect = db.public.many(`SELECT public.has_table_privilege('anon', 'public.reviews', 'SELECT') AS res;`);
    expect(Boolean(anonReviewSelect[0]?.res)).toBe(false);

    const authPaymentInsert = db.public.many(`SELECT public.has_table_privilege('authenticated', 'public.payments', 'INSERT') AS res;`);
    expect(Boolean(authPaymentInsert[0]?.res)).toBe(false);

    const authAuditDelete = db.public.many(`SELECT public.has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') AS res;`);
    expect(Boolean(authAuditDelete[0]?.res)).toBe(false);
  });

  test("PR 3 Privilege Assertions: Function Execution Privilege Check", () => {
    const authCreateBooking = db.public.many(`SELECT public.has_function_privilege('authenticated', 'public.create_booking_atomic', 'EXECUTE') AS res;`);
    expect(Boolean(authCreateBooking[0]?.res)).toBe(false);

    const anonWebhookRpc = db.public.many(`SELECT public.has_function_privilege('anon', 'public.process_paymongo_webhook_atomic', 'EXECUTE') AS res;`);
    expect(Boolean(anonWebhookRpc[0]?.res)).toBe(false);

    const authWebhookRpc = db.public.many(`SELECT public.has_function_privilege('authenticated', 'public.process_paymongo_webhook_atomic', 'EXECUTE') AS res;`);
    expect(Boolean(authWebhookRpc[0]?.res)).toBe(false);
  });

  test("PR 3 Privilege Assertions: Sequence Privilege Check", () => {
    const authSeqUsage = db.public.many(`SELECT public.has_sequence_privilege('authenticated', 'public.payments_public_id_seq', 'USAGE') AS res;`);
    expect(Boolean(authSeqUsage[0]?.res)).toBe(false);
  });
});
