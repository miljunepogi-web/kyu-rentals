import { beforeEach, describe, expect, test, vi } from "vitest";
import { captureException } from "@/lib/monitoring";
import { QueryError, throwQueryError } from "@/queries/query-error";

vi.mock("@/lib/monitoring", () => ({ captureException: vi.fn() }));

describe("query error handling", () => {
  beforeEach(() => vi.clearAllMocks());

  test("captures the complete database error with operation context", () => {
    const databaseError = {
      code: "42501",
      message: "permission denied for table bookings",
      hint: "Grant the required privilege.",
    };

    expect(() => throwQueryError("admin.bookings.list", databaseError)).toThrow(QueryError);
    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({ name: "QueryError", operation: "admin.bookings.list" }),
      {
        tags: { layer: "query", operation: "admin.bookings.list" },
        extra: { databaseError },
      },
    );
  });

  test("preserves the original error as the cause", () => {
    const databaseError = new Error("network unavailable");

    try {
      throwQueryError("admin.calendar.list", databaseError);
    } catch (error) {
      expect(error).toBeInstanceOf(QueryError);
      expect((error as QueryError).cause).toBe(databaseError);
    }
  });
});
