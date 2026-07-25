# KYU Rentals — Development Standards & Workflow

## Git & Commit Conventions

Follow Conventional Commits:
- `feat: add package comparison component`
- `fix: resolve overtime calculation bug`
- `docs: update master specification`
- `chore: bump dependencies`

Pre-commit hooks (Husky + lint-staged) automatically run ESLint and Prettier on staged files.

## Coding Rules

1. **Strict TypeScript**: Never use `any`. Use `unknown` or create explicit types.
2. **Server Actions**: Must validate input with Zod and return `Result<T>`. Never throw.
3. **No Console Logs**: Use `logger.info()`, `logger.warn()`, or `logger.error()`.
4. **CSS Custom Properties**: Design tokens use CSS variables (`globals.css`).
5. **Client Components**: Server Components by default. Add `"use client"` only when interactive state is required.
