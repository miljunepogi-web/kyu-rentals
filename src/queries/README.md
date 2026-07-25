# Query Functions Conventions (`src/queries/`)

All server-side database read functions live in this directory.

## Rules:
1. Every file uses the `.queries.ts` extension (e.g. `packages.queries.ts`).
2. Query functions are pure data-fetching helpers called in Server Components or passed to TanStack Query.
3. Every query against soft-delete-enabled tables MUST include `WHERE is_deleted = FALSE`.
4. Query functions must never modify database state.
5. All return types must be explicitly typed using types from `@/types/supabase` or `@/types`.
