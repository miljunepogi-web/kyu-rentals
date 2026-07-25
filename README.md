# KYU Rentals

> The professional karaoke rental management platform for the Philippine market.

## Overview

KYU Rentals is a production-ready web application for managing a karaoke rental business — covering online booking, scheduling, inventory management, payments, delivery operations, and an admin dashboard. Built to scale from a single business into a full SaaS platform.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS + Shadcn/ui |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Payments | PayMongo |
| Email | Resend + React Email |
| SMS | Semaphore (PH) |
| Hosting | Vercel |
| Monitoring | Sentry |
| Analytics | PostHog + Vercel Analytics |

---

## Documentation

All planning and specification documents are in the `/docs` folder.

| Document | Description |
|----------|-------------|
| [`KYU-RENTALS-MASTER-SPEC.md`](./docs/KYU-RENTALS-MASTER-SPEC.md) | **← START HERE** The official project constitution. Single source of truth. |
| [`KYU-RENTALS-PHASE-0-BLUEPRINT.md`](./docs/KYU-RENTALS-PHASE-0-BLUEPRINT.md) | Phase 0: Technical Blueprint |
| [`KYU-RENTALS-PHASE-05-ARCHITECTURE.md`](./docs/KYU-RENTALS-PHASE-05-ARCHITECTURE.md) | Phase 0.5: Architecture Review & Refinement |
| [`KYU-RENTALS-PHASE-06-BUSINESS.md`](./docs/KYU-RENTALS-PHASE-06-BUSINESS.md) | Phase 0.6: Business & Product Review |

---

## Development Phases

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Planning & Architecture | ✅ Complete |
| Phase 1 | Foundation & Database | 🔲 Not Started |
| Phase 2 | Public Website & Packages | 🔲 Not Started |
| Phase 3 | Booking Wizard & Payments | 🔲 Not Started |
| Phase 4 | Admin Dashboard | 🔲 Not Started |
| Phase 5 | Delivery Operations | 🔲 Not Started |
| Phase 6 | Finance & Reporting | 🔲 Not Started |
| Phase 7 | Polish & Launch | 🔲 Not Started |

---

## Getting Started

> ⚠️ Development has not started yet. This section will be updated in Phase 1.

```bash
# Clone the repository
git clone <repo-url>
cd kyu-rentals

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local

# Run development server
npm run dev
```

---

## Project Rules (Non-Negotiable)

1. Never permanently delete production records
2. All business logic executes on the server — never trust the client
3. Never trust client-side payment confirmation
4. Automation before manual work
5. Every important action generates an audit log
6. No hardcoded business rule values — all config belongs in the `settings` table
7. Notifications always go through the notification queue
8. `tenant_id` is present on every table
9. Financial records are retained for a minimum of 7 years

> See [`KYU-RENTALS-MASTER-SPEC.md`](./docs/KYU-RENTALS-MASTER-SPEC.md) Section 19 for the full list of 15 immutable project rules.

---

## License

Private & Proprietary. All rights reserved.
