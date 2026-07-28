import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publicFrom: vi.fn(),
  publicRpc: vi.fn(),
  adminFrom: vi.fn(),
  adminRpc: vi.fn(),
  checkAvailability: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: null } })) },
    from: mocks.publicFrom,
    rpc: mocks.publicRpc,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mocks.adminFrom,
    rpc: mocks.adminRpc,
  })),
}));

vi.mock("@/lib/availability/availability-engine", () => ({
  checkPackageAvailability: mocks.checkAvailability,
}));

import { createBookingAction } from "../booking.actions";

function queryReturning<T>(result: T) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

function updateQuery() {
  const query = {
    update: vi.fn(),
    eq: vi.fn(),
  };
  query.update.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}

describe("createBookingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    let packageRead = 0;
    mocks.publicFrom.mockImplementation((table: string) => {
      if (table !== "packages") {
        throw new Error(`Public client unexpectedly accessed ${table}`);
      }

      packageRead += 1;
      return packageRead === 1
        ? queryReturning({ data: { tenant_id: "tenant-1" } })
        : queryReturning({
            data: {
              id: "package-1",
              name: "KYU Mini Party",
              slug: "kyu-mini",
              price_4_hours: 1800,
              price_8_hours: 2500,
              price_full_day: 3000,
            },
            error: null,
          });
    });

    let idempotencyAccess = 0;
    mocks.adminFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return queryReturning({ data: null });
      }

      if (table === "idempotency_keys") {
        idempotencyAccess += 1;
        if (idempotencyAccess === 1) {
          return queryReturning({ data: null });
        }
        if (idempotencyAccess === 2) {
          return { insert: vi.fn(async () => ({ error: null })) };
        }
        return updateQuery();
      }

      throw new Error(`Admin client unexpectedly accessed ${table}`);
    });

    mocks.checkAvailability.mockResolvedValue({ available: true });
    mocks.adminRpc.mockResolvedValue({
      data: {
        booking_id: "booking-1",
        booking_public_id: "BK-000001",
        expires_at: "2026-08-01T00:15:00.000Z",
      },
      error: null,
    });
  });

  test("uses the server-only admin client for guest idempotency and atomic booking writes", async () => {
    const result = await createBookingAction(
      {
        packageSlug: "kyu-mini",
        eventDate: "2026-08-15",
        startTime: "14:00",
        durationHours: 4,
        deliveryAddress: "123 QA Street, Quezon City",
        deliveryZone: "METRO_MANILA",
        customerFullName: "KYU E2E Test",
        customerEmail: "test@example.com",
        customerPhone: "09171234567",
        addons: [],
      },
      "booking-test-key"
    );

    expect(result.success).toBe(true);
    expect(mocks.publicFrom).toHaveBeenCalledTimes(2);
    expect(mocks.publicRpc).not.toHaveBeenCalled();
    expect(mocks.adminFrom).toHaveBeenCalledWith("idempotency_keys");
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "create_booking_atomic",
      expect.objectContaining({
        p_tenant_id: "tenant-1",
        p_customer_id: null,
        p_package_id: "package-1",
      })
    );
  });
});
