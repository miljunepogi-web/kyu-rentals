import { describe, expect, test } from "vitest";
import { buildEmailConfirmationRedirect, getSafeAuthRedirectPath } from "@/lib/auth/redirects";

describe("auth redirects", () => {
  test("builds a production callback that preserves the selected package", () => {
    expect(
      buildEmailConfirmationRedirect("https://kyu-rentals.vercel.app", "/packages/kyu-mini/book"),
    ).toBe("https://kyu-rentals.vercel.app/api/auth/callback?next=%2Fpackages%2Fkyu-mini%2Fbook");
  });

  test("uses the current origin instead of a localhost fallback", () => {
    expect(
      buildEmailConfirmationRedirect("https://kyu-rentals-preview.vercel.app", "/dashboard"),
    ).toMatch(/^https:\/\/kyu-rentals-preview\.vercel\.app\/api\/auth\/callback/);
  });

  test.each([
    [null, "/dashboard"],
    ["", "/dashboard"],
    ["https://attacker.example", "/dashboard"],
    ["//attacker.example", "/dashboard"],
    ["/packages/kyu-mini/book", "/packages/kyu-mini/book"],
  ])("sanitizes callback destination %j", (next, expected) => {
    expect(getSafeAuthRedirectPath(next)).toBe(expected);
  });
});
