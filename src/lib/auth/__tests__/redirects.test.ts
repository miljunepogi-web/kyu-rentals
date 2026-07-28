import { describe, expect, test } from "vitest";
import { buildEmailConfirmationRedirect, getSafeAuthRedirectPath } from "@/lib/auth/redirects";

describe("auth redirects", () => {
  test.each(["kyu-mini", "kyu-party-pro", "kyu-concert-master"])(
    "builds a production callback that preserves the %s package",
    (packageSlug) => {
      expect(
        buildEmailConfirmationRedirect(
          "https://kyu-rentals.vercel.app",
          `/packages/${packageSlug}/book`,
        ),
      ).toBe(
        `https://kyu-rentals.vercel.app/api/auth/callback?next=%2Fpackages%2F${packageSlug}%2Fbook`,
      );
    },
  );

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
