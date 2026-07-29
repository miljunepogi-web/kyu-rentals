import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import { savePackageSchema } from "@/schemas/package.schema";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729184243_add_admin_package_management.sql",
  ),
  "utf8",
);
const publicGrantMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729185936_grant_public_package_inclusions.sql",
  ),
  "utf8",
);
const publicRuntimeGrantMigration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260729190214_grant_public_package_runtime_columns.sql",
  ),
  "utf8",
);
const catalogQuery = readFileSync(
  resolve(process.cwd(), "src/queries/packages.queries.ts"),
  "utf8",
);
const bookingAction = readFileSync(
  resolve(process.cwd(), "src/actions/booking.actions.ts"),
  "utf8",
);

describe("admin package management hardening", () => {
  test("uses a dedicated catalog permission and tenant-scoped package policies", () => {
    expect(migration).toContain("'catalog.manage'");
    expect(migration).toContain(
      "public.has_permission('catalog.manage', tenant_id)",
    );
    expect(migration).toContain(
      'CREATE POLICY "Authenticated view permitted packages"',
    );
    expect(migration).toContain(
      'CREATE POLICY "Catalog managers update tenant packages"',
    );
  });

  test("secures product images by bucket and tenant folder", () => {
    expect(migration).toContain("'package-images'");
    expect(migration).toContain("(storage.foldername(name))[1]");
    expect(migration).toContain("file_size_limit");
    expect(migration).toContain("'image/webp'");
  });

  test("makes Supabase the public catalog authority", () => {
    expect(catalogQuery).toContain('.from("packages")');
    expect(catalogQuery).toContain('cache: "no-store"');
    expect(catalogQuery).not.toContain("MOCK_PACKAGES");
  });

  test("exposes only structured inclusions to anonymous catalog readers", () => {
    expect(publicGrantMigration).toContain(
      "GRANT SELECT (inclusions) ON TABLE public.packages TO anon",
    );
    expect(publicGrantMigration).not.toContain("GRANT SELECT ON TABLE");
  });

  test("grants only runtime version/filter columns required by the anonymous query", () => {
    expect(publicRuntimeGrantMigration).toContain(
      "GRANT SELECT (version, is_deleted) ON TABLE public.packages TO anon",
    );
    expect(publicRuntimeGrantMigration).not.toContain("GRANT SELECT ON TABLE");
  });

  test("freezes the full package version and terms in new booking snapshots", () => {
    expect(bookingAction).toContain("version: pkg.version");
    expect(bookingAction).toContain("inclusions: pkg.inclusions");
    expect(bookingAction).toContain("fourHours: pkg.price_4_hours");
    expect(bookingAction).toContain("fullDay: pkg.price_full_day");
  });

  test("rejects incomplete or unsafe package payloads", () => {
    const parsed = savePackageSchema.safeParse({
      id: "5d582d25-49cc-46e3-960e-5975d40d48ca",
      version: 1,
      name: "Real Karaoke Package",
      slug: "REAL PACKAGE",
      tagline: "",
      description: "Too short",
      price4Hours: -1,
      price8Hours: 2500,
      priceFullDay: 3000,
      featuredImageUrl: "not-a-url",
      galleryUrls: [],
      maxGuests: "",
      soundRating: "",
      inclusions: [],
      isFeatured: false,
      isPopular: false,
      isPublished: true,
    });

    expect(parsed.success).toBe(false);
  });
});
