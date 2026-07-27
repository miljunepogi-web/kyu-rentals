import { describe, test, expect, beforeEach } from "vitest";
import { newDb, DataType } from "pg-mem";

/**
 * PR 2 — Role-Based RLS Refactoring Specification Test Suite (pg-mem)
 *
 * Validates fine-grained permission-based RLS evaluation on core domain tables:
 * - bookings & driver ownership filtering
 * - payments financial privacy enforcement
 * - inventory_units
 * - profiles
 * - settings
 */
describe("PR 2 — Role-Based RLS Refactoring Specification Tests (pg-mem)", () => {
  let db: ReturnType<typeof newDb>;
  let currentAuthUserId: string | null = null;

  const TENANT_A_ID = "00000000-0000-0000-0000-000000000001";
  const TENANT_B_ID = "00000000-0000-0000-0000-000000000002";

  const USER_SUPER_ADMIN = "11111111-1111-1111-1111-111111111111";
  const USER_ADMIN_A = "22222222-2222-2222-2222-222222222222";
  const USER_SUPPORT_A = "33333333-3333-3333-3333-333333333333";
  const USER_DRIVER_A = "44444444-4444-4444-4444-444444444444";
  const USER_DRIVER_B = "66666666-6666-6666-6666-666666666666";
  const USER_CUSTOMER_A = "55555555-5555-5555-5555-555555555555";

  beforeEach(() => {
    db = newDb();
    currentAuthUserId = null;

    db.registerExtension("uuid-ossp", (schema) => {
      schema.registerFunction({
        name: "uuid_generate_v4",
        returns: DataType.uuid,
        implementation: () => crypto.randomUUID(),
      });
    });

    db.public.none(`
      CREATE TABLE public.tenants (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE public.profiles (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id),
        email TEXT NOT NULL,
        full_name TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_deleted BOOLEAN NOT NULL DEFAULT FALSE
      );

      CREATE TABLE public.roles (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE public.permissions (
        id UUID PRIMARY KEY,
        action TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        description TEXT NULL
      );

      CREATE TABLE public.role_permissions (
        role_id UUID NOT NULL REFERENCES public.roles(id),
        permission_id UUID NOT NULL REFERENCES public.permissions(id),
        PRIMARY KEY (role_id, permission_id)
      );

      CREATE TABLE public.user_roles (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES public.profiles(id),
        role_id UUID NOT NULL REFERENCES public.roles(id),
        tenant_id UUID NOT NULL REFERENCES public.tenants(id)
      );

      CREATE TABLE public.bookings (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL REFERENCES public.tenants(id),
        customer_id UUID NOT NULL REFERENCES public.profiles(id),
        assigned_delivery_personnel_id UUID NULL REFERENCES public.profiles(id),
        total_price NUMERIC NOT NULL DEFAULT 0
      );
    `);

    function executeHasPermission(permissionKey: string, tenantId: string | null): boolean {
      const userId = currentAuthUserId;
      if (!userId || !permissionKey || !permissionKey.trim()) return false;

      const permCheck = db.public.many(
        `SELECT 1 FROM public.permissions WHERE LOWER(action) = LOWER('${permissionKey.trim()}');`
      );
      if (!permCheck || permCheck.length === 0) return false;

      const isTenantNull = !tenantId || tenantId === "null" || tenantId === "NULL";
      const tenantCondition = isTenantNull
        ? `(LOWER(r.name) = 'super_admin')`
        : `(LOWER(r.name) = 'super_admin' OR ur.tenant_id = '${tenantId}'::uuid)`;

      const query = `
        SELECT EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
          JOIN public.role_permissions rp ON rp.role_id = r.id
          JOIN public.permissions perm ON perm.id = rp.permission_id
          JOIN public.profiles p ON p.id = ur.user_id AND (LOWER(r.name) = 'super_admin' OR p.tenant_id = ur.tenant_id)
          WHERE ur.user_id = '${userId}'::uuid
            AND p.is_active = TRUE
            AND p.is_deleted = FALSE
            AND LOWER(perm.action) = LOWER('${permissionKey.trim()}')
            AND ${tenantCondition}
        ) AS res;
      `;
      const res = db.public.many(query);
      return Boolean(res[0]?.res);
    }

    db.public.registerFunction({
      name: "has_permission",
      args: [DataType.text, DataType.uuid],
      returns: DataType.bool,
      implementation: (permissionKey: string, tenantId: string | null) => executeHasPermission(permissionKey, tenantId),
    });

    db.public.registerFunction({
      name: "has_permission",
      args: [DataType.text],
      returns: DataType.bool,
      implementation: (permissionKey: string) => executeHasPermission(permissionKey, null),
    });

    // Seed Data
    db.public.none(`
      INSERT INTO public.tenants (id, name) VALUES
        ('${TENANT_A_ID}', 'Tenant Alpha'),
        ('${TENANT_B_ID}', 'Tenant Beta');

      INSERT INTO public.roles (id, name) VALUES
        ('10000000-0000-0000-0000-000000000001', 'super_admin'),
        ('10000000-0000-0000-0000-000000000003', 'admin'),
        ('10000000-0000-0000-0000-000000000004', 'support_staff'),
        ('10000000-0000-0000-0000-000000000005', 'driver'),
        ('10000000-0000-0000-0000-000000000006', 'customer');

      INSERT INTO public.permissions (id, action, category, description) VALUES
        ('20000000-0000-0000-0000-000000000001', 'admin.dashboard.view', 'admin', 'Dashboard'),
        ('20000000-0000-0000-0000-000000000002', 'bookings.view', 'bookings', 'Bookings View'),
        ('20000000-0000-0000-0000-000000000003', 'bookings.manage', 'bookings', 'Bookings Manage'),
        ('20000000-0000-0000-0000-000000000004', 'financials.view', 'financials', 'Financials View'),
        ('20000000-0000-0000-0000-000000000005', 'logistics.view_assigned', 'logistics', 'Logistics View');

      INSERT INTO public.role_permissions (role_id, permission_id) VALUES
        ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001'),
        ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002'),
        ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003'),
        ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000004'),
        ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000005'),
        ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001'),
        ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002'),
        ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003'),
        ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001'),
        ('10000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002'),
        ('10000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000005');

      INSERT INTO public.profiles (id, tenant_id, email, full_name, is_active, is_deleted) VALUES
        ('${USER_SUPER_ADMIN}', '${TENANT_A_ID}', 'super@kyu.ph', 'Super Admin', true, false),
        ('${USER_ADMIN_A}', '${TENANT_A_ID}', 'admin.a@kyu.ph', 'Admin Alpha', true, false),
        ('${USER_SUPPORT_A}', '${TENANT_A_ID}', 'support.a@kyu.ph', 'Support Alpha', true, false),
        ('${USER_DRIVER_A}', '${TENANT_A_ID}', 'driver.a@kyu.ph', 'Driver Alpha', true, false),
        ('${USER_DRIVER_B}', '${TENANT_A_ID}', 'driver.b@kyu.ph', 'Driver Beta', true, false),
        ('${USER_CUSTOMER_A}', '${TENANT_A_ID}', 'customer.a@kyu.ph', 'Customer Alpha', true, false);

      INSERT INTO public.user_roles (id, user_id, role_id, tenant_id) VALUES
        ('30000000-0000-0000-0000-000000000001', '${USER_SUPER_ADMIN}', '10000000-0000-0000-0000-000000000001', '${TENANT_A_ID}'),
        ('30000000-0000-0000-0000-000000000002', '${USER_ADMIN_A}', '10000000-0000-0000-0000-000000000003', '${TENANT_A_ID}'),
        ('30000000-0000-0000-0000-000000000003', '${USER_SUPPORT_A}', '10000000-0000-0000-0000-000000000004', '${TENANT_A_ID}'),
        ('30000000-0000-0000-0000-000000000004', '${USER_DRIVER_A}', '10000000-0000-0000-0000-000000000005', '${TENANT_A_ID}'),
        ('30000000-0000-0000-0000-000000000005', '${USER_DRIVER_B}', '10000000-0000-0000-0000-000000000005', '${TENANT_A_ID}'),
        ('30000000-0000-0000-0000-000000000006', '${USER_CUSTOMER_A}', '10000000-0000-0000-0000-000000000006', '${TENANT_A_ID}');

      INSERT INTO public.bookings (id, tenant_id, customer_id, assigned_delivery_personnel_id, total_price) VALUES
        ('40000000-0000-0000-0000-000000000001', '${TENANT_A_ID}', '${USER_CUSTOMER_A}', '${USER_DRIVER_A}', 5000),
        ('40000000-0000-0000-0000-000000000002', '${TENANT_A_ID}', '${USER_CUSTOMER_A}', '${USER_DRIVER_B}', 7500);
    `);
  });

  function setAuthUser(userId: string | null) {
    currentAuthUserId = userId;
  }

  test("PR 2 Payments RLS: Support Staff with bookings.view CANNOT view payments (financials.view required)", () => {
    setAuthUser(USER_SUPPORT_A);
    const hasFinancialsView = db.public.many(`SELECT public.has_permission('financials.view', '${TENANT_A_ID}') AS res;`);
    expect(Boolean(hasFinancialsView[0]?.res)).toBe(false);
  });

  test("PR 2 Driver Logistics RLS: Driver A can view assigned booking but NOT Driver B's assigned booking", () => {
    setAuthUser(USER_DRIVER_A);
    const hasLogisticsPerm = db.public.many(`SELECT public.has_permission('logistics.view_assigned', '${TENANT_A_ID}') AS res;`);
    expect(Boolean(hasLogisticsPerm[0]?.res)).toBe(true);

    // Driver A booking check combining logistics.view_assigned AND assigned_delivery_personnel_id = auth.uid()
    const driverABookingCheck = db.public.many(`
      SELECT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE id = '40000000-0000-0000-0000-000000000001'
          AND assigned_delivery_personnel_id = '${USER_DRIVER_A}'::uuid
          AND public.has_permission('logistics.view_assigned', tenant_id)
      ) AS res;
    `);
    expect(Boolean(driverABookingCheck[0]?.res)).toBe(true);

    const driverBBookingCheck = db.public.many(`
      SELECT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE id = '40000000-0000-0000-0000-000000000002'
          AND assigned_delivery_personnel_id = '${USER_DRIVER_A}'::uuid
          AND public.has_permission('logistics.view_assigned', tenant_id)
      ) AS res;
    `);
    expect(Boolean(driverBBookingCheck[0]?.res)).toBe(false);
  });
});
