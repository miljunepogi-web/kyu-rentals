# KYU Rentals — Folder Structure Guide

```
kyu-rentals/
├── docs/                             # Architecture & project documentation
├── public/                           # Static assets
└── src/
    ├── app/                          # Next.js App Router (pages, layouts, routes)
    │   ├── (auth)/                   # Unauthenticated route group (login, register)
    │   ├── (dashboard)/              # Authenticated route group (dashboard, admin)
    │   └── api/                      # Route handlers (auth callback, health check)
    ├── actions/                      # Server Actions (.actions.ts)
    ├── queries/                      # Data fetching functions (.queries.ts)
    ├── features/                     # Feature-scoped modules (domain isolation)
    ├── components/
    │   ├── ui/                       # shadcn/ui base primitives
    │   ├── layout/                   # Structural layout primitives (Header, Sidebar)
    │   └── shared/                   # Domain-agnostic components (ThemeToggle)
    ├── config/                       # Application config & environment validation
    ├── constants/                    # Business constants
    ├── hooks/                        # Custom React hooks (TanStack Query)
    ├── lib/                          # External client SDKs & core infrastructure
    │   ├── supabase/                 # Supabase browser, server, middleware clients
    │   ├── api/                      # Base HTTP fetch wrapper & third-party API clients
    │   ├── monitoring/               # Observability facade & Sentry stub
    │   └── feature-flags.ts          # Feature flag system
    ├── providers/                    # React context providers (Theme, TanStack Query)
    ├── schemas/                      # Zod validation schemas
    ├── styles/                       # Global CSS & Tailwind design tokens
    ├── types/                        # TypeScript type definitions
    ├── utils/                        # Pure utility functions (logger, formatters)
    └── middleware.ts                 # Next.js edge middleware (session & protection)
```
