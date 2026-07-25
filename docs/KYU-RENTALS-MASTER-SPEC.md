# KYU Rentals — Master Specification Document
### The Official Project Constitution
**Document Type:** Master Specification / Single Source of Truth
**Version:** 1.0.0
**Date:** July 23, 2026
**Authored by:** CTO / Senior Software Architect

---

> [!IMPORTANT]
> This document is the **official constitution** of KYU Rentals. Every future development phase, every architectural decision, every product feature, and every coding standard must follow this specification. When in conflict, this document takes precedence over individual phase documents. When this document is updated, all phase documents must be reviewed for consistency.

> [!NOTE]
> This document consolidates Phase 0 (Technical Blueprint), Phase 0.5 (Architecture Review), and Phase 0.6 (Business & Product Review) into one authoritative source of truth. No source code, SQL, or UI is generated here.

---

## Table of Contents

1. [Project Vision](#1-project-vision)
2. [Product Philosophy](#2-product-philosophy)
3. [Business Rules](#3-business-rules)
4. [User Roles](#4-user-roles)
5. [System Modules](#5-system-modules)
6. [Database Overview](#6-database-overview)
7. [Booking Lifecycle](#7-booking-lifecycle)
8. [Inventory Lifecycle](#8-inventory-lifecycle)
9. [Financial Lifecycle](#9-financial-lifecycle)
10. [Notification Lifecycle](#10-notification-lifecycle)
11. [Automation Strategy](#11-automation-strategy)
12. [Dashboard Philosophy](#12-dashboard-philosophy)
13. [Coding Standards](#13-coding-standards)
14. [UI / UX Standards](#14-ui--ux-standards)
15. [Security Standards](#15-security-standards)
16. [Performance Standards](#16-performance-standards)
17. [Future Roadmap](#17-future-roadmap)
18. [Non-Functional Requirements](#18-non-functional-requirements)
19. [Project Rules](#19-project-rules)
20. [Development Roadmap](#20-development-roadmap)
21. [AI Collaboration Guide](#21-ai-collaboration-guide)
22. [Final CTO Review](#22-final-cto-review)

---

## 1. Project Vision

### 1.1 Why KYU Rentals Exists

KYU Rentals was created to solve a real operational problem in the Philippine karaoke rental industry: the business is run through WhatsApp messages, manual spreadsheets, cash transactions, and handwritten receipts. Customers have no transparency. Owners have no visibility. Equipment gets lost. Payments get disputed. The business grows through hustle — not through systems.

KYU Rentals replaces the chaos with a professional, automated, and customer-friendly platform that makes running a karaoke rental business feel like running a modern company.

---

### 1.2 Mission Statement

> To make karaoke rental businesses run effortlessly — automating operations, delighting customers, and giving owners the financial clarity they need to grow.

---

### 1.3 Business Goals

| Goal | Description | Timeline |
|------|-------------|----------|
| Digitize operations | Replace WhatsApp bookings, spreadsheets, and cash receipts with a unified platform | Phase 1 |
| Increase booking volume | Reduce friction in the booking experience to convert more website visitors | Phase 2 |
| Reduce operational cost | Automate repetitive admin tasks (confirmation, scheduling, reminders) | Phase 2 |
| Protect against disputes | Build condition checks, proof of delivery, and signed handoffs into every rental | Phase 1 |
| Improve financial visibility | Show the owner their real net profit, not just revenue | Phase 2 |
| Enable growth | Make it possible to handle 50 bookings/month with the same team as 10 bookings/month | Phase 3 |

---

### 1.4 Customer Goals

| Goal | Description |
|------|-------------|
| Confidence | Customer knows exactly what they're getting, when it arrives, and what it costs — before they pay |
| Convenience | Book a karaoke machine in under 5 minutes, from any device, at any time |
| Trust | The booking confirmation, receipts, and status updates feel professional and reliable |
| Control | Customer can view their booking status, download receipts, and manage their booking without calling anyone |
| Value | Customer feels they got more than they paid for — premium experience at a fair price |

---

### 1.5 Long-Term Vision

KYU Rentals begins as a single-business karaoke rental platform. The long-term vision has three acts:

**Act 1 — MVP (Months 1–6):**
KYU Rentals the karaoke rental business uses this platform to run its day-to-day operations. The software is internal tooling that happens to have a beautiful customer-facing website.

**Act 2 — Multi-Branch (Months 6–18):**
KYU Rentals opens additional branches in different cities. The platform supports multiple warehouses, multiple driver teams, and a head admin who can see all branches.

**Act 3 — SaaS Platform (Month 18+):**
Other karaoke rental businesses in the Philippines (and eventually across Southeast Asia) can sign up for KYU Rentals as a Software-as-a-Service platform. Each business gets their own admin panel, their own customer-facing website (white-labeled), and their own data — fully isolated from every other tenant.

---

### 1.6 SaaS Vision

The SaaS product will be called **KYU Platform** (working title). It will be positioned as "the operating system for rental businesses." Initial target market: karaoke rental businesses in the Philippines. Secondary market: any equipment rental business (sound system rentals, event equipment, party supplies) that operates on a delivery-and-pickup model.

The SaaS transition requires zero application rebuild because the `tenant_id` multi-tenancy architecture is built into the data model from Day 1.

---

## 2. Product Philosophy

These nine principles define every decision made in this product. When a feature request conflicts with a principle, the principle wins — or the principle is formally revised. Principles cannot be ignored silently.

---

### Principle 1: Automation First

**Statement:** If the system can do it without a human, the system should do it.

**Meaning:** Booking confirmation, driver assignment, pickup scheduling, payment reminders, review requests, daily summaries — all automated by default. The admin should never do something the system can do reliably.

**Exception:** Automation is overridden only when human judgment adds genuine value — reviewing a booking from an address that's borderline outside the delivery zone, assessing a damage dispute, approving an expense claim.

---

### Principle 2: Admin Handles Exceptions Only

**Statement:** The admin dashboard surfaces problems, not processes.

**Meaning:** An admin who opens the dashboard should see a short list of things that need their attention — not an inbox of every booking that came in overnight. Every item on the admin's action list represents a situation the automation couldn't resolve alone.

**Metric:** If the admin spends more than 30 minutes per day in the dashboard on a normal operations day, the system has failed this principle.

---

### Principle 3: Customer Transparency

**Statement:** The customer always knows exactly where their booking stands and what happens next.

**Meaning:** Every status change generates a customer-facing notification. The booking detail page shows a visual timeline of past and upcoming events. Pricing is always fully itemized. Cancellation terms are shown before payment. Refund timelines are communicated the moment a refund is initiated.

**Anti-pattern:** Never keep the customer guessing. A customer who has to message "where is my order?" has been failed by the system.

---

### Principle 4: Money Is Tracked at Every Step

**Statement:** Every peso that enters or leaves the business is recorded in the system.

**Meaning:** Online payments are automatically logged via webhook. Cash payments are manually logged by admin with a receipt photo. Every expense has a category, a date, and an attached receipt. The system can calculate net profit for any time period at any time.

**Anti-pattern:** "We'll track that in a separate spreadsheet" is a design failure.

---

### Principle 5: Equipment Is Accountable

**Statement:** Every piece of equipment has a condition history, and every rental has a before-and-after condition check.

**Meaning:** When a unit goes out, its condition is documented. When it comes back, its condition is documented. If something is different, there is a record. No equipment loss or damage goes unrecorded.

**Anti-pattern:** "The driver will remember" is not a system.

---

### Principle 6: Trust Through Proof

**Statement:** Every important event in the rental process generates proof that it happened.

**Meaning:** Payment → receipt. Delivery → signed proof of delivery + photos. Condition → photo at check. Admin action → audit log. Driver departure → timestamp. Status change → timeline event.

**Why:** In a dispute, whoever has documentation wins. KYU Rentals always has documentation.

---

### Principle 7: Simplicity Over Features

**Statement:** A feature that is rarely used should not exist. A feature that complicates the experience for the majority to serve the minority should not exist.

**Meaning:** Start with the fewest features that make the business run properly. Add features only when there is a demonstrated operational or customer need — not because it sounds good in a product meeting.

**Application:** Phase 1 has fewer features than the full specification. That is correct. Build the core, validate it, then expand.

---

### Principle 8: Mobile-First Operations

**Statement:** Any operational task that a driver or customer must complete on the job must work on a mobile phone.

**Meaning:** The customer booking wizard, the customer dashboard, the driver's delivery checklist, and the driver's condition check must all be designed for a 390px mobile screen first. Desktop views for these modules are secondary.

**Note:** The admin panel's complex dashboards and data tables may be designed desktop-first, as admin work typically happens at a desk.

---

### Principle 9: Data Is Never Deleted

**Statement:** Production data is never permanently destroyed.

**Meaning:** Booking records, payment records, audit logs, customer records, and financial records are permanent. Soft deletes mark records as hidden — they are never purged from the database without explicit business and legal approval. Financial records are retained for a minimum of 7 years.

---

## 3. Business Rules

These are the official, binding business rules of KYU Rentals. They govern how the application behaves. Developers must implement these rules exactly. Product owners must formally update this document if rules change — not just change the code.

---

### 3.1 Booking Rules

| Rule ID | Rule |
|---------|------|
| BK-01 | A booking can only be created for a date that is at least `settings.policy.min_advance_booking_hours` hours in the future |
| BK-02 | A booking can only be created for a date that is at most `settings.policy.max_advance_booking_days` days in the future |
| BK-03 | A booking can only be placed if the requested package has at least one available inventory unit for the requested date and time range |
| BK-04 | A booking can only be placed if the delivery address falls within an active delivery zone |
| BK-05 | A booking is not confirmed until payment of at least the reservation fee is received and verified |
| BK-06 | If all booking validation rules pass AND payment is received, the system auto-confirms the booking without admin intervention |
| BK-07 | Admin may manually reject an auto-confirmed booking within 2 hours of confirmation if a legitimate operational conflict exists |
| BK-08 | A booking holds a specific inventory unit from the moment of confirmation until the unit is marked as RETURNED after pickup |
| BK-09 | No two bookings may hold the same inventory unit for overlapping date-time ranges |
| BK-10 | A booking reference number is auto-generated in the format `KYU-YYYY-XXXXX` (year + 5-digit sequential number) |
| BK-11 | Draft bookings (started but not paid) expire after `settings.policy.booking_expiry_hours` hours |

---

### 3.2 Payment Rules

| Rule ID | Rule |
|---------|------|
| PM-01 | The minimum payment to confirm a booking is the reservation fee, calculated as `total_amount × (settings.pricing.reservation_pct / 100)` |
| PM-02 | The full booking amount may be paid upfront at the time of booking |
| PM-03 | Any remaining balance after the reservation fee must be paid before the delivery departs |
| PM-04 | The system sends an online payment link for the balance 48 hours before the scheduled delivery |
| PM-05 | Cash payments must be manually logged by an admin or designated staff member with a receipt photo attached |
| PM-06 | Booking status must never be updated based on client-side payment confirmation. All payment status updates must originate from a verified server-side webhook |
| PM-07 | Every payment event generates an automatic receipt sent to the customer via email |
| PM-08 | Payment records are immutable. Errors are corrected via refund records, never by modifying the original payment |
| PM-09 | The system must verify PayMongo webhook signatures before processing any payment event |
| PM-10 | Duplicate webhook events for the same `gateway_payment_id` must be silently ignored (idempotent processing) |

---

### 3.3 Cancellation Rules

| Rule ID | Rule |
|---------|------|
| CN-01 | A customer may request cancellation at any time before the booking status reaches `OUT_FOR_DELIVERY` |
| CN-02 | After `OUT_FOR_DELIVERY`, cancellation is not permitted. The admin may override with documented justification |
| CN-03 | Cancellation requests from customers must be reviewed and approved by an admin. The system does not auto-approve customer cancellation requests |
| CN-04 | Admin may cancel a booking on behalf of the business at any time, with a mandatory reason recorded |
| CN-05 | Upon cancellation approval, the inventory unit is immediately freed for other bookings |
| CN-06 | Every cancellation generates an audit log entry recording who requested, who approved, and the reason |

---

### 3.4 Refund Rules

| Rule ID | Rule |
|---------|------|
| RF-01 | If cancellation occurs `> settings.policy.cancellation_window_full_refund_hrs` hours before the event: full refund |
| RF-02 | If cancellation occurs between `settings.policy.cancellation_window_partial_refund_hrs` and `cancellation_window_full_refund_hrs` before the event: partial refund at `settings.policy.partial_refund_pct` |
| RF-03 | If cancellation occurs fewer than `settings.policy.cancellation_window_partial_refund_hrs` hours before the event: no cash refund. A "Reschedule Credit" equivalent to the paid amount may be offered at admin discretion |
| RF-04 | Refunds must be initiated within 24 hours of cancellation approval |
| RF-05 | Refunds are processed through the same payment method used for the original payment |
| RF-06 | All refund records are immutable and linked to the original payment record |
| RF-07 | Customers must be notified immediately when a refund is initiated, with an estimated arrival timeframe |
| RF-08 | Admin-initiated cancellations (business fault) always result in a full refund regardless of timing |

---

### 3.5 Overtime Rules

| Rule ID | Rule |
|---------|------|
| OT-01 | Overtime begins when the rental period extends beyond the booked `end_time` |
| OT-02 | Overtime is charged at `settings.pricing.overtime_rate_per_hour` per hour or fraction thereof |
| OT-03 | When a rental is within 1 hour of ending, the system sends the customer an SMS offering an extension at the overtime rate |
| OT-04 | Overtime must be collected before or at the time of pickup. Unpaid overtime is added to the booking's outstanding balance |
| OT-05 | Overtime fees are recorded as a separate payment of type `overtime_fee` |

---

### 3.6 Damage Rules

| Rule ID | Rule |
|---------|------|
| DM-01 | Damage is assessed by comparing `condition_checks.condition_on_delivery` vs `condition_on_return` |
| DM-02 | Damage discovered at pickup must be photographed and documented before the driver leaves the customer's location |
| DM-03 | The customer must be informed of any damage finding at the time of pickup, not days later |
| DM-04 | Damage assessment and fee determination must be completed within 24 hours of pickup |
| DM-05 | Damage fees are charged separately from the original booking payment |
| DM-06 | If a customer disputes a damage claim, the matter escalates to admin review. Photographic evidence from pre-delivery and post-pickup checks is the primary reference |
| DM-07 | Normal wear-and-tear (minor scratches on the housing of a unit used dozens of times) is not chargeable damage |

---

### 3.7 Delivery Rules

| Rule ID | Rule |
|---------|------|
| DL-01 | Delivery is only permitted to addresses within an active delivery zone |
| DL-02 | Delivery must be scheduled at least 2 hours before the event start time |
| DL-03 | The pre-delivery equipment checklist must be completed before the driver departs. A departure cannot be logged without a completed checklist |
| DL-04 | Proof of delivery (photos + signature or OTP) must be collected at the delivery location |
| DL-05 | If no one is at the delivery address after two contact attempts, the driver must contact admin before deciding to leave equipment unsupervised or return it |
| DL-06 | The balance payment must be collected (online or cash) before or at delivery |
| DL-07 | A delivery that cannot be completed for any reason must be immediately reported to admin |

---

### 3.8 Pickup Rules

| Rule ID | Rule |
|---------|------|
| PU-01 | Pickup must be scheduled before the booking transitions to `RENTAL_ACTIVE` status |
| PU-02 | Pickup must occur within 4 hours of the agreed pickup time |
| PU-03 | If pickup is delayed beyond 4 hours, the system alerts admin automatically |
| PU-04 | The post-pickup condition check is mandatory. A pickup cannot be marked complete without component-by-component inspection |
| PU-05 | If any item is missing at pickup, it must be documented in the system before leaving the customer's location |
| PU-06 | The customer or a representative must be present at pickup |

---

### 3.9 Inventory Rules

| Rule ID | Rule |
|---------|------|
| IV-01 | Only inventory units with status `READY_TO_DEPLOY` may be assigned to bookings |
| IV-02 | A unit transitions from `RETURNED` to `READY_TO_DEPLOY` only after a complete post-rental condition check is logged |
| IV-03 | Units under maintenance cannot be assigned to bookings |
| IV-04 | Every inventory unit must have a complete component list matching its package template before being marked `READY_TO_DEPLOY` |
| IV-05 | When a component is discovered missing or broken, an incident report must be created immediately |
| IV-06 | Retired inventory units remain in the system as soft-deleted records and are linked to all historical bookings |

---

### 3.10 Driver Assignment Rules

| Rule ID | Rule |
|---------|------|
| DA-01 | Auto-assignment considers driver availability, assigned zone, and vehicle capacity |
| DA-02 | A driver may not be assigned to a delivery that conflicts with another of their scheduled deliveries or pickups |
| DA-03 | Admin may override any auto-assignment at any time |
| DA-04 | Driver assignment must be confirmed at least 4 hours before the scheduled delivery time |
| DA-05 | Drivers must be notified of their assignment immediately upon assignment |

---

## 4. User Roles

### 4.1 Role Summary

| Role | Type | Description |
|------|------|-------------|
| **Guest** | Unauthenticated | Public website visitor |
| **Customer** | Authenticated | Registered user who books rentals |
| **Support Staff** | Authenticated (Staff) | Handles customer communication and booking management |
| **Driver** | Authenticated (Staff) | Executes deliveries and pickups |
| **Admin** | Authenticated (Admin) | Full business operations management |
| **Super Admin** | Authenticated (Platform) | Platform-wide management (SaaS) |
| **Franchise Owner** | Authenticated (Future) | Manages a licensed branch or franchise |

---

### 4.2 Detailed Role Definitions

#### Guest
- **Responsibilities:** Browse packages, check availability, read FAQs
- **Permissions:** Access all public-facing pages and the availability checker
- **Restrictions:** Cannot make a booking. Cannot see any business data. Cannot access any authenticated route.
- **Conversion goal:** Register as a Customer to complete a booking

#### Customer
- **Responsibilities:** Complete bookings, make payments, manage their own bookings, leave reviews
- **Permissions:** Create bookings, view own bookings, make payments on own bookings, submit cancellation requests, view own receipts, update own profile
- **Restrictions:** Cannot see any other customer's data. Cannot see admin data. Cannot modify a booking after payment without going through a request flow.
- **Data scope:** All data scoped to their own `profiles.id`

#### Support Staff
- **Responsibilities:** Respond to customer inquiries, assist with booking management, log cash payments, create manual bookings
- **Permissions:** Read all customer and booking data. Create and update bookings. Log cash payments. Send notifications. View delivery schedules.
- **Restrictions:** Cannot access financial reports. Cannot change pricing. Cannot manage staff accounts. Cannot access settings. Cannot delete any records.
- **Data scope:** All bookings and customers for their assigned `tenant_id` and `branch_id`

#### Driver
- **Responsibilities:** Execute deliveries and pickups, complete checklists, record equipment condition, collect proof of delivery
- **Permissions:** View own assigned deliveries and pickups. Update delivery and pickup status. Complete checklists. Upload condition photos. Log proof of delivery.
- **Restrictions:** Cannot see customer financial data. Cannot see other drivers' assignments. Cannot modify bookings. Cannot access admin panel. Cannot see revenue data.
- **Data scope:** Only their own `delivery_assignments`

#### Admin
- **Responsibilities:** Full business operations — booking management, inventory, packages, pricing, staff, reporting, settings
- **Permissions:** All permissions except Super Admin functions. Can create, read, update, and soft-delete all operational data. Can access all reports. Can manage staff accounts.
- **Restrictions:** Cannot manage tenant subscription or billing (Super Admin only). Cannot access other tenants' data.
- **Data scope:** All data for their `tenant_id`

#### Super Admin
- **Responsibilities:** Platform-level management — tenant accounts, subscriptions, feature flags, platform analytics
- **Permissions:** All permissions across all tenants. Can access any tenant's admin panel. Can manage subscription plans, feature flags, and platform settings.
- **Restrictions:** Should never directly modify tenant operational data without documented reason (tenant support cases)
- **Data scope:** All tenants, all data

#### Franchise Owner (Future)
- **Responsibilities:** Same as Admin, but limited to their specific branch(es)
- **Permissions:** Admin permissions scoped to their `branch_id`(s)
- **Restrictions:** Cannot see other branches' data. Cannot manage platform settings. Cannot create new branches without Super Admin approval.

---

### 4.3 Permission Matrix

| Action | Guest | Customer | Driver | Support | Admin | Super Admin |
|--------|:-----:|:--------:|:------:|:-------:|:-----:|:-----------:|
| Browse packages | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create booking | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| View own bookings | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ |
| View all bookings | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Confirm/Reject booking | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View delivery schedule | ❌ | ❌ | Own only | ✅ | ✅ | ✅ |
| Complete delivery checklist | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Manage packages | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage inventory | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View revenue reports | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage staff | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Change settings | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| View audit logs | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage tenants | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Manage subscriptions | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 5. System Modules

### Module 1: Authentication
**Purpose:** Manage user identity, sessions, and access control.
**Responsibilities:** Email/password login, social OAuth (Google, Facebook), magic link login, session management via HTTP-only cookies, JWT issuance, role verification on every protected route.
**Dependencies:** Supabase Auth, Next.js Middleware, `profiles` table, `user_roles` table
**Future expansion:** Two-factor authentication (TOTP), SSO for enterprise/SaaS clients, biometric authentication for mobile app

---

### Module 2: Landing Website
**Purpose:** Convert visitors into customers through a professional, trust-building public presence.
**Responsibilities:** Display business identity and packages, showcase testimonials and social proof, provide a coverage map, answer FAQs, surface the booking entry point.
**Dependencies:** `packages` table, `reviews` table, `settings` table, Google Maps API
**Future expansion:** Blog/SEO content section, event gallery, integration with Google Business Profile reviews

---

### Module 3: Package Catalog
**Purpose:** Present all rental packages clearly enough for a customer to make an informed booking decision.
**Responsibilities:** Display active packages with photos, pricing (all tiers), inclusions, rental durations, delivery coverage, availability calendar. Support package comparison.
**Dependencies:** `packages`, `package_photos`, `package_inclusions`, `package_pricing_rules`, `unit_availability`
**Future expansion:** Package comparison tool, song library per package, "packages near me" filtering

---

### Module 4: Booking Wizard
**Purpose:** Guide the customer from interest to confirmed, paid booking in the fewest steps possible.
**Responsibilities:** Date/time selection → availability check → address entry → zone validation → contact details → booking summary → payment → confirmation.
**Dependencies:** `bookings`, `packages`, `unit_availability`, `delivery_zones`, `promo_codes`, PayMongo integration, notification queue
**Key rules:** Date picker is the first step. Address validation happens before payment. Full price breakdown shown before payment. Reservation fee explicitly labeled.
**Future expansion:** Saved booking drafts, guest checkout (no registration required), add-ons selector step

---

### Module 5: Customer Portal
**Purpose:** Give customers full visibility and control over their bookings without contacting support.
**Responsibilities:** Booking list with filters, booking detail with status timeline, receipt download, cancellation request, profile management, notification preferences.
**Dependencies:** `bookings`, `booking_timeline_events`, `payments`, `notifications`, `profiles`
**Future expansion:** Rescheduling requests, booking extension requests, loyalty program status, referral dashboard

---

### Module 6: Admin Dashboard
**Purpose:** Be the operations command center that surfaces exceptions and gives the owner a real-time business pulse.
**Responsibilities:** Action items list (exceptions requiring attention), today's delivery and pickup schedule, KPI cards (net profit, revenue, bookings), active rental map, equipment alerts.
**Dependencies:** All operational tables, `analytics_snapshots`
**Key rule:** The first thing an admin sees when opening the dashboard is "What needs my attention right now?" — not a generic welcome screen.
**Future expansion:** Predictive analytics ("Next week looks slow — consider running a promo"), AI-powered exception summary

---

### Module 7: Booking Management (Admin)
**Purpose:** Allow admin and support staff to view, manage, and take action on all bookings.
**Responsibilities:** Full booking list with filtering/sorting, booking detail view, manual booking creation, status overrides with reason, driver assignment, timeline view, communication history.
**Dependencies:** `bookings`, `booking_timeline_events`, `delivery_assignments`, `payments`, `customers`
**Future expansion:** Bulk actions, booking templates for recurring clients, duplicate booking detection

---

### Module 8: Package Management (Admin)
**Purpose:** Allow admin to manage all rental packages without developer involvement.
**Responsibilities:** Create, edit, publish, archive packages. Upload and reorder photos. Manage inclusions. Set pricing rules. Mark packages as featured.
**Dependencies:** `packages`, `package_photos`, `package_inclusions`, `package_equipment_templates`, `package_pricing_rules`, Supabase Storage
**Future expansion:** Package performance analytics ("This package has a 92% booking completion rate"), A/B testing different package descriptions

---

### Module 9: Inventory Management (Admin)
**Purpose:** Track every physical piece of equipment from purchase to retirement.
**Responsibilities:** Unit registry with condition tracking. Component management. Maintenance scheduling. Replacement history. Pre-delivery and post-pickup condition checks. Low stock alerts.
**Dependencies:** `inventory_units`, `inventory_components`, `unit_availability`, `condition_checks`, `maintenance_logs`, `replacement_records`
**Future expansion:** QR code labels for components, barcode scanning for checklist completion, depreciation reporting

---

### Module 10: Delivery & Driver Operations
**Purpose:** Manage the physical delivery and pickup of equipment with full accountability.
**Responsibilities:** Driver assignment, delivery scheduling, pre-delivery checklist, proof of delivery, post-pickup condition check, incident reporting.
**Dependencies:** `drivers`, `delivery_assignments`, `delivery_checklists`, `proof_of_delivery`, `incident_reports`, `condition_checks`
**Future expansion:** GPS route tracking, route optimization, driver mobile app, real-time "driver is on the way" customer tracker

---

### Module 11: Payment Management
**Purpose:** Track every financial transaction with full integrity and auditability.
**Responsibilities:** Payment logging (automatic via webhook and manual for cash), receipt generation, balance tracking, refund processing, outstanding balance alerts.
**Dependencies:** `payments`, `refunds`, `revenue_records`, `cash_flow_entries`, `bookings`, PayMongo API
**Future expansion:** Installment payment plans, partial refund approvals, payment links (standalone URL for specific outstanding amounts)

---

### Module 12: Expense Management
**Purpose:** Track all business expenses to enable real profit calculation.
**Responsibilities:** Expense entry by category, receipt photo upload, approval workflow, recurring expense setup, category management.
**Dependencies:** `expenses`, `expense_categories`, Supabase Storage
**Future expansion:** Receipt scanning via OCR (AI), automatic expense categorization, budget alerts per category

---

### Module 13: Customer Management (Admin)
**Purpose:** Give admin full visibility into the customer base.
**Responsibilities:** Customer list with total bookings and lifetime value, customer detail view with booking history, account flagging or suspension.
**Dependencies:** `profiles`, `bookings`, `payments`, `reviews`, `user_roles`
**Future expansion:** Customer segmentation, loyalty program management, personalized communication campaigns

---

### Module 14: Reporting & Analytics
**Purpose:** Give the business owner the information needed to make better decisions.
**Responsibilities:** Revenue reports, expense reports, P&L, booking analytics, occupancy report, driver performance, promo code report, forward bookings.
**Dependencies:** `analytics_snapshots`, `revenue_records`, `expenses`, `bookings`, `delivery_assignments`
**Key principle:** Every report answers a specific business question. No report exists just to display data.
**Future expansion:** Automated weekly email reports, export to CSV/Excel, integration with accounting software (QuickBooks)

---

### Module 15: Notification System
**Purpose:** Communicate with customers and staff reliably, at the right time, through the right channel.
**Responsibilities:** Queue management, scheduled notifications, retry logic, channel routing (email/SMS/push), in-app notification inbox, notification log.
**Dependencies:** `notification_queue`, `notification_log`, Resend (email), Semaphore (SMS), Supabase Realtime (in-app)
**Future expansion:** WhatsApp integration, Messenger integration, push notifications, n8n workflow automation

---

### Module 16: Settings & Configuration
**Purpose:** Allow the business owner to configure all business rules without modifying code.
**Responsibilities:** Business identity settings, pricing and fees, cancellation policy, notification preferences, social links, legal documents (T&C, Privacy Policy), integration keys.
**Dependencies:** `settings`, `settings_history`
**Key rule:** No business rule value should be hardcoded in application source code. If a value may change without a code deployment, it belongs in settings.
**Future expansion:** Per-branch settings override, white-label appearance settings for SaaS tenants

---

## 6. Database Overview

### 6.1 Complete Table Registry

All 41 tables are organized by domain. For every table: purpose, primary relationships, data ownership, and lifecycle are defined.

---

**SAAS DOMAIN**

| Table | Purpose | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `tenants` | Represents one business using the platform | Super Admin | Created at signup. Soft-suspended if subscription lapses. |
| `subscription_plans` | Available SaaS tiers (Starter, Growth, Enterprise) | Super Admin | Seeded. Rarely changed. |
| `tenant_billing` | Subscription invoice records per tenant per month | Super Admin | Append-only. Created monthly. |
| `feature_flags` | Platform-level feature toggles | Super Admin | Seeded. Updated on product releases. |
| `tenant_feature_overrides` | Per-tenant overrides of feature flags | Super Admin | Created when a tenant gets a custom feature exception. |

---

**USERS DOMAIN**

| Table | Purpose | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `profiles` | Application-level user data (extends Supabase Auth) | User/Admin | Created on registration. Soft-deleted on account deactivation. Never hard-deleted. |
| `roles` | Lookup table of system roles | Super Admin | Seeded. Immutable in production. |
| `user_roles` | Assigns roles to users | Admin | Created when a user is granted a role. Removed when role is revoked. |

---

**OPERATIONS DOMAIN**

| Table | Purpose | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `branches` | Physical locations/warehouses of a tenant | Admin | Created when a new branch opens. Soft-deleted when closed. |
| `delivery_zones` | Geographic service areas linked to branches | Admin | Created and edited by admin. Soft-deleted when retired. |
| `drivers` | Driver-specific profile extensions | Admin | Created when a driver is onboarded. Deactivated when they leave. |

---

**PRODUCTS DOMAIN**

| Table | Purpose | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `packages` | Rental package definitions | Admin | Created, published, archived. Never hard-deleted. |
| `package_photos` | Photos linked to packages | Admin | Added when package is created/edited. Soft-deleted when removed. |
| `package_equipment_templates` | Expected component list per package | Admin | Defined when package is created. Updated when package specs change. |
| `package_pricing_rules` | Dynamic pricing overrides (holidays, seasons) | Admin | Created and managed by admin. Active/inactive toggle. |

---

**INVENTORY DOMAIN**

| Table | Purpose | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `inventory_units` | Physical rental sets (the complete machine) | Admin | Created at purchase. Retired when decommissioned. Soft-deleted, never purged. |
| `inventory_components` | Individual parts within each unit | Admin | Created when unit is set up. Retired or replaced over time. |
| `unit_availability` | Blocking periods for units (booked, maintenance) | System | Created when a booking is confirmed. Released when booking ends. |
| `condition_checks` | Pre-delivery and post-pickup condition records | Driver/Staff | Created at every delivery and pickup. Immutable after submission. |
| `maintenance_logs` | Service and repair history per unit/component | Admin/Staff | Created when maintenance is scheduled or performed. |
| `replacement_records` | History of component replacements | Admin/Staff | Created when a component is replaced. Permanent record. |

---

**CORE BOOKING DOMAIN**

| Table | Purpose | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `bookings` | Central booking record | System/Customer/Admin | Created at booking initiation. Progresses through 16 states. Never deleted. |
| `booking_timeline_events` | Immutable event log of every booking state change | System | Append-only. One record per state transition. Never modified or deleted. |
| `delivery_assignments` | Links a booking to a driver for delivery or pickup | Admin/System | Created when a driver is assigned. Completed when delivery/pickup is done. |
| `delivery_checklists` | Item-by-item checklist per assignment | Driver | Created from `package_equipment_templates` when assignment is made. Completed before departure. |
| `proof_of_delivery` | Signature, photos, and confirmation for each delivery/pickup | Driver | Created and submitted at the delivery location. Immutable. |
| `incident_reports` | Reports of damage, loss, or delivery issues | Driver/Admin | Created when an incident occurs. Resolved by admin. |
| `promo_codes` | Discount codes applied at checkout | Admin | Created by admin. Soft-deleted when expired or discontinued. |
| `reviews` | Customer feedback after booking completion | Customer | Created by customer. Moderated by admin. Soft-deleted if removed. |

---

**FINANCE DOMAIN**

| Table | Purpose | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `payments` | Every payment transaction | System | Created by webhook or manual admin entry. Immutable. |
| `refunds` | Every refund issued | Admin/System | Created when a refund is approved. Linked to original payment. Immutable. |
| `revenue_records` | Normalized revenue events for reporting | System | Auto-created when payment is confirmed. Immutable. |
| `cash_flow_entries` | Every money-in and money-out event | System | Auto-created from payments, refunds, and expenses. Immutable. |
| `expenses` | Business expense records | Admin/Staff | Created manually. Soft-deleted (voided) if entered in error. |
| `expense_categories` | Taxonomy for expenses | Admin | Seeded with defaults. Admin can add custom categories. |

---

**NOTIFICATION DOMAIN**

| Table | Purpose | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `notification_queue` | Pending and scheduled notifications | System | Created whenever a notification is triggered. Processed by queue worker. Moved to log when done. |
| `notification_log` | Permanent record of every notification sent or failed | System | Append-only. Created from queue after processing. Never deleted. |

---

**SYSTEM DOMAIN**

| Table | Purpose | Owner | Lifecycle |
|-------|---------|-------|-----------|
| `audit_logs` | Immutable record of every important action | System | Created on every auditable event. Retention policy by severity. Never modified. |
| `settings` | Key-value store for all business configuration | Admin/Super Admin | Seeded with defaults. Updated by admin through settings panel. |
| `settings_history` | Version history of every settings change | System | Append-only. Created on every settings update. |
| `analytics_snapshots` | Pre-aggregated daily metrics for fast dashboard loading | System | Created nightly by cron job. One record per day per tenant. |

---

## 7. Booking Lifecycle

### 7.1 States and Definitions

| State | Description | Who Can Be In This State |
|-------|-------------|--------------------------|
| `DRAFT` | Booking started but payment not initiated | Customer/Admin |
| `PENDING_PAYMENT` | Booking details complete. Awaiting payment. | Customer |
| `PENDING_CONFIRMATION` | Payment received. Awaiting auto or manual confirmation. | System |
| `CONFIRMED` | Booking confirmed. Equipment will be prepared. | Admin |
| `PREPARING` | Staff is preparing and packing the equipment | Admin/Staff |
| `DRIVER_ASSIGNED` | Driver assigned. Delivery time confirmed. | Admin |
| `OUT_FOR_DELIVERY` | Driver has departed for delivery | Driver |
| `DELIVERED` | Equipment delivered to customer. Balance collected. | Driver |
| `RENTAL_ACTIVE` | Customer is using the equipment | System |
| `PICKUP_SCHEDULED` | Pickup time confirmed with driver assigned | Admin |
| `OUT_FOR_PICKUP` | Driver departed for pickup | Driver |
| `PICKED_UP` | Equipment returned to driver's possession | Driver |
| `COMPLETED` | Booking fully closed. Revenue recognized. | System |
| `ARCHIVED` | Booking moved to long-term archive after 30 days | System |
| `CANCELLATION_REQUESTED` | Customer has requested cancellation | Customer |
| `CANCELLED` | Booking cancelled. Refund initiated if applicable. | Admin |
| `REJECTED` | Admin rejected the booking at confirmation stage | Admin |
| `PAYMENT_FAILED` | Payment could not be processed. Booking expired. | System |

---

### 7.2 Valid State Transitions

| From | To | Trigger | Type |
|------|----|---------|------|
| `DRAFT` | `PENDING_PAYMENT` | Customer completes booking wizard | Manual |
| `DRAFT` | `CANCELLED` | Customer abandons and explicitly cancels | Manual |
| `PENDING_PAYMENT` | `PENDING_CONFIRMATION` | Payment webhook confirms success | Automated |
| `PENDING_PAYMENT` | `PAYMENT_FAILED` | Payment fails or booking expires | Automated |
| `PENDING_CONFIRMATION` | `CONFIRMED` | All rules pass — auto-confirmation triggers | Automated |
| `PENDING_CONFIRMATION` | `REJECTED` | Admin manually rejects | Manual |
| `PENDING_CONFIRMATION` | `CANCELLATION_REQUESTED` | Customer requests cancellation | Manual |
| `CONFIRMED` | `PREPARING` | Admin or staff marks equipment being prepared | Manual |
| `CONFIRMED` | `CANCELLATION_REQUESTED` | Customer requests cancellation | Manual |
| `PREPARING` | `DRIVER_ASSIGNED` | Driver assigned with confirmed timeslot | Manual/Auto |
| `DRIVER_ASSIGNED` | `OUT_FOR_DELIVERY` | Driver marks departure | Manual |
| `OUT_FOR_DELIVERY` | `DELIVERED` | Driver completes delivery + proof submitted | Manual |
| `DELIVERED` | `RENTAL_ACTIVE` | Rental start time reached | Automated |
| `RENTAL_ACTIVE` | `PICKUP_SCHEDULED` | Pickup scheduled and driver assigned | Manual/Auto |
| `PICKUP_SCHEDULED` | `OUT_FOR_PICKUP` | Driver marks pickup departure | Manual |
| `OUT_FOR_PICKUP` | `PICKED_UP` | Driver completes pickup + condition check | Manual |
| `PICKED_UP` | `COMPLETED` | Admin or system finalizes | Manual/Auto |
| `COMPLETED` | `ARCHIVED` | 30 days after completion | Automated |
| `CANCELLATION_REQUESTED` | `CANCELLED` | Admin approves cancellation | Manual |
| `CANCELLATION_REQUESTED` | `CONFIRMED` | Admin rejects cancellation request | Manual |

---

### 7.3 Invalid Transitions (Must Throw Error)

- Any state → `DRAFT` (you cannot go backwards to draft)
- `RENTAL_ACTIVE` → `CONFIRMED` (you cannot un-deliver)
- `COMPLETED` → any active state (completed bookings are immutable)
- `CANCELLED` → any active state (cancelled bookings are immutable)
- `REJECTED` → any active state (rejected bookings are immutable)
- Skipping states (e.g., `CONFIRMED` → `DELIVERED` without `OUT_FOR_DELIVERY`)

---

### 7.4 Automated Transitions

| Transition | Trigger Mechanism |
|-----------|------------------|
| `PENDING_PAYMENT` → `PENDING_CONFIRMATION` | PayMongo payment webhook received and verified |
| `PENDING_CONFIRMATION` → `CONFIRMED` | Immediate: all validation rules pass after payment received |
| `PENDING_PAYMENT` → `PAYMENT_FAILED` | Booking expiry cron: `scheduled_for > booking_expiry_hours` with no payment |
| `DELIVERED` → `RENTAL_ACTIVE` | Cron: rental `start_time` reached |
| `COMPLETED` → `ARCHIVED` | Cron: 30 days after `completed_at` |

---

## 8. Inventory Lifecycle

### 8.1 Unit States

```
PURCHASED → SETUP → READY_TO_DEPLOY → RESERVED → OUT_FOR_DELIVERY
     → DELIVERED → RENTAL_ACTIVE → OUT_FOR_PICKUP → RETURNED
     → INSPECTION → [READY_TO_DEPLOY (if pass) | MAINTENANCE (if fail)]
     → [READY_TO_DEPLOY (after repair) | RETIRED]
     → ARCHIVED
```

| State | Description |
|-------|-------------|
| `PURCHASED` | Unit acquired. Not yet set up with components. |
| `SETUP` | Components being assembled and configured. |
| `READY_TO_DEPLOY` | All components present and checked. Available for booking. |
| `RESERVED` | Assigned to a confirmed booking. No longer available. |
| `OUT_FOR_DELIVERY` | Currently in transit to customer. |
| `DELIVERED` | At customer's location. In use. |
| `RETURNED` | Picked up and returned to warehouse. Awaiting inspection. |
| `INSPECTION` | Condition check in progress. Not assignable. |
| `MAINTENANCE` | Under repair or servicing. Not assignable. |
| `RETIRED` | Decommissioned. Soft-deleted. Linked to historical records. |
| `ARCHIVED` | Long-term archive after retirement. |

---

### 8.2 Component States

| State | Description |
|-------|-------------|
| `ACTIVE` | Component is part of an active unit and in service |
| `MISSING` | Component was not returned with the unit |
| `BROKEN` | Component is damaged and not functional |
| `UNDER_REPAIR` | Component is being repaired |
| `REPLACED` | Component has been replaced. Old record archived, new component created |
| `RETIRED` | Component is permanently decommissioned |

---

## 9. Financial Lifecycle

### 9.1 Revenue Flow

```
Customer books → Reservation Fee Paid → revenue_records entry (type: reservation_fee, recognized_at: event_date)
                                      → cash_flow_entries entry (type: inflow, category: booking_payment)

Balance Paid → revenue_records entry (type: rental_fee)
             → cash_flow_entries entry (type: inflow, category: booking_payment)

Delivery Fee → revenue_records entry (type: delivery_fee)

Overtime Fee → revenue_records entry (type: overtime_fee)

Damage Fee → revenue_records entry (type: damage_fee)
```

### 9.2 Expense Flow

```
Admin logs expense → expenses entry created
                   → cash_flow_entries entry (type: outflow, category: mapped from expense category)
                   → analytics_snapshots updated (nightly)
```

### 9.3 Refund Flow

```
Cancellation approved → refunds entry created
                      → PayMongo refund API called
                      → cash_flow_entries entry (type: outflow, category: refund)
                      → revenue_records adjusted (not deleted — a reversal entry is created)
                      → Customer notified
```

### 9.4 Revenue Recognition

All revenue is recognized on the **event date** (`bookings.event_date`), not on the payment date. This follows accrual accounting principles and provides accurate monthly revenue comparisons.

The `revenue_records.recognized_at` field stores the event date. The `revenue_records.received_at` field stores the actual payment date. Reports can filter by either field to support both cash-basis and accrual-basis accounting.

### 9.5 Net Profit Calculation

```
Net Profit (Period) = SUM(revenue_records.net_amount WHERE recognized_at IN period)
                    - SUM(expenses.amount WHERE expense_date IN period AND status = 'approved')
```

This number is the primary KPI on the admin dashboard. It is always visible at the top.

---

## 10. Notification Lifecycle

### 10.1 Notification Creation

A notification is **never sent directly**. All notification intent is recorded in `notification_queue` first. The sending is handled asynchronously.

```
Application event occurs (e.g., booking confirmed)
        ↓
Server Action or Edge Function inserts a row into notification_queue
        ↓
Row contains: recipient, channel, template_key, template_data, scheduled_for, priority, idempotency_key
        ↓
Queue worker picks up the notification (within 30 seconds for immediate sends)
```

### 10.2 Idempotency

Every notification has an `idempotency_key` — a deterministic string based on the event and recipient. For example: `booking_confirmed_KYU-2026-00123_customer_UUID`. Before inserting a new queue record, the system checks if this key already exists in `notification_queue` or `notification_log`. If it does, the notification is silently skipped. This prevents duplicate sends when webhooks fire multiple times.

### 10.3 Retry Logic

| Attempt | Next Retry |
|---------|-----------|
| Failed (1st) | +2 minutes |
| Failed (2nd) | +15 minutes |
| Failed (3rd) | +1 hour |
| Failed (4th) | Mark FAILED. Alert admin. Move to notification_log. |

### 10.4 Scheduled Notifications

| Notification | Trigger |
|-------------|---------|
| Balance due reminder | `scheduled_for = booking.event_date - 48hrs` |
| Delivery reminder (customer) | `scheduled_for = delivery_assignment.scheduled_date - 24hrs` |
| Driver briefing | `scheduled_for = delivery_assignment.scheduled_time_start - 2hrs` |
| Review request | `scheduled_for = booking.completed_at + 24hrs` |
| Overtime extension offer | `scheduled_for = booking.end_time - 60mins` |

### 10.5 Completion

After a notification is processed (success or permanent failure), it is:
1. Marked `SENT` or `FAILED` in `notification_queue`
2. Moved to `notification_log` as a permanent archive record
3. An `audit_log` entry is created for critical notification failures

---

## 11. Automation Strategy

### 11.1 Booking Automations

| Automation | Trigger | Action |
|-----------|---------|--------|
| Auto-confirm booking | Payment webhook verified + all rules pass | Status → CONFIRMED + notify customer + notify admin |
| Expire unpaid bookings | Cron: every 15 minutes | Any PENDING_PAYMENT booking older than expiry hours → PAYMENT_FAILED |
| Transition to RENTAL_ACTIVE | Cron: every hour | DELIVERED bookings where start_time ≤ NOW → RENTAL_ACTIVE |
| Auto-archive completed bookings | Cron: nightly | COMPLETED bookings older than 30 days → ARCHIVED |
| Flag overdue pickups | Cron: every 30 minutes | PICKUP_SCHEDULED past scheduled_time + 4hrs → admin alert |

### 11.2 Payment Automations

| Automation | Trigger | Action |
|-----------|---------|--------|
| Balance due payment link | Cron: 48hrs before delivery | Send payment link via SMS + email to customer |
| Payment receipt | Payment webhook success | Generate PDF receipt + email to customer |
| Refund notification | Refund API call success | Email to customer with refund amount and timeline |
| Outstanding balance alert | Cron: daily | Alert admin of all bookings with balance_due > 0 and delivery tomorrow |

### 11.3 Delivery Automations

| Automation | Trigger | Action |
|-----------|---------|--------|
| Pickup auto-schedule | Booking transitions to DELIVERED | Create default pickup window + notify admin to confirm |
| Delivery reminder to customer | 24hrs before scheduled delivery | SMS + email with delivery window |
| Driver briefing | 2hrs before delivery | SMS to driver with address, customer name, balance to collect |
| Overtime extension offer | 1hr before rental end_time | SMS to customer with extension option |

### 11.4 Reporting Automations

| Automation | Trigger | Action |
|-----------|---------|--------|
| Daily analytics snapshot | Cron: nightly at midnight | Compute and save all KPIs to `analytics_snapshots` |
| Weekly business summary | Cron: Monday 8AM | Email to admin with revenue, bookings, highlights from past week |
| Monthly P&L report | Cron: 1st of each month | Generate prior month P&L + email to admin |

### 11.5 Future AI Automations

| Automation | Description |
|-----------|-------------|
| Intelligent booking conflict detection | AI reviews new bookings against historical patterns to flag unusual requests |
| Dynamic pricing suggestions | AI recommends price adjustments based on demand, season, and competitor data |
| Customer churn prediction | AI flags customers who haven't booked in a while and suggests re-engagement timing |
| Expense categorization | AI auto-categorizes expense entries based on description |
| Review sentiment analysis | AI summarizes customer sentiment trends from reviews |

---

## 12. Dashboard Philosophy

The admin dashboard is not a reporting tool. It is an **operations command center**. Every section answers a specific question.

### Panel 1: "What Needs My Attention Right Now?"
Shows action items that require human intervention. These are the exceptions the automation couldn't handle. Examples: booking with borderline address, failed payment requiring follow-up, damage report pending review, cancellation request awaiting decision. This panel is always the first thing on screen. If it's empty, the admin has nothing to do and can relax.

### Panel 2: "What Is Happening Today?"
A timeline view of today's deliveries and pickups, each showing the driver, the customer, the address, and the current status. Green = on track. Yellow = delayed. Red = problem. Clicking any item opens the full booking detail.

### Panel 3: "How Is the Business Performing?"
Three numbers, always visible: Net Profit This Month, Revenue This Month, Bookings This Month. Each with a comparison to last month (+12%, -3%, etc.). These are computed from `analytics_snapshots` — not live queries — so they load instantly.

### Panel 4: "What Is at Risk?"
Equipment currently out on rental beyond the scheduled return time. Bookings with unpaid balances due within 24 hours. Inventory units with low-condition flags needing maintenance.

### Panel 5: "What Should I Prepare For?"
Forward bookings for the next 7 days. Upcoming holidays that may affect pricing or staffing. Inventory units scheduled for maintenance this week.

### Panel 6: "Is My Business Growing?"
A simple 12-month revenue chart. One line. Are we going up or down? No tables, no data exports — just the trend. Available by clicking "Full Reports."

---

## 13. Coding Standards

Every developer working on this project — human or AI — must follow these standards without exception.

### 13.1 Folder Naming
- All folders use `kebab-case`
- React component folders use `PascalCase` only when they represent a single component (e.g., `BookingWizard/`)
- Feature folders are named after their module: `booking/`, `inventory/`, `payments/`

### 13.2 File Naming
- React component files: `PascalCase.tsx` (e.g., `BookingCard.tsx`)
- Utility files: `camelCase.ts` (e.g., `formatCurrency.ts`)
- Route handlers: `route.ts` (Next.js convention)
- Server Actions files: `camelCase.actions.ts` (e.g., `booking.actions.ts`)
- Query files: `camelCase.queries.ts` (e.g., `bookings.queries.ts`)
- Type files: `camelCase.types.ts` (e.g., `booking.types.ts`)

### 13.3 Variable and Function Naming
- Variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Types and Interfaces: `PascalCase`
- Boolean variables: begin with `is`, `has`, `can`, `should` (e.g., `isAvailable`, `hasBalance`)
- Event handlers: begin with `handle` (e.g., `handleBookingSubmit`)
- Async functions: no special prefix required, but must be `await`-ed consistently

### 13.4 Server Actions
- All Server Actions are defined in `src/actions/*.actions.ts`
- Every Server Action returns `{ success: boolean, data?: T, error?: string, code?: string }`
- Server Actions never throw exceptions to the client. All errors are caught and returned as structured responses.
- Server Actions always validate input with Zod before touching the database

### 13.5 Data Fetching (Queries)
- All server-side data fetching logic lives in `src/queries/*.queries.ts`
- Query functions are pure: they receive parameters, return data, no side effects
- Query functions are never called directly inside components — they are called in Server Components or passed through props
- All queries against soft-delete-enabled tables must include `WHERE is_deleted = FALSE`

### 13.6 Validation
- All user input is validated with **Zod** schemas
- Zod schemas are defined in `src/lib/validations/*.schema.ts`
- Client-side validation uses the same Zod schema as server-side validation (shared schemas)
- No field should be optional on the server if it is required for the business rule

### 13.7 Error Handling
- Standard error response shape: `{ success: false, error: "Human-readable message", code: "ERROR_CODE", details?: any }`
- Error codes are defined in `src/config/error-codes.ts` as an enum
- All unhandled errors are captured by Sentry
- No `console.error()` in production code — use the Sentry client

### 13.8 Environment Variables
- All environment variables are documented in `.env.example`
- Variables are named with `NEXT_PUBLIC_` prefix only for values safe to expose to the browser
- Server-only secrets (PayMongo secret key, Supabase service role key, Resend API key) are **never** prefixed with `NEXT_PUBLIC_`
- A startup check validates that all required environment variables are present before the application starts

### 13.9 TypeScript
- Strict mode is always enabled (`"strict": true` in `tsconfig.json`)
- `any` type is forbidden. Use `unknown` and narrow as needed.
- All database types come from `src/types/database.types.ts` (auto-generated from Supabase)
- Never write raw database types in component props — always create application-level types that extend or transform database types

### 13.10 Components
- Components are organized by domain: `src/components/booking/`, `src/components/admin/`, etc.
- Components are "dumb" — no direct database calls, no API calls. Data is passed as props.
- Components never contain business logic. Business logic lives in Server Actions and query functions.
- Maximum component file length: 200 lines. Split into sub-components if larger.

### 13.11 Hooks
- Custom hooks live in `src/hooks/`
- Hooks follow the `use` prefix: `useBooking`, `useAvailability`
- Hooks manage client-side state and side effects. They do not contain business logic.

### 13.12 State Management
- Zustand stores live in `src/stores/`
- Zustand is used only for UI state (wizard step progress, modal open/close, sidebar collapsed)
- Server state (bookings, packages, inventory) is managed by TanStack Query
- No Redux. No Context API for state that changes frequently.

### 13.13 Comments and Documentation
- Every Server Action must have a JSDoc comment explaining what it does, what it expects, and what it returns
- Every query function must have a JSDoc comment
- Complex business logic must have inline comments explaining the "why," not the "what"
- No commented-out code is committed to the repository

### 13.14 Testing
- Every Server Action must have at least one integration test
- Every critical user flow must have an E2E test in Playwright
- Unit tests use Vitest
- Test files are colocated with the code they test: `booking.actions.test.ts` lives next to `booking.actions.ts`
- CI fails if tests fail. No exceptions.

### 13.15 Git Conventions
- Branch naming: `feature/`, `fix/`, `chore/`, `docs/` prefixes
- Commit messages follow Conventional Commits: `feat: add availability checker`, `fix: correct overtime fee calculation`
- No direct commits to `main`. All changes go through pull requests.
- PRs require at least one passing CI run before merge.

### 13.16 Logging
- All significant server-side events are logged with structured JSON: `{ level, message, context, timestamp }`
- Logging levels: `debug` (development only), `info` (significant events), `warn` (recoverable problems), `error` (requires attention)
- Logs are shipped to Sentry in production. Local development logs to console.

### 13.17 Accessibility
- All interactive elements have accessible labels (`aria-label` or visible text)
- All images have descriptive `alt` text
- All forms have associated `<label>` elements
- Color is never the sole means of conveying information
- Keyboard navigation works for all booking and payment flows

---

## 14. UI / UX Standards

### 14.1 Color Philosophy

KYU Rentals uses a **warm, vibrant, premium** color system that evokes celebration, music, and good times — while maintaining professional credibility.

| Token | Usage | Description |
|-------|-------|-------------|
| `brand-primary` | Main CTAs, links, key highlights | Deep violet-blue (celebration, premium) |
| `brand-accent` | Highlights, badges, active states | Warm amber-gold (energy, warmth) |
| `brand-surface` | Cards, panels, containers | Near-white with subtle warm tint |
| `brand-bg` | Page background | Soft off-white |
| `status-success` | Confirmations, completed states | Balanced green (not harsh) |
| `status-warning` | Pending, attention-needed states | Amber |
| `status-error` | Errors, failures, rejections | Deep rose-red |
| `status-info` | Information callouts | Soft blue |
| `text-primary` | Body text | Near-black with slight warmth |
| `text-muted` | Labels, metadata | Medium gray |

**Rule:** Never use pure `#FF0000`, `#00FF00`, or `#0000FF`. Always use curated HSL values that feel premium. A color system design file (Figma or equivalent) must be created before UI development begins.

---

### 14.2 Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Display headings | Outfit (Google Fonts) | 700 | 40–64px |
| Section headings | Outfit | 600 | 24–36px |
| Subheadings | Inter | 600 | 18–20px |
| Body text | Inter | 400 | 15–16px |
| Labels, captions | Inter | 400–500 | 12–14px |
| Data tables | JetBrains Mono (numbers only) | 400 | 13–14px |

All font sizes use a defined type scale (`text-xs` through `text-4xl`). No ad-hoc pixel sizes.

---

### 14.3 Spacing Scale

Spacing follows a `4px` base unit scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`. No values outside this scale are used for margins, padding, or gaps.

---

### 14.4 Component Patterns

| Component | Standard |
|-----------|---------|
| **Buttons** | Primary (filled, brand color), Secondary (outlined), Destructive (rose-red filled), Ghost (transparent, text only). All buttons have a minimum 44px touch target. |
| **Forms** | Labels always above inputs. Required field indicator (\*) with explanation at form top. Error messages appear below the relevant field, never as modals. Success is confirmed inline. |
| **Tables** | Sticky header. Sortable columns indicated by chevron icon. Pagination at the bottom. Row hover highlight. Mobile: horizontal scroll, not collapsed cards. |
| **Cards** | 16px inner padding. Subtle shadow. 8px border radius. No harsh borders. |
| **Dialogs / Modals** | Used sparingly. Only for confirmations, quick forms, and alerts. Maximum width 480px for forms, 640px for confirmations. Always includes a clear close button. |
| **Notifications / Toasts** | Appear in the top-right corner. Auto-dismiss after 5 seconds. Persistent for errors. |
| **Loading States** | Skeleton screens (not spinners) for content areas. Spinner only for button-level loading. |
| **Error States** | Full-page error for fatal errors. Inline error messages for form validation. Toast for transient API errors. |

---

### 14.5 Mobile Responsiveness

**Breakpoints:**

| Name | Width | Use Case |
|------|-------|---------|
| `xs` | 0–390px | Smallest mobile |
| `sm` | 391–640px | Mobile |
| `md` | 641–768px | Large mobile / small tablet |
| `lg` | 769–1024px | Tablet / small laptop |
| `xl` | 1025–1280px | Desktop |
| `2xl` | 1281px+ | Wide desktop |

**Rules:**
- Booking wizard is designed mobile-first
- Customer portal is mobile-first
- Admin dashboard data tables are desktop-first (with horizontal scroll on mobile)
- Driver checklist is mobile-first (420px max content width)

---

## 15. Security Standards

### 15.1 Authentication

- Supabase Auth manages all identity. No custom JWT implementation.
- Access tokens expire in 1 hour. Refresh tokens expire in 7 days.
- Sessions are stored in HTTP-only, Secure cookies. Never in localStorage.
- All OAuth logins use the `state` parameter to prevent CSRF.
- Password reset tokens are single-use and expire in 15 minutes.
- Account lockout after 5 consecutive failed login attempts for 15 minutes.

### 15.2 Authorization

- **Never trust the client.** Role information is always read from the database server-side, never from a client-provided token claim without verification.
- Row Level Security (RLS) is enabled on every table. Default policy: deny all. Access is explicitly granted.
- The Supabase `service_role` key is used only in server-side code (Server Actions, Route Handlers, Edge Functions). It is never exposed to the browser.
- The Supabase `anon` key is used in browser code, but all data access is governed by RLS policies.
- Admin routes are protected at three layers: Next.js Middleware (redirects unauthenticated users), Layout component (re-checks role), Server Action/Query (verifies role before any database operation).

### 15.3 Input Validation and Sanitization

- All input is validated with Zod on the server before any database operation.
- HTML input is never trusted. Strip HTML from all text fields.
- File uploads validate MIME type against a whitelist (image/jpeg, image/png, image/webp, application/pdf). Maximum file size: 5MB.
- SQL injection is prevented by using the Supabase JS client exclusively (parameterized queries). Raw SQL with user input concatenation is forbidden.

### 15.4 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 attempts | 15 minutes per IP |
| Registration | 3 registrations | 1 hour per IP |
| Booking creation | 5 bookings | 1 hour per authenticated user |
| Payment initiation | 3 attempts | 10 minutes per booking |
| Webhook endpoints | Signature verification | Per-request (not rate-limited, but verified) |
| General API | 100 requests | 1 minute per IP |

Implementation: Upstash Redis with `@upstash/ratelimit` in Next.js Middleware.

### 15.5 Payment Security

- Card data never touches KYU Rentals servers. PayMongo handles PCI compliance.
- All payment webhook events are verified using PayMongo HMAC signature before processing.
- Payment amounts are always re-calculated server-side before being sent to PayMongo. Never trust client-submitted payment amounts.
- Idempotency keys prevent duplicate payment processing.

### 15.6 Secrets Management

| Secret | Where Stored | Who Has Access |
|--------|-------------|----------------|
| Supabase `service_role` key | Vercel environment variables (server only) | Backend only |
| PayMongo secret key | Vercel environment variables (server only) | Backend only |
| Resend API key | Vercel environment variables (server only) | Backend only |
| Semaphore API key | Vercel environment variables (server only) | Backend only |
| Supabase `anon` key | Vercel environment variables (public) | Frontend + Backend |
| PayMongo webhook secret | Vercel environment variables (server only) | Webhook handler only |

- Secrets are rotated quarterly or immediately upon suspected exposure.
- `.env.local` is in `.gitignore`. Never committed.
- `.env.example` contains placeholder values only.

### 15.7 Data Retention and Privacy

- Customer personal data (name, phone, address) is retained for 2 years after account inactivation, then anonymized.
- Financial records are retained for 7 years (legal requirement).
- Audit logs are retained per the severity-based policy defined in Phase 0.5.
- Customers may request data export (all their personal data) — this is supported in the customer portal.
- Customers may request account deletion — this triggers a soft-delete, and personal fields are anonymized after 30 days.

### 15.8 Backup and Recovery

- Supabase provides point-in-time recovery (PITR) with daily automated backups.
- Backups are retained for 30 days on the Pro plan.
- Critical database state is additionally snapshotted weekly to Supabase Storage as a CSV export.
- Recovery time objective (RTO): 4 hours. Recovery point objective (RPO): 24 hours.

---

## 16. Performance Standards

### 16.1 Page Load Targets (Core Web Vitals)

| Metric | Target | Tool |
|--------|--------|------|
| Largest Contentful Paint (LCP) | < 2.5 seconds | Vercel Analytics |
| First Input Delay (FID) | < 100ms | Vercel Analytics |
| Cumulative Layout Shift (CLS) | < 0.1 | Vercel Analytics |
| Time to First Byte (TTFB) | < 600ms | Vercel Analytics |

### 16.2 API Response Targets

| Endpoint Type | Target |
|--------------|--------|
| Read operations (queries) | < 200ms |
| Write operations (mutations) | < 500ms |
| Availability check | < 300ms |
| Payment initiation | < 1000ms (external API involved) |
| Report generation | < 3000ms (complex aggregations) |

### 16.3 Caching Strategy

| Data | Cache Strategy | TTL |
|------|---------------|-----|
| Active packages (public) | Next.js `revalidate` + ISR | 5 minutes |
| Package photos (public) | Vercel CDN | Permanent (content-addressed) |
| Settings | In-memory server cache | 5 minutes (invalidated on change) |
| Availability data | TanStack Query client cache | 30 seconds |
| Admin dashboard KPIs | `analytics_snapshots` table | Updated nightly |
| Customer booking list | TanStack Query client cache | 60 seconds |

### 16.4 Database Indexing Rules

- Every foreign key column must have an index
- Every column used in `WHERE` clauses in common queries must be indexed
- Composite indexes are created for the most common multi-column filter combinations
- Partial indexes are created for soft-delete tables: `WHERE is_deleted = FALSE`
- Indexes are reviewed and pruned quarterly (unused indexes have a write-cost with no read-benefit)

### 16.5 Image Optimization

- All package photos are served through Next.js `<Image>` component (automatic WebP conversion, lazy loading, responsive sizing)
- Maximum upload size: 5MB. Images are compressed to < 500KB after processing.
- Supabase Storage is configured with CDN caching for public image buckets.

### 16.6 Background Job Performance

- Queue processor runs every 30 seconds. Maximum batch size: 50 notifications per run.
- Analytics snapshot computation: maximum 10 seconds per tenant per nightly run.
- Edge Functions have a 150-second timeout. Any job that could run longer must be chunked.

---

## 17. Future Roadmap

### Version 1 — KYU Rentals MVP
**Target:** 3 months after Phase 1 start
**Goal:** A fully operational karaoke rental business running end-to-end through the platform

**Features included:**
- Public website with package catalog
- Customer booking wizard with PayMongo integration
- Auto-confirmation engine
- Customer portal (bookings, receipts, cancellation requests)
- Admin dashboard (exceptions-first design)
- Full booking management with timeline
- Basic inventory management with component tracking
- Delivery assignment and driver checklist (web-based)
- Proof of delivery
- Expense management
- Notification queue (email + SMS)
- Revenue, expense, and P&L reports

---

### Version 2 — Operational Excellence
**Target:** 6 months after MVP launch
**Goal:** Reduce operational cost and admin workload by 50%

**Features added:**
- Auto-assignment engine for drivers
- Occupancy rate and package profitability reports
- Customer loyalty tier system (Silver/Gold/Platinum)
- Referral program with credit tracking
- Add-ons at checkout
- Promo code system
- Overtime extension SMS upsell
- Review platform (with moderation)
- Advanced driver operations (route notes, GPS columns populated)
- Weekly automated business summary emails

---

### Version 3 — Customer Experience
**Target:** 12 months after MVP launch
**Goal:** Make KYU Rentals the highest-rated karaoke rental company in its market

**Features added:**
- Real-time "driver on the way" customer tracker
- Package comparison tool
- Corporate/event planner accounts with monthly invoicing
- Booking drafts (saved incomplete bookings)
- Guest checkout (no registration required)
- Multi-branch support (second location)
- Forward bookings report and capacity planning

---

### Version Enterprise — Multi-Branch
**Target:** 18 months after MVP launch
**Goal:** KYU Rentals operates from multiple branches as one unified business

**Features added:**
- Branch-level admin dashboard
- Head admin cross-branch visibility
- Per-branch inventory and delivery zones
- Branch performance comparison reports
- Driver mobile app (React Native MVP)
- Digital signature capture on mobile

---

### Version SaaS — KYU Platform
**Target:** 24+ months after MVP launch
**Goal:** Other rental businesses can use the platform as a white-labeled SaaS product

**Features added:**
- Tenant registration and onboarding flow
- Subscription plan management (Starter / Growth / Enterprise)
- White-label theming (logo, colors, custom domain)
- Super Admin dashboard
- Platform analytics (across all tenants)
- API access for enterprise tenants
- Tenant billing via Stripe
- Feature flags per plan
- Tenant data isolation and compliance

---

## 18. Non-Functional Requirements

| Category | Requirement |
|----------|------------|
| **Availability** | 99.5% uptime target. Scheduled maintenance windows communicated 24 hours in advance. |
| **Reliability** | Payment webhook processing has zero message loss tolerance. Notification queue processes within 30 seconds of enqueue for immediate notifications. |
| **Maintainability** | Any developer with Next.js and Supabase experience should be able to onboard within 4 hours using this specification and the codebase README. |
| **Scalability** | The application must handle 1,000 concurrent users without degradation. The database must support 100,000 bookings without schema changes. |
| **Security** | No critical security vulnerabilities in OWASP Top 10. RLS prevents any cross-tenant data leakage. |
| **Performance** | Core Web Vitals in the "Good" range for all public pages. Admin dashboard loads in < 2 seconds. |
| **Monitoring** | All errors reported to Sentry within 30 seconds of occurrence. Uptime monitoring via Vercel or Better Uptime. |
| **Logging** | All server-side errors, all payment events, and all admin actions are logged. Logs retained per the data retention policy. |
| **Disaster Recovery** | RTO: 4 hours. RPO: 24 hours. Database recovery tested quarterly. |

---

## 19. Project Rules

These are immutable laws. They cannot be violated by any developer, at any time, for any reason. If a rule must be changed, it requires a formal amendment to this document with a documented reason.

| Rule # | Rule | Why |
|--------|------|-----|
| **R-01** | Never permanently delete production records. | Financial, legal, and dispute resolution requires historical data to always exist. |
| **R-02** | All business logic executes on the server. Never trust the client. | Client-side logic can be bypassed by any user with browser developer tools. |
| **R-03** | Never trust client-side payment confirmation. | Payment status must be verified server-side via a signed webhook. A client saying "payment succeeded" is worthless. |
| **R-04** | Automation before manual work. | The system does it first. Humans handle exceptions only. |
| **R-05** | Every important action generates an audit log. | Accountability requires that every change is traceable to a person and a time. |
| **R-06** | Every booking status change is recorded in `booking_timeline_events`. | A booking's history must be perfectly reconstructable for disputes and auditing. |
| **R-07** | No hardcoded business rule values in source code. | Any value a business owner may change belongs in the `settings` table. |
| **R-08** | Notifications are never sent directly. Always go through the notification queue. | Reliability, retry logic, deduplication, and audit trail require a queue. |
| **R-09** | Every payment record is immutable. Corrections are made through refunds, not edits. | Financial integrity requires that payment records never change after creation. |
| **R-10** | Inventory units must pass a condition check before becoming `READY_TO_DEPLOY`. | Sending a unit to a customer without inspection is how equipment disappears and disputes start. |
| **R-11** | `tenant_id` is present on every table. | Multi-tenancy cannot be retrofitted safely. It must be a universal column from the start. |
| **R-12** | The Supabase service role key never appears in client-side code. | Exposing the service role key would grant any user full, unrestricted database access. |
| **R-13** | All user input is validated with Zod on the server, regardless of client-side validation. | Client-side validation is UX enhancement only. Server-side validation is security enforcement. |
| **R-14** | Financial records are retained for a minimum of 7 years. | Regulatory compliance. BIR (Philippine Bureau of Internal Revenue) requirements. |
| **R-15** | Soft delete columns (`is_deleted`, `deleted_at`, `deleted_by`) are present on all eligible tables before any data is inserted. | Retrofitting soft delete after data exists risks exposing deleted records or failing constraint checks. |

---

## 20. Development Roadmap

### Phase 1 — Foundation (Weeks 1–2)
**Objective:** The project infrastructure is running, the database exists, and authentication works.

**Deliverables:**
- Next.js 14 project initialized with TypeScript, Tailwind, Shadcn/ui
- Supabase project configured (auth, storage, RLS enabled)
- Complete 41-table database schema with RLS policies
- Supabase Auth configured (email/password + Google OAuth)
- Next.js middleware for session management and route protection
- CI/CD: GitHub Actions + Vercel preview deployments
- `.env.example` with all required variables documented
- Initial seed data: roles, settings defaults, one tenant record

**Completion Criteria:** A developer can log in as admin and see an empty dashboard. All 41 tables exist in Supabase with RLS enabled.

**Dependencies:** None. This is the foundation everything else requires.

---

### Phase 2 — Public Website & Package Catalog (Weeks 3–4)
**Objective:** A real visitor can browse packages and check availability.

**Deliverables:**
- Landing page with hero, features, testimonials (placeholder), FAQ
- Package catalog page
- Package detail page with inclusions and pricing
- Availability checker (date picker connected to `unit_availability`)
- Coverage map (Google Maps with delivery zone polygon)
- Basic settings integration (business name, logo from `settings` table)

**Completion Criteria:** A visitor can view all packages and check if their event date is available. The page loads in < 2.5 seconds on mobile.

**Dependencies:** Phase 1 complete.

---

### Phase 3 — Booking Wizard & Payments (Weeks 5–7)
**Objective:** A customer can complete a paid booking end-to-end.

**Deliverables:**
- Customer registration and login
- 5-step booking wizard (date → package → address → contact → payment)
- Delivery zone validation
- PayMongo integration (card, GCash, Maya)
- Payment webhook handler with signature verification
- Auto-confirmation engine
- Booking reference number generation
- Email confirmation via Resend + React Email template
- Customer portal: booking list and booking detail with timeline
- PDF receipt generation

**Completion Criteria:** A test customer can make a real booking, pay with GCash (test mode), and receive a confirmation email with a receipt.

**Dependencies:** Phase 1 + Phase 2 complete.

---

### Phase 4 — Admin Operations (Weeks 8–10)
**Objective:** Admin can manage all bookings and operations through the dashboard.

**Deliverables:**
- Admin dashboard with exceptions panel, today's schedule, KPI cards
- Full booking management (list, filter, detail, status overrides)
- Manual booking creation
- Package management (create, edit, photos, inclusions, pricing rules)
- Inventory unit management (add, edit, condition, availability)
- Component management (add, edit, condition checks)
- Driver creation and management
- Delivery assignment
- Cash payment logging
- Customer management

**Completion Criteria:** Admin can create a package, add inventory, take a booking, confirm it, assign a driver, and mark a delivery complete — all through the admin dashboard.

**Dependencies:** Phase 3 complete.

---

### Phase 5 — Delivery Operations (Weeks 11–12)
**Objective:** The delivery workflow is fully digital and accountable.

**Deliverables:**
- Driver portal (delivery schedule, assignment detail)
- Pre-delivery equipment checklist
- Proof of delivery (photos + customer signature)
- Post-pickup condition check with component-level inspection
- Incident report creation
- Damage reporting workflow
- SMS notifications via Semaphore (delivery reminders, driver briefing)
- Automated pickup scheduling
- Overtime extension SMS upsell

**Completion Criteria:** A driver can complete an entire delivery → rental → pickup cycle through the web interface, with photos and proof of delivery logged at each step.

**Dependencies:** Phase 4 complete.

---

### Phase 6 — Finance, Expenses & Reporting (Weeks 13–14)
**Objective:** The owner can see real financial health of the business.

**Deliverables:**
- Expense management (create, categorize, approve, receipt upload)
- Revenue records linked to every payment
- Net profit calculation (revenue − expenses)
- Admin dashboard: net profit as the #1 KPI
- Revenue report (by date, package, zone)
- Expense report (by date, category)
- P&L summary (monthly)
- Booking funnel report
- Package occupancy report
- Promo code management and reporting
- Review system (submission, moderation, display)
- Weekly automated business summary email

**Completion Criteria:** Owner can see their real net profit for the current month, drill down into expense categories, and understand which packages are most profitable.

**Dependencies:** Phase 5 complete.

---

### Phase 7 — Polish, Performance & Launch (Weeks 15–16)
**Objective:** The application is production-ready.

**Deliverables:**
- Full SEO optimization (meta tags, Open Graph, sitemap, robots.txt)
- Core Web Vitals in "Good" range
- Accessibility audit (WCAG 2.1)
- Security review (OWASP Top 10 checklist)
- E2E tests for booking flow, payment flow, admin approval flow
- Sentry error monitoring integration
- Uptime monitoring setup
- Custom domain configuration
- Production environment variables configured
- Data backup verification
- Soft launch with 5–10 real test bookings

**Completion Criteria:** The application is live on the production domain. Real bookings can be made and processed. Sentry is capturing errors. Monitoring is active.

**Dependencies:** Phase 6 complete.

---

## 21. AI Collaboration Guide

This section is written specifically for AI models that may continue development of this project in the future. Follow these rules exactly.

---

### 21.1 Before Starting Any Task

Before writing any code, read:
1. This Master Specification Document (especially Sections 2, 3, 7, 13, 19)
2. The current `task.md` artifact (if it exists)
3. The most recent `walkthrough.md` artifact (if it exists)

Never make architectural decisions based on assumptions. If something is not in this document, ask before implementing.

---

### 21.2 Architecture Rules for AI Development

| Rule | Detail |
|------|--------|
| No hardcoded business values | Every fee, percentage, policy period, and configuration value comes from the `settings` table. Never hardcode in source files. |
| Server Actions return a Result type | `{ success: boolean, data?: T, error?: string, code?: string }`. Never throw exceptions from Server Actions. |
| All queries include soft-delete filter | Any query against a soft-delete-enabled table must have `WHERE is_deleted = FALSE` or use the corresponding view. |
| All tables have `tenant_id` | Never create a table without `tenant_id`. For MVP, default it to the KYU tenant's UUID constant. |
| Timeline events are append-only | Never `UPDATE` or `DELETE` rows in `booking_timeline_events`, `audit_logs`, `payments`, `refunds`, `notification_log`. |
| Booking status changes are atomic | Every status change must simultaneously (in one transaction): update `bookings.status` AND insert into `booking_timeline_events`. |
| Validate before touching the database | Zod validation always happens before any Supabase query in Server Actions. |
| Never use `SELECT *` | Always specify column names in queries. |
| Notifications go through the queue | Never call Resend, Twilio, or Semaphore directly from a Server Action. Insert into `notification_queue` instead. |

---

### 21.3 Naming Conventions Reference

| Type | Convention | Example |
|------|-----------|---------|
| Database table | `snake_case` | `booking_timeline_events` |
| Database column | `snake_case` | `deleted_at`, `created_by` |
| TypeScript type | `PascalCase` | `BookingStatus`, `PaymentType` |
| TypeScript interface | `PascalCase` | `BookingDetailProps` |
| React component | `PascalCase` | `BookingWizard`, `AdminDashboard` |
| React component file | `PascalCase.tsx` | `BookingCard.tsx` |
| Server Action file | `camelCase.actions.ts` | `booking.actions.ts` |
| Query file | `camelCase.queries.ts` | `bookings.queries.ts` |
| Zustand store | `camelCase.store.ts` | `bookingWizard.store.ts` |
| Zod schema | `camelCase.schema.ts` | `createBooking.schema.ts` |
| Constants file | `camelCase.ts` | `error-codes.ts` |
| Constant value | `UPPER_SNAKE_CASE` | `MAX_BOOKING_HOURS`, `BOOKING_STATUS` |

---

### 21.4 Folder Placement Reference

| What | Where |
|------|-------|
| Public pages | `src/app/(marketing)/` |
| Auth pages | `src/app/(auth)/` |
| Customer portal pages | `src/app/(customer)/` |
| Admin pages | `src/app/admin/` |
| Webhook handlers | `src/app/api/webhooks/` |
| UI components (domain-specific) | `src/components/{domain}/` |
| Shadcn/ui base components | `src/components/ui/` |
| Server Actions | `src/actions/` |
| Query functions | `src/queries/` |
| Custom React hooks | `src/hooks/` |
| Supabase clients | `src/lib/supabase/` |
| Third-party clients | `src/lib/{service}/` |
| TypeScript types | `src/types/` |
| Zod schemas | `src/lib/validations/` |
| Zustand stores | `src/stores/` |
| React Email templates | `src/emails/` |
| Config constants | `src/config/` |
| Supabase Edge Functions | `supabase/functions/` |
| E2E tests | `tests/e2e/` |
| Integration tests | `tests/integration/` |

---

### 21.5 Database Conventions

| Convention | Detail |
|-----------|--------|
| All PKs are UUID | Use `gen_random_uuid()` as default |
| All tables have `created_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| All mutable tables have `updated_at` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` (updated by trigger) |
| Soft-delete tables have 4 columns | `is_deleted BOOLEAN DEFAULT FALSE`, `deleted_at TIMESTAMPTZ`, `deleted_by UUID`, `deletion_reason TEXT` |
| All FK columns are indexed | No FK without an index |
| Enum values are stored as TEXT | Use `CHECK` constraints or TypeScript enum on the application side. Don't use PostgreSQL ENUM type (difficult to modify) |
| `tenant_id` is always the first FK | After the PK, `tenant_id` is always the first column defined |

---

### 21.6 Before Submitting Any Change — Review Checklist

- [ ] Does this change violate any Project Rule in Section 19?
- [ ] Does this change hardcode a business rule value that should be in `settings`?
- [ ] Does this new table have `tenant_id`, `created_at`, and `updated_at`?
- [ ] Does this new table need soft delete columns? (Check Section 1.3 of Phase 0.5)
- [ ] Does this Server Action validate input with Zod before touching the database?
- [ ] Does this Server Action return the standard Result type?
- [ ] Does this query include the soft-delete filter if applicable?
- [ ] Is any notification being sent directly instead of through the notification queue?
- [ ] Is any business rule value hardcoded instead of reading from `settings`?
- [ ] Does this booking status change update both `bookings.status` AND `booking_timeline_events`?
- [ ] Does this change need an entry in `audit_logs`?
- [ ] Is any secret or API key potentially exposed to the client?
- [ ] Are tests written for new Server Actions?

---

## 22. Final CTO Review

### 22.1 If This Project Were Funded with $5 Million — What Would Still Change?

With $5 million and unlimited resources, the technical architecture would remain largely the same — it is the right architecture for this product at this scale. The money would be spent on things the specification cannot buy: team, validation, and market intelligence.

**What would change technically:**

1. **Event sourcing for the booking domain.** With budget for a senior backend engineer, the booking domain would be rebuilt as a pure event-sourced system. The current state machine + timeline table is good. Event sourcing is better — it eliminates the possibility of state corruption, makes replaying history trivial, and creates a perfect audit trail at the architectural level, not the application level.

2. **Trigger.dev for background jobs instead of Supabase Edge Functions.** The queue system is well-designed, but Supabase Edge Functions have limitations (cold starts, timeout constraints, limited observability). Trigger.dev provides professional-grade background job management with retries, observability, and a developer-friendly SDK. $5M budget makes this the right choice.

3. **A dedicated design system.** Instead of building components on the fly, a $5M budget funds a proper design system: Figma documentation, component library, design tokens, accessibility compliance built into every component. This produces 2–3x faster UI development quality.

4. **Real-time driver tracking from Day 1.** The current specification defers GPS tracking to a future version. With $5M, a React Native driver app with real-time location sharing (using Supabase Realtime + PostGIS) would be built in Phase 1. Customer trust increases dramatically when they can see "driver is 10 minutes away."

---

### 22.2 Identified Weaknesses

| Weakness | Severity | Mitigation |
|----------|---------|-----------|
| **Single point of failure: PayMongo** | 🔴 High | If PayMongo has downtime, no bookings can be confirmed. Design the system to queue bookings and process payments when service is restored. Add Stripe as a secondary gateway for future. |
| **No offline capability for drivers** | 🟡 Medium | A driver in a signal-dead area cannot complete a delivery checklist. The web app cannot handle offline sync. This is acceptable for MVP but must be addressed before the driver mobile app is built. |
| **Analytics snapshots are 1 day stale** | 🟡 Medium | Dashboard KPIs are from last night's snapshot, not real-time. For a high-volume business, this is a real limitation. Implement live KPI queries for today's numbers alongside the snapshot data. |
| **No built-in conflict resolution for double-booking** | 🟡 Medium | The race condition mitigation (advisory locks, unique constraints) is correct, but the admin needs a UI to detect and resolve any conflicts that slip through. Build a "Booking Conflicts" report. |
| **Settings module has no validation enforcement at DB level** | 🟢 Low | The `validation_rules` JSONB column is application-enforced only. A developer could bypass it and insert an invalid reservation percentage of 150%. Add a DB-level check constraint for critical numerical settings. |

---

### 22.3 Missing Opportunities

| Opportunity | Description | Priority |
|------------|-------------|----------|
| **WhatsApp Business API** | The Philippine market communicates primarily via Facebook Messenger and WhatsApp. An SMS notification is good. A WhatsApp message with the booking confirmation, receipt PDF attached, and a "Reply for support" option is transformational for customer experience. This should be in Version 2, not deferred indefinitely. | 🔴 High |
| **Upsell at every touchpoint** | The specification has add-ons at checkout and the overtime extension SMS. But there are more touchpoints: the confirmation email ("Add an extra microphone for ₱200"), the reminder email ("Upgrade to White Glove setup for your event"), the "rental active" notification ("Extend your rental for ₱300/hour"). Each is a revenue opportunity. | 🟡 Medium |
| **Google Business Profile integration** | Positive reviews collected in the system should be encouraged to be published on Google Business Profile. This is the #1 local business trust signal. A post-review prompt: "Love the experience? Share it on Google too!" with a direct link. | 🟡 Medium |
| **Seasonal packages** | Christmas, Valentine's Day, graduation, birthdays — the system has the pricing rules infrastructure for seasonal packages, but the specification doesn't mention pre-designed seasonal package templates that can be activated each year. This is a marketing automation opportunity. | 🟢 Low |
| **Customer referral program is under-specified** | The referral program is mentioned in Phase 0.6 but not architected in Phase 0.5. It needs: a `referral_codes` table, a `referral_credits` table, a credit redemption flow at checkout, and a referral dashboard for customers. It needs to be built in Phase 2, not invented later. | 🟡 Medium |

---

### 22.4 Architectural Improvements Still Recommended

| Improvement | When |
|------------|------|
| Separate referral and loyalty program tables added to Phase 0.5 database design | Before Phase 3 |
| WhatsApp channel added to notification queue as a planned future channel | Before notification module is built |
| Live (non-snapshot) KPI queries for "today's numbers" alongside snapshot data | Phase 4 |
| Booking conflict detection admin report | Phase 4 |
| Settings validation at DB level for numerical constraints | Phase 1 (during schema creation) |

---

### 22.5 Final Verdict

**The specification is production-ready for Phase 1 to begin.**

The planning suite (Phase 0 + 0.5 + 0.6 + this document) represents one of the most thorough pre-development specifications for a SaaS rental platform at this scale. The architecture is sound. The business rules are explicit. The security model is correct. The multi-tenancy foundation is prepared without over-engineering for MVP.

The biggest remaining risk is not architectural — it is executional. The quality of the implementation will determine whether this becomes a world-class product or a technically correct but operationally awkward system. Two things must be protected during development:

1. **The Product Philosophy in Section 2.** If you start bending the "Automation First" and "Admin Handles Exceptions Only" principles to save development time, you will rebuild the admin workflow twice.

2. **The Project Rules in Section 19.** These rules exist because violating them creates problems that appear months later as production incidents, data corruption, financial disputes, or security vulnerabilities. They are not suggestions.

> **If this were my own company, I would begin Phase 1 development this week, not next month.**
> The planning is done. More planning is procrastination.
> Ship it.

---

*Document version 1.0.0 — Master Specification Complete*
*This document is the official constitution of KYU Rentals.*
*All future development must follow this specification.*
*Amendments require version increment and documented rationale.*

---

**Document History**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | July 23, 2026 | CTO / Senior Architect | Initial release — consolidates Phase 0, 0.5, 0.6 |
