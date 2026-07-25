# Feature Modules (`src/features/`)

Feature-scoped module directories live here.

## Rules:
1. Create a feature folder when a business module (e.g. `booking`, `inventory`) contains domain-specific components, hooks, or schemas that do not need to be globally shared.
2. Structure inside a feature folder:
   - `components/`
   - `hooks/`
   - `utils/`
   - `types/`
3. Globally shared components stay in `@/components/shared/` or `@/components/ui/`.
