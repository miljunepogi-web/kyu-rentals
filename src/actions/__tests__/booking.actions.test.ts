import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publicFrom: vi.fn(),
  publicRpc: vi.fn(),
  adminFrom: vi.fn(),
  adminRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: { id: "customer-1", email: "test@example.com" } },
        error: null,
      })),
    },
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

import { createBookingAction } from "../booking.actions";
import { createClient } from "@/lib/supabase/server";

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

    mocks.publicFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return queryReturning({
          data: {
            id: "customer-1",
            tenant_id: "tenant-1",
            email: "test@example.com",
          },
          error: null,
        });
      }

      if (table === "packages") {
        return queryReturning({
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
      }

      throw new Error(`Public client unexpectedly accessed ${table}`);
    });

    let idempotencyAccess = 0;
    mocks.adminFrom.mockImplementation((table: string) => {
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

    mocks.adminRpc.mockResolvedValue({
      data: {
        booking_id: "booking-1",
        booking_public_id: "BK-000001",
        expires_at: "2026-08-01T00:15:00.000Z",
      },
      error: null,
    });
  });

  test("rejects direct booking action calls without an authenticated customer", async () => {
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn(async () => ({
          data: { user: null },
          error: null,
        })),
      },
      from: mocks.publicFrom,
      rpc: mocks.publicRpc,
    } as never);

    const result = await createBookingAction(
      {
        packageSlug: "kyu-mini",
        eventDate: "2026-08-15",
        startTime: "14:00",
        durationHours: 4,
        deliveryAddress: "123 QA Street, Quezon City",
        deliveryZone: "Metro Manila Core",
        customerFullName: "Unauthenticated Customer",
        customerEmail: "test@example.com",
        customerPhone: "09171234567",
        termsAccepted: true,
        addons: [],
      },
      "unauthenticated-booking-key",
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("UNAUTHORIZED");
    expect(mocks.adminFrom).not.toHaveBeenCalled();
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  test("binds atomic booking writes to the authenticated customer profile", async () => {
    const result = await createBookingAction(
      {
        packageSlug: "kyu-mini",
        eventDate: "2026-08-15",
        startTime: "14:00",
        durationHours: 4,
        deliveryAddress: "123 QA Street, Quezon City",
        deliveryZone: "Metro Manila Core",
        customerFullName: "KYU E2E Test",
        customerEmail: "test@example.com",
        customerPhone: "09171234567",
        termsAccepted: true,
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
        p_customer_id: "customer-1",
        p_package_id: "package-1",
      })
    );
  });

  test("replaces browser-supplied add-on details with the server catalog", async () => {
    const result = await createBookingAction(
      {
        packageSlug: "kyu-mini",
        eventDate: "2026-08-15",
        startTime: "14:00",
        durationHours: 4,
        deliveryAddress: "123 QA Street, Quezon City",
        deliveryZone: "Metro Manila Core",
        customerFullName: "KYU Pricing Guard",
        customerEmail: "test@example.com",
        customerPhone: "09171234567",
        termsAccepted: true,
        addons: [
          {
            id: "add-mic",
            quantity: 2,
            name: "Free microphones",
            unitPrice: 0,
          },
        ],
      } as never,
      "canonical-addon-test-key",
    );

    expect(result.success).toBe(true);
    expect(mocks.adminRpc).toHaveBeenCalledWith(
      "create_booking_atomic",
      expect.objectContaining({
        p_snapshot: expect.objectContaining({
          pricingBreakdown: expect.objectContaining({
            addons: [
              {
                id: "add-mic",
                name: "Extra Wireless Mic",
                unitPrice: 300,
                quantity: 2,
                totalPrice: 600,
              },
            ],
            addonsSubtotal: 600,
          }),
          consent: expect.objectContaining({
            termsAccepted: true,
            policyVersion: "2026-07-28",
            policyPath: "/policies/cancellation",
          }),
        }),
      }),
    );
  });

  test("does not leave a processing idempotency key when package validation fails", async () => {
    mocks.publicFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return queryReturning({
          data: {
            id: "customer-1",
            tenant_id: "tenant-1",
            email: "test@example.com",
          },
          error: null,
        });
      }

      if (table === "packages") {
        return queryReturning({ data: null, error: null });
      }

      throw new Error(`Public client unexpectedly accessed ${table}`);
    });

    const result = await createBookingAction(
      {
        packageSlug: "missing-package",
        eventDate: "2026-08-15",
        startTime: "14:00",
        durationHours: 4,
        deliveryAddress: "123 QA Street, Quezon City",
        deliveryZone: "Metro Manila Core",
        customerFullName: "KYU E2E Test",
        customerEmail: "test@example.com",
        customerPhone: "09171234567",
        termsAccepted: true,
        addons: [],
      },
      "failed-booking-test-key"
    );

    const idempotencyCalls = mocks.adminFrom.mock.calls.filter(
      ([table]) => table === "idempotency_keys"
    );

    expect(result.success).toBe(false);
    expect(idempotencyCalls).toHaveLength(1);
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });

  test("returns a conflict and releases idempotency when atomic capacity is exhausted", async () => {
    mocks.adminRpc.mockResolvedValue({
      data: null,
      error: { message: "PACKAGE_FULLY_BOOKED" },
    });

    const result = await createBookingAction(
      {
        packageSlug: "kyu-mini",
        eventDate: "2026-08-15",
        startTime: "14:00",
        durationHours: 4,
        deliveryAddress: "123 QA Street, Quezon City",
        deliveryZone: "Metro Manila Core",
        customerFullName: "KYU Race Test",
        customerEmail: "test@example.com",
        customerPhone: "09171234567",
        termsAccepted: true,
        addons: [],
      },
      "booking-race-key",
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("CONFLICT");
    expect(result.error).toContain("fully booked");
    expect(mocks.adminFrom).toHaveBeenCalledWith("idempotency_keys");
  });

  test("returns a conflict for a repeat customer's duplicate active booking", async () => {
    mocks.adminRpc.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "CUSTOMER_ALREADY_HAS_ACTIVE_BOOKING",
      },
    });

    const result = await createBookingAction(
      {
        packageSlug: "kyu-mini",
        eventDate: "2026-08-15",
        startTime: "14:00",
        durationHours: 4,
        deliveryAddress: "123 QA Street, Quezon City",
        deliveryZone: "Metro Manila Core",
        customerFullName: "KYU Repeat Customer",
        customerEmail: "test@example.com",
        customerPhone: "09171234567",
        termsAccepted: true,
        addons: [],
      },
      "repeat-customer-booking-key",
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("CONFLICT");
    expect(result.error).toContain("already have an active booking");
  });

  test("maps the unique-index race fallback to the repeat-customer conflict", async () => {
    mocks.adminRpc.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "bookings_one_active_customer_package_date"',
      },
    });

    const result = await createBookingAction(
      {
        packageSlug: "kyu-mini",
        eventDate: "2026-08-15",
        startTime: "14:00",
        durationHours: 4,
        deliveryAddress: "123 QA Street, Quezon City",
        deliveryZone: "Metro Manila Core",
        customerFullName: "KYU Repeat Race",
        customerEmail: "test@example.com",
        customerPhone: "09171234567",
        termsAccepted: true,
        addons: [],
      },
      "repeat-customer-race-key",
    );

    expect(result.success).toBe(false);
    expect(result.code).toBe("CONFLICT");
    expect(result.error).toContain("already have an active booking");
  });
});
