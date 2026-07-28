import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { captureException } from "@/lib/monitoring";
import { getAdminInventoryUnits } from "@/queries/admin-inventory.queries";
import { QueryError } from "@/queries/query-error";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ captureException: vi.fn() }));

describe("getAdminInventoryUnits", () => {
  beforeEach(() => vi.clearAllMocks());

  test("awaits the Supabase query before mapping inventory units", async () => {
    const row = {
      id: "unit-id",
      public_id: "INV-000001",
      tenant_id: "tenant-id",
      package_id: "package-id",
      serial_number: "KYU-MINI-001",
      status: "READY_TO_DEPLOY",
      condition_notes: null,
      created_at: "2026-07-28T00:00:00Z",
      updated_at: "2026-07-28T00:00:00Z",
      packages: { name: "KYU Mini Party" },
    };
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: [row], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createClient>);

    await expect(getAdminInventoryUnits("READY_TO_DEPLOY")).resolves.toEqual([
      expect.objectContaining({
        publicId: "INV-000001",
        serialNumber: "KYU-MINI-001",
        packageName: "KYU Mini Party",
      }),
    ]);
  });

  test("surfaces inventory query failures", async () => {
    const databaseError = { code: "42501", message: "permission denied" };
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      order: vi.fn(),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: databaseError }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.order.mockReturnValue(query);

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createClient>);

    await expect(getAdminInventoryUnits()).rejects.toBeInstanceOf(QueryError);
    expect(captureException).toHaveBeenCalled();
  });
});
