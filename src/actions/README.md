# Server Actions Conventions (`src/actions/`)

All Next.js Server Actions live in this directory.

## Rules:
1. Every file uses the `.actions.ts` extension (e.g. `booking.actions.ts`).
2. Must include `"use server";` directive at the top of the file.
3. Every action MUST validate input with a Zod schema before database operations.
4. Server Actions MUST return the standard `Result<T>` type:
   `{ success: true, data: T }` OR `{ success: false, error: string, code: ErrorCode }`.
5. NEVER throw unhandled exceptions to the client.
6. Actions MUST log operations and errors through `@/utils/logger` and `@/lib/monitoring`.
