import { beforeEach, describe, expect, test, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { captureException } from "@/lib/monitoring";
import { getAdminCalendarEvents } from "@/queries/admin-calendar.queries";
import { QueryError } from "@/queries/query-error";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ captureException: vi.fn() }));

describe("getAdminCalendarEvents", () => {
  beforeEach(() => vi.clearAllMocks());

  test("logs and rejects Supabase errors before mapping a null response", async () => {
    const databaseError = {
      code: "42501",
      message: "permission denied for table bookings",
      hint: "Check the role grant.",
    };
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      not: vi.fn(),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.gte.mockReturnValue(query);
    query.lte.mockReturnValue(query);
    query.not.mockResolvedValue({ data: null, error: databaseError });

    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue(query),
    } as unknown as ReturnType<typeof createClient>);

    await expect(getAdminCalendarEvents(2026, 7)).rejects.toBeInstanceOf(QueryError);
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ operation: "admin.calendar.list" }),
      expect.objectContaining({
        tags: { layer: "query", operation: "admin.calendar.list" },
      }),
    );
  });
});
