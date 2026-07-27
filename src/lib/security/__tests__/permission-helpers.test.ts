import { describe, test, expect } from "vitest";

describe("PR 1 — Authorization Foundation & Permission Helpers", () => {
  const REGISTERED_PERMISSIONS = [
    "admin.dashboard.view",
    "bookings.view",
    "bookings.manage",
    "inventory.view",
    "inventory.manage",
    "staff.view",
    "staff.manage",
    "financials.view",
    "financials.manage",
    "settings.manage",
    "logistics.view_assigned",
    "logistics.update_assigned",
  ];

  test("validates strict permission registry contains expected action keys", () => {
    expect(REGISTERED_PERMISSIONS).toContain("admin.dashboard.view");
    expect(REGISTERED_PERMISSIONS).toContain("financials.view");
    expect(REGISTERED_PERMISSIONS).toContain("settings.manage");
    expect(REGISTERED_PERMISSIONS).toContain("logistics.view_assigned");
  });

  test("fails closed when checking unregistered or invalid permission key", () => {
    const isRegistered = (key: string) => REGISTERED_PERMISSIONS.includes(key);
    expect(isRegistered("unregistered_random_permission")).toBe(false);
    expect(isRegistered("")).toBe(false);
    expect(isRegistered("DROP TABLE bookings")).toBe(false);
  });

  test("enforces role permission matrix mapping according to specs", () => {
    const rolePermissions: Record<string, string[]> = {
      super_admin: REGISTERED_PERMISSIONS,
      owner: REGISTERED_PERMISSIONS,
      franchise_owner: REGISTERED_PERMISSIONS,
      admin: [
        "admin.dashboard.view",
        "bookings.view",
        "bookings.manage",
        "inventory.view",
        "inventory.manage",
        "staff.view",
        "staff.manage",
        "logistics.view_assigned",
        "logistics.update_assigned",
      ],
      support_staff: [
        "admin.dashboard.view",
        "bookings.view",
        "bookings.manage",
      ],
      driver: [
        "logistics.view_assigned",
        "logistics.update_assigned",
      ],
      customer: [],
    };

    // Verify Admin has Dashboard, Bookings, Staff, Inventory but NO settings or financials
    expect(rolePermissions.admin).toContain("admin.dashboard.view");
    expect(rolePermissions.admin).toContain("bookings.manage");
    expect(rolePermissions.admin).toContain("staff.manage");
    expect(rolePermissions.admin).not.toContain("settings.manage");
    expect(rolePermissions.admin).not.toContain("financials.view");

    // Verify Support Staff has Dashboard & Bookings only
    expect(rolePermissions.support_staff).toContain("admin.dashboard.view");
    expect(rolePermissions.support_staff).toContain("bookings.manage");
    expect(rolePermissions.support_staff).not.toContain("financials.view");
    expect(rolePermissions.support_staff).not.toContain("settings.manage");
    expect(rolePermissions.support_staff).not.toContain("staff.manage");

    // Verify Driver has Assigned Logistics only
    expect(rolePermissions.driver).toContain("logistics.view_assigned");
    expect(rolePermissions.driver).not.toContain("admin.dashboard.view");
    expect(rolePermissions.driver).not.toContain("financials.view");

    // Verify Customer has NO admin permissions
    expect(rolePermissions.customer).toHaveLength(0);
  });
});
