import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const whitelistMigration = fs.readFileSync(
  path.join(migrationsDir, "20260728132610_register_all_public_id_sequences.sql"),
  "utf8",
);

describe("public ID sequence whitelist", () => {
  test("registers every sequence referenced by a generate_public_id table default", () => {
    const referencedSequences = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .flatMap((file) => {
        const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
        return [...sql.matchAll(/generate_public_id\('[^']+',\s*'([^']+)'\)/g)].map(
          (match) => match[1],
        );
      });

    expect(referencedSequences.length).toBeGreaterThan(0);
    for (const sequence of new Set(referencedSequences)) {
      expect(whitelistMigration).toContain(`'${sequence}'`);
    }
  });

  test("keeps the generator restricted to service role", () => {
    expect(whitelistMigration).toContain(
      "REVOKE ALL ON FUNCTION public.generate_public_id(TEXT, TEXT) FROM PUBLIC, anon, authenticated",
    );
    expect(whitelistMigration).toContain(
      "GRANT EXECUTE ON FUNCTION public.generate_public_id(TEXT, TEXT) TO service_role",
    );
  });
});
