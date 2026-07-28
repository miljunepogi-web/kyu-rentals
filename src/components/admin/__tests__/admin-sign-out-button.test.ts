import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src", "components", "admin", "AdminSignOutButton.tsx"),
  "utf8",
);

describe("AdminSignOutButton", () => {
  test("clears the local session and forces a fresh admin request", () => {
    expect(source).toContain('signOut({ scope: "local" })');
    expect(source).toContain('window.location.assign("/admin")');
  });

  test("cannot submit a surrounding form or fire twice", () => {
    expect(source).toContain('type="button"');
    expect(source).toContain("disabled={isSigningOut}");
  });
});
