# KYU Rentals — Documentation Index

## 📖 Primary Reference

**Always start here:**
→ [`KYU-RENTALS-MASTER-SPEC.md`](./KYU-RENTALS-MASTER-SPEC.md)

The Master Specification is the official constitution of this project.
It supersedes all other documents when conflicts arise.

---

## 📚 Document Registry

| File | Phase | Description | Status |
|------|-------|-------------|--------|
| `KYU-RENTALS-MASTER-SPEC.md` | 0.7 | **Master Specification — Single Source of Truth** | ✅ v1.0.0 |
| `KYU-RENTALS-PHASE-0-BLUEPRINT.md` | 0.0 | Technical Blueprint (Functional Requirements, Architecture, Tech Stack, DB Planning, Folder Structure) | ✅ v1.0.0 |
| `KYU-RENTALS-PHASE-05-ARCHITECTURE.md` | 0.5 | Architecture Review (Soft Delete, Audit Logs, State Machine, Notification Queue, Inventory Redesign, SaaS Readiness, Risk Assessment) | ✅ v1.0.0 |
| `KYU-RENTALS-PHASE-06-BUSINESS.md` | 0.6 | Business & Product Review (Workflow, CX, Admin UX, Delivery Ops, Payment Experience, Revenue Opportunities, Reporting) | ✅ v1.0.0 |

---

## 🗂 Key Sections Quick Reference

### Business Rules
→ Master Spec Section 3 — All 50+ official rules (Booking, Payment, Cancellation, Refund, Overtime, Damage, Delivery, Pickup, Inventory, Driver)

### Database Tables
→ Master Spec Section 6 — All 41 tables with purpose, relationships, ownership, and lifecycle
→ Phase 0.5 — Detailed column definitions for all tables

### Booking States
→ Master Spec Section 7 — All 16 states, valid/invalid transitions, automated triggers

### Coding Standards
→ Master Spec Section 13 — All 17 development standards

### Security Standards
→ Master Spec Section 15 — Auth, RLS, rate limiting, secrets, GDPR

### Development Roadmap
→ Master Spec Section 20 — All 7 phases with objectives, deliverables, and completion criteria

### AI Collaboration Guide
→ Master Spec Section 21 — Architecture rules, naming conventions, pre-submission checklist

---

## 🚫 Project Rules Summary (Immutable)

| # | Rule |
|---|------|
| R-01 | Never permanently delete production records |
| R-02 | All business logic executes on the server |
| R-03 | Never trust client-side payment confirmation |
| R-04 | Automation before manual work |
| R-05 | Every important action generates an audit log |
| R-06 | Every booking status change → `booking_timeline_events` |
| R-07 | No hardcoded business rule values in source code |
| R-08 | Notifications always go through the notification queue |
| R-09 | Payment records are immutable |
| R-10 | Inventory units must pass condition check before `READY_TO_DEPLOY` |
| R-11 | `tenant_id` on every table |
| R-12 | Supabase service role key never in client-side code |
| R-13 | All input validated with Zod on the server |
| R-14 | Financial records retained minimum 7 years |
| R-15 | Soft delete columns on all eligible tables before any data is inserted |

---

## 📋 Pre-Development Checklist (Before Writing Phase 1 Code)

- [ ] Read Master Spec Section 2 (Product Philosophy)
- [ ] Read Master Spec Section 3 (Business Rules)
- [ ] Read Master Spec Section 13 (Coding Standards)
- [ ] Read Master Spec Section 19 (Project Rules)
- [ ] Read Master Spec Section 21 (AI Collaboration Guide)
- [ ] Confirm `.env.example` is created with all required variables
- [ ] Confirm all 41 tables have `tenant_id` and `created_at` columns
- [ ] Confirm all soft-delete-eligible tables have the 4 soft-delete columns
- [ ] Confirm RLS is enabled on all tables with default-deny policy
- [ ] Confirm `roles` table is seeded with 6 system roles
- [ ] Confirm `settings` table is seeded with all defaults

---

*Last updated: July 23, 2026*
