# KYU Rentals — Phase 0.5: Architecture Review & Refinement
### Enterprise-Grade System Design Document
**Prepared by:** Senior Software Architect (15+ Years Enterprise Systems Design)
**Based on:** Phase 0 Blueprint v1.0.0
**Date:** July 22, 2026
**Version:** 1.0.0

---

> [!IMPORTANT]
> This document challenges, refines, and extends the Phase 0 Blueprint. It identifies architectural weaknesses, corrects design gaps, and introduces enterprise-grade patterns that must be locked in before the first line of code is written. No source code, SQL, or UI is generated here.

---

## Table of Contents

1. [Soft Delete Strategy](#1-soft-delete-strategy)
2. [Complete Audit Logging](#2-complete-audit-logging)
3. [Booking Timeline Architecture](#3-booking-timeline-architecture)
4. [Notification Queue System](#4-notification-queue-system)
5. [Global Settings Module](#5-global-settings-module)
6. [Inventory Redesign](#6-inventory-redesign)
7. [Package Design](#7-package-design)
8. [Expense Module](#8-expense-module)
9. [Dashboard Analytics](#9-dashboard-analytics)
10. [Driver & Delivery Module](#10-driver--delivery-module)
11. [Financial Reporting Architecture](#11-financial-reporting-architecture)
12. [Future SaaS Readiness](#12-future-saas-readiness)
13. [Risk Assessment](#13-risk-assessment)
14. [Final Architecture Review](#14-final-architecture-review)

---

## 1. Soft Delete Strategy

### 1.1 Why Soft Deletes Are Non-Negotiable for a Rental Business

In a rental business, permanent deletion is almost always the wrong answer. When a customer claims they were charged incorrectly, when an admin accidentally deletes a package, or when a tax audit requires records from two years ago — you need the data. Hard deletes destroy the evidence trail that protects both the business and the customer.

Beyond legal protection, referential integrity in a relational database means that hard-deleting a record (e.g., a `package`) that is referenced by existing `bookings` will either cascade-delete the booking history or fail with a foreign key violation. Neither outcome is acceptable.

**Soft delete preserves:**
- Historical booking records linked to deleted packages
- Customer records after account deactivation (for tax and legal compliance)
- Staff records after termination (for audit trail continuity)
- Inventory records after a unit is retired (for depreciation and replacement history)

---

### 1.2 Soft Delete Columns (Standard)

Every soft-delete-enabled table receives the following four columns:

| Column | Type | Description |
|--------|------|-------------|
| `deleted_at` | `TIMESTAMPTZ` | NULL if active. Timestamp when the record was soft-deleted. |
| `deleted_by` | `UUID` | Foreign key to `profiles.id`. Who performed the deletion. |
| `deletion_reason` | `TEXT` | Optional freetext reason for deletion (mandatory for admin-initiated deletes). |
| `is_deleted` | `BOOLEAN` | Computed/denormalized flag. `true` when `deleted_at IS NOT NULL`. Used for fast index queries. |

> [!NOTE]
> `is_deleted` is a redundant but pragmatic column. While `deleted_at IS NOT NULL` achieves the same result, a dedicated boolean column allows a partial index (`WHERE is_deleted = FALSE`) that performs dramatically better on large tables than a nullable-timestamp partial index.

---

### 1.3 Tables That Require Soft Delete

| Table | Soft Delete? | Reasoning |
|-------|-------------|-----------|
| `profiles` | ✅ Yes | Customers may request account deletion (GDPR). Must retain booking history linkage. |
| `packages` | ✅ Yes | Packages referenced by historical bookings cannot be hard deleted. |
| `package_photos` | ✅ Yes | Photos tied to archived packages must be retained. |
| `package_inclusions` | ✅ Yes | Historical booking inclusions must remain accurate. |
| `inventory_units` | ✅ Yes | Retired units must remain linked to past bookings and maintenance logs. |
| `inventory_components` | ✅ Yes | Components (cables, mics) may be retired. History must be preserved. |
| `promo_codes` | ✅ Yes | Expired promos should be archived, not deleted, for revenue reconciliation. |
| `delivery_zones` | ✅ Yes | Retired zones may still be referenced by old bookings. |
| `staff_assignments` | ✅ Yes | Terminated staff's delivery history must remain intact. |
| `expenses` | ✅ Yes | Incorrect expense entries should be voided, not deleted, for accounting. |
| `bookings` | ❌ No | Bookings are never deleted. Status progression handles lifecycle. |
| `payments` | ❌ No | Financial records must never be deleted for compliance. Refunds handle corrections. |
| `audit_logs` | ❌ No | Audit logs are immutable. Deletion would defeat the purpose. |
| `booking_timeline_events` | ❌ No | Timeline events are immutable. |
| `reviews` | ✅ Yes | Reviews can be removed by admin without destroying the booking link. |
| `notifications` | ✅ Yes | Users can "delete" notifications from their inbox without removing the record. |
| `notification_queue` | ❌ No | Queue entries are processed and archived, never deleted. |
| `settings` | ❌ No | Settings are versioned (see Section 5), not deleted. |

---

### 1.4 Implementation Strategy

**Default Query Filter**

All database queries against soft-delete-enabled tables must include a `WHERE is_deleted = FALSE` filter by default. This is enforced at the data access layer — in `src/queries/*.ts` — not in the UI layer. A missing filter is a bug, not a feature flag.

**RLS Policy Integration**

RLS policies on soft-delete tables always include `AND is_deleted = FALSE` to ensure deleted records are invisible to all roles by default. A separate `admin.deleted_records` view bypasses this filter for authorized admins reviewing the archive.

**Partial Index on `is_deleted`**

```
INDEX: idx_{table}_active ON {table} (created_at DESC) WHERE is_deleted = FALSE
```

This ensures active-record queries use a small, fast index rather than scanning the full table including historical deleted records.

**Archive Strategy**

For long-term archiving (records deleted > 2 years ago), a scheduled Supabase Edge Function runs monthly and moves soft-deleted records from operational tables into corresponding `*_archive` shadow tables. This keeps the operational tables lean without destroying the historical record.

| Operational Table | Archive Table |
|-------------------|--------------|
| `profiles` | `profiles_archive` |
| `packages` | `packages_archive` |
| `inventory_units` | `inventory_units_archive` |

**Restore Strategy**

Restoration is a first-class admin action, not a developer console operation. A dedicated admin UI panel (under `Settings > Data Management`) shows all soft-deleted records grouped by type, with a **Restore** button. Restoring a record sets `deleted_at = NULL`, `deleted_by = NULL`, `deletion_reason = NULL`, and `is_deleted = FALSE`, and creates an `audit_log` entry.

---

## 2. Complete Audit Logging

### 2.1 Why Professional Audit Logging Matters

An audit log is the difference between "something went wrong" and "here is exactly what happened, when, by whom, from which IP address, and what the data looked like before and after." For a rental business, this protects against:

- Staff claiming they didn't change a booking price
- Customers disputing that a cancellation was processed
- Tax authorities requiring proof of financial record integrity
- Debugging production incidents without access to user sessions

The Phase 0 audit log design was a starting point. This section upgrades it to an enterprise-grade, tamper-evident, retention-managed system.

---

### 2.2 Audit Event Categories

| Category | Events |
|----------|--------|
| **Auth** | login.success, login.failed, logout, password.reset.requested, password.reset.completed, oauth.login, account.locked, session.expired |
| **User** | user.created, user.updated, user.deactivated, user.restored, user.deleted, role.assigned, role.revoked |
| **Booking** | booking.created, booking.updated, booking.confirmed, booking.rejected, booking.cancelled, booking.rescheduled, booking.completed, booking.manually_created |
| **Payment** | payment.initiated, payment.received, payment.failed, payment.refunded, payment.voided, payment.cash_recorded |
| **Inventory** | unit.created, unit.updated, unit.condition_changed, unit.retired, unit.restored, component.added, component.removed, component.replaced |
| **Package** | package.created, package.updated, package.published, package.unpublished, package.deleted, package.restored |
| **Pricing** | price.updated, promo.created, promo.deactivated, promo.applied, surcharge.configured |
| **Delivery** | assignment.created, assignment.updated, delivery.started, delivery.completed, pickup.started, pickup.completed |
| **Expense** | expense.created, expense.updated, expense.voided, expense.approved |
| **Settings** | setting.updated, zone.created, zone.updated, zone.deleted |
| **System** | webhook.received, webhook.failed, notification.sent, notification.failed, cron.executed |

---

### 2.3 `audit_logs` Table — Revised Design

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Future SaaS: which business this log belongs to |
| `performed_by` | UUID | FK → `profiles.id`. NULL for system-generated events. |
| `performed_by_role` | TEXT | Snapshot of the actor's role at time of action (roles may change later) |
| `action` | TEXT | Dot-notation action name: `booking.confirmed` |
| `category` | TEXT | Enum: auth, booking, payment, inventory, package, delivery, expense, settings, system |
| `entity_type` | TEXT | The resource type: `booking`, `package`, `payment`, etc. |
| `entity_id` | UUID | The specific resource ID affected |
| `entity_label` | TEXT | Human-readable label snapshot: `"Booking #KYU-2026-00123"` |
| `before_state` | JSONB | Complete snapshot of the record BEFORE the change. NULL for creates. |
| `after_state` | JSONB | Complete snapshot of the record AFTER the change. NULL for deletes. |
| `diff` | JSONB | Computed diff — only changed fields. Makes audit viewing easier. |
| `metadata` | JSONB | Extra context: `{ "ip": "...", "user_agent": "...", "booking_ref": "..." }` |
| `ip_address` | INET | Client IP address |
| `user_agent` | TEXT | Browser/client user agent |
| `request_id` | UUID | Trace ID matching the request that triggered this action (for debugging) |
| `severity` | TEXT | Enum: info, warning, critical. Critical for financial events. |
| `created_at` | TIMESTAMPTZ | Immutable. Set once on insert. Never updated. |

**Constraints:**
- No `UPDATE` or `DELETE` allowed on `audit_logs`. Enforced by RLS: only `INSERT` is granted.
- `created_at` defaults to `NOW()` and is not overridable by the application layer.

---

### 2.4 Indexes for `audit_logs`

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_audit_performed_by` | `performed_by, created_at DESC` | "What did this admin do?" |
| `idx_audit_entity` | `entity_type, entity_id, created_at DESC` | "What happened to this booking/package?" |
| `idx_audit_action` | `action, created_at DESC` | Filter by specific event type |
| `idx_audit_category` | `category, created_at DESC` | Filter by category |
| `idx_audit_severity` | `severity, created_at DESC` | Alert on critical events |
| `idx_audit_tenant` | `tenant_id, created_at DESC` | Future SaaS: per-tenant log isolation |
| `idx_audit_created` | `created_at DESC` | Chronological browsing |

---

### 2.5 Retention Policy

| Severity | Retention Period | Archive Destination |
|----------|-----------------|---------------------|
| `info` | 12 months in operational table | Compressed cold storage after 12 months |
| `warning` | 24 months | Compressed cold storage after 24 months |
| `critical` | 7 years (financial compliance) | Encrypted cold storage, never purged |

A monthly scheduled Edge Function moves aged `info` and `warning` logs to a `audit_logs_archive` table (or external storage). `critical` logs remain in the operational table for 7 years minimum.

---

### 2.6 How Audit Logging Is Triggered

| Mechanism | When Used |
|-----------|----------|
| **Application layer** (Server Actions / Route Handlers) | All user-initiated actions. The code explicitly writes an audit record after every mutation. |
| **Database triggers** (PostgreSQL) | Financial table changes (payments, refunds) — enforced even if application code is bypassed. |
| **Supabase Edge Functions** | System events (cron jobs, webhook processing, notification delivery). |

The application layer is the primary mechanism. Database triggers serve as a safety net for the most critical tables. This avoids the maintenance burden of trigger-based auditing on every table.

---

## 3. Booking Timeline Architecture

### 3.1 The Problem with a Single `status` Column

The Phase 0 blueprint stores booking status as a single enum column on the `bookings` table. This works at first, but creates several problems:

1. **You lose granularity.** "Confirmed" tells you the admin approved it, but you don't know when the driver was assigned, or when they left the warehouse.
2. **You lose accountability.** The status column only shows the current value — not who changed it or why.
3. **You can't reconstruct the timeline.** If a customer disputes a delivery date, you need evidence. A single status field provides none.
4. **Status transitions are not enforced.** Nothing prevents jumping from `PENDING` directly to `COMPLETED` without going through `CONFIRMED` and `ACTIVE`.

The solution is a dedicated `booking_timeline_events` table with a formal state machine.

---

### 3.2 Booking State Machine

Every booking moves through a defined sequence of states. Transitions are only valid in one direction (with a few exceptions for cancellation and rejection at any stage).

```
                    ┌─────────────────┐
                    │  DRAFT          │ ← Optional: saved incomplete bookings
                    └────────┬────────┘
                             │ Customer submits booking
                             ▼
                    ┌─────────────────┐
                    │  PENDING_PAYMENT│ ← Awaiting initial payment
                    └────────┬────────┘
                             │ Payment received
                             ▼
                    ┌─────────────────┐
                    │  PENDING_       │ ← Payment done, awaiting admin review
                    │  CONFIRMATION   │
                    └────────┬────────┘
                             │ Admin confirms
                             ▼
                    ┌─────────────────┐
                    │  CONFIRMED      │ ← Booking approved
                    └────────┬────────┘
                             │ Admin/staff begins prep
                             ▼
                    ┌─────────────────┐
                    │  PREPARING      │ ← Equipment being prepared/loaded
                    └────────┬────────┘
                             │ Driver assigned + departure scheduled
                             ▼
                    ┌─────────────────┐
                    │  DRIVER_ASSIGNED│ ← Driver and timeslot assigned
                    └────────┬────────┘
                             │ Driver departs for delivery
                             ▼
                    ┌─────────────────┐
                    │  OUT_FOR_       │ ← En route to customer
                    │  DELIVERY       │
                    └────────┬────────┘
                             │ Equipment delivered to customer
                             ▼
                    ┌─────────────────┐
                    │  DELIVERED      │ ← Delivered, balance collected
                    └────────┬────────┘
                             │ Rental period begins
                             ▼
                    ┌─────────────────┐
                    │  RENTAL_ACTIVE  │ ← Customer is using the unit
                    └────────┬────────┘
                             │ Pickup scheduled
                             ▼
                    ┌─────────────────┐
                    │  PICKUP_        │ ← Pickup time confirmed
                    │  SCHEDULED      │
                    └────────┬────────┘
                             │ Driver departs for pickup
                             ▼
                    ┌─────────────────┐
                    │  OUT_FOR_PICKUP │ ← En route to pick up
                    └────────┬────────┘
                             │ Equipment picked up
                             ▼
                    ┌─────────────────┐
                    │  PICKED_UP      │ ← Unit returned to warehouse
                    └────────┬────────┘
                             │ Admin/system finalizes
                             ▼
                    ┌─────────────────┐
                    │  COMPLETED      │ ← Booking closed, revenue recorded
                    └────────┬────────┘
                             │ After review period (30 days)
                             ▼
                    ┌─────────────────┐
                    │  ARCHIVED       │ ← Long-term storage state
                    └─────────────────┘

 ─ ─ ─ ─ ─ ─ ─ ─ CANCELLATION / REJECTION (from any active state) ─ ─ ─ ─ ─ ─ ─ ─

                    ┌─────────────────┐
                    │  CANCELLATION_  │ ← Customer requested cancel
                    │  REQUESTED      │
                    └────────┬────────┘
                             │ Admin approves cancellation
                             ▼
                    ┌─────────────────┐
                    │  CANCELLED      │ ← Booking cancelled, refund initiated
                    └─────────────────┘

                    ┌─────────────────┐
                    │  REJECTED       │ ← Admin rejected the booking at confirmation
                    └─────────────────┘

                    ┌─────────────────┐
                    │  PAYMENT_FAILED │ ← Payment was not completed in time
                    └─────────────────┘
```

**Valid Transitions Table**

| From State | Valid Next States |
|-----------|-----------------|
| `DRAFT` | `PENDING_PAYMENT`, `CANCELLED` |
| `PENDING_PAYMENT` | `PENDING_CONFIRMATION`, `PAYMENT_FAILED`, `CANCELLED` |
| `PENDING_CONFIRMATION` | `CONFIRMED`, `REJECTED`, `CANCELLATION_REQUESTED` |
| `CONFIRMED` | `PREPARING`, `CANCELLATION_REQUESTED`, `REJECTED` |
| `PREPARING` | `DRIVER_ASSIGNED`, `CANCELLATION_REQUESTED` |
| `DRIVER_ASSIGNED` | `OUT_FOR_DELIVERY`, `CANCELLATION_REQUESTED` |
| `OUT_FOR_DELIVERY` | `DELIVERED`, `CANCELLATION_REQUESTED` |
| `DELIVERED` | `RENTAL_ACTIVE` |
| `RENTAL_ACTIVE` | `PICKUP_SCHEDULED` |
| `PICKUP_SCHEDULED` | `OUT_FOR_PICKUP` |
| `OUT_FOR_PICKUP` | `PICKED_UP` |
| `PICKED_UP` | `COMPLETED` |
| `COMPLETED` | `ARCHIVED` |
| `CANCELLATION_REQUESTED` | `CANCELLED`, `CONFIRMED` (if admin rejects the cancel request) |

**State transition violations must throw an error.** The application layer enforces this — an admin cannot manually set `COMPLETED` if the booking is still `OUT_FOR_DELIVERY`.

---

### 3.3 `booking_timeline_events` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `booking_id` | UUID | FK → `bookings.id` |
| `from_status` | TEXT | The status before this event (NULL for the first event) |
| `to_status` | TEXT | The status after this event |
| `event_label` | TEXT | Human-readable label: `"Booking Confirmed by Admin"` |
| `event_description` | TEXT | Optional longer description or reason |
| `performed_by` | UUID | FK → `profiles.id`. NULL for system-triggered events. |
| `performed_by_role` | TEXT | Snapshot of actor's role |
| `is_system_event` | BOOLEAN | TRUE if triggered automatically (payment webhook, cron job) |
| `metadata` | JSONB | Extra data: `{ "driver_id": "...", "delivery_time": "..." }` |
| `created_at` | TIMESTAMPTZ | Immutable. The exact moment this transition occurred. |

**Key Design Decisions:**
- Records are **immutable** — INSERT only. No UPDATE or DELETE ever.
- `bookings.status` is the **current** status (fast single-column reads).
- `booking_timeline_events` is the **historical record** (for display, disputes, analytics).
- Every status change writes both: update `bookings.status` AND insert a new `booking_timeline_events` row — always in the same database transaction.

---

### 3.4 Customer-Facing Timeline Display

The timeline is displayed in the customer's booking detail page as a vertical step-by-step component. Each event shows:
- **Icon** (delivery truck, checkmark, package, etc.)
- **Status label** ("Booking Confirmed")
- **Timestamp** (formatted: "July 22, 2026 at 3:15 PM")
- **Actor** ("by Admin") — only for internal-facing views

Future events (not yet reached) appear as grayed-out steps, giving the customer a clear expectation of what comes next.

---

## 4. Notification Queue System

### 4.1 Why Direct Sending Is Wrong

The Phase 0 blueprint sends notifications directly from Server Actions and Edge Functions. This is a critical architectural mistake for production systems:

1. **If the email/SMS provider is down**, the booking action fails or partially succeeds
2. **No retry mechanism** — a failed SMS notification is silently lost
3. **No audit trail** — you can't prove a notification was sent or when
4. **Tight coupling** — changing from Resend to SendGrid requires modifying every Server Action that sends email
5. **No scheduling** — "send 24 hours before delivery" cannot be done synchronously

The solution is a **dedicated notification queue** — a database table that decouples notification intent from notification delivery.

---

### 4.2 Architecture Overview

```
[Application Action]
        │
        │ Inserts a row (NOT sends directly)
        ▼
[notification_queue table]
        │
        │ Supabase Edge Function polls every 30 seconds
        ▼
[Queue Processor]
        │
   ┌────┴────────────────────────┐
   │                             │
   ▼                             ▼
[Email Channel]          [SMS Channel]
(Resend)                 (Semaphore / Twilio)
   │                             │
   ▼                             ▼
[Mark as SENT]           [Mark as SENT]
   │                             │
   └────────────┬────────────────┘
                ▼
     [notification_log (permanent record)]
```

---

### 4.3 `notification_queue` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Future SaaS support |
| `recipient_id` | UUID | FK → `profiles.id`. NULL for external-only recipients. |
| `recipient_email` | TEXT | Email address (may differ from profile email) |
| `recipient_phone` | TEXT | Phone number in E.164 format (+639XXXXXXXXX) |
| `channel` | TEXT | Enum: `email`, `sms`, `push`, `messenger`, `whatsapp` |
| `priority` | INTEGER | 1=critical, 2=high, 3=normal, 4=low. Processed in priority order. |
| `status` | TEXT | Enum: `pending`, `processing`, `sent`, `failed`, `cancelled`, `scheduled` |
| `template_key` | TEXT | References a template: `booking.confirmed`, `payment.receipt` |
| `template_data` | JSONB | Variables to inject into the template: `{ "customer_name": "...", "booking_ref": "..." }` |
| `subject` | TEXT | Pre-rendered email subject (optional, can be derived from template) |
| `body_html` | TEXT | Pre-rendered HTML body (email only) |
| `body_text` | TEXT | Pre-rendered plain text body |
| `scheduled_for` | TIMESTAMPTZ | NULL = send immediately. Future date = send at that time. |
| `attempts` | INTEGER | How many delivery attempts have been made. Starts at 0. |
| `max_attempts` | INTEGER | Max retries before marking as `failed`. Default: 3. |
| `last_attempted_at` | TIMESTAMPTZ | Timestamp of last delivery attempt |
| `next_retry_at` | TIMESTAMPTZ | When to retry after a failure (exponential backoff) |
| `sent_at` | TIMESTAMPTZ | When the notification was successfully delivered |
| `failure_reason` | TEXT | Last error message from the provider |
| `provider_message_id` | TEXT | Provider's message ID for tracking (Resend email ID, Semaphore message ID) |
| `booking_id` | UUID | FK → `bookings.id`. For context and deduplication. |
| `idempotency_key` | TEXT | Unique key to prevent duplicate sends (e.g., `booking_confirmed_{booking_id}`) |
| `created_at` | TIMESTAMPTZ | When this notification was enqueued |
| `created_by` | UUID | Who or what triggered this notification (user ID or `SYSTEM`) |

---

### 4.4 `notification_log` Table (Permanent Archive)

After a notification is successfully sent or permanently failed, it moves to `notification_log`. This table is append-only and never modified.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `queue_id` | UUID | Original ID from `notification_queue` |
| `tenant_id` | UUID | Future SaaS support |
| `recipient_id` | UUID | FK → `profiles.id` |
| `channel` | TEXT | Email, SMS, etc. |
| `template_key` | TEXT | Which template was used |
| `status` | TEXT | `sent` or `failed` |
| `provider_message_id` | TEXT | Provider's tracking ID |
| `provider_response` | JSONB | Full API response from the provider |
| `attempts` | INTEGER | Total attempts made |
| `sent_at` | TIMESTAMPTZ | When delivered (NULL if failed) |
| `booking_id` | UUID | For filtering by booking |
| `created_at` | TIMESTAMPTZ | Timestamp |

---

### 4.5 Retry Strategy (Exponential Backoff)

| Attempt | Wait Before Retry |
|---------|-----------------|
| 1st failure | Wait 2 minutes |
| 2nd failure | Wait 15 minutes |
| 3rd failure | Wait 1 hour |
| 4th failure (max) | Mark as FAILED permanently, alert admin |

After max attempts, an alert notification is sent to the admin (via a different channel than the failed one) so they can manually follow up with the customer.

---

### 4.6 Scheduled Notifications

Scheduled notifications are first-class citizens in the queue. The `scheduled_for` column enables:

| Notification | Scheduled For |
|-------------|--------------|
| Delivery reminder to customer | 24 hours before `event_date` |
| SMS reminder to driver | 2 hours before delivery time |
| Pickup reminder to customer | 1 hour before scheduled pickup |
| Review request email | 24 hours after booking `COMPLETED` |
| Balance due reminder | 48 hours before delivery (if balance not yet paid) |
| Abandoned booking reminder | 2 hours after `DRAFT` created without payment |

The queue processor checks `scheduled_for <= NOW()` before processing — nothing is sent early.

---

### 4.7 n8n Integration Path

The notification queue is designed to be consumed by **n8n** (workflow automation) in the future without any application code changes:

1. n8n connects to Supabase via the REST API or a webhook trigger
2. n8n polls `notification_queue WHERE status = 'pending' AND (scheduled_for IS NULL OR scheduled_for <= NOW())`
3. n8n processes the notification through any channel (email, WhatsApp, Messenger, Viber)
4. n8n updates `status = 'sent'` and writes to `notification_log`

This means adding a new channel (WhatsApp, Viber) requires **zero application code changes** — only a new n8n workflow.

---

## 5. Global Settings Module

### 5.1 Why Hardcoded Config Is Technical Debt

Any value that might change without a code deployment must live in the database. Hardcoding the reservation fee percentage (e.g., 30%) in source code means every adjustment requires a developer, a git commit, and a deployment. For a growing rental business, this is unacceptable.

---

### 5.2 Settings Architecture

Settings are stored in a typed key-value store with support for grouped namespaces, data type enforcement, and version history.

**`settings` Table — Revised Design**

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Future SaaS: per-tenant settings |
| `namespace` | TEXT | Group prefix: `business`, `pricing`, `delivery`, `policy`, `notifications`, `appearance`, `integrations` |
| `key` | TEXT | Unique within namespace: `business.name`, `pricing.reservation_pct` |
| `value` | JSONB | The actual setting value. Typed by `data_type`. |
| `data_type` | TEXT | Enum: `string`, `number`, `boolean`, `json`, `url`, `image_url`, `html`, `markdown` |
| `label` | TEXT | Human-readable admin UI label: `"Reservation Fee Percentage"` |
| `description` | TEXT | Help text shown in admin panel: `"Percentage of total booking charged as reservation fee (0–100)"` |
| `validation_rules` | JSONB | Constraints: `{ "min": 0, "max": 100, "required": true }` |
| `is_public` | BOOLEAN | If TRUE, this setting is safe to expose in the public API (e.g., business name, hours) |
| `is_sensitive` | BOOLEAN | If TRUE, mask in UI and admin logs (e.g., API keys) |
| `updated_by` | UUID | FK → `profiles.id` |
| `updated_at` | TIMESTAMPTZ | Last modification time |
| `created_at` | TIMESTAMPTZ | |

**`settings_history` Table** — Append-only version history of every setting change

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | |
| `setting_id` | UUID | FK → `settings.id` |
| `previous_value` | JSONB | Value before the change |
| `new_value` | JSONB | Value after the change |
| `changed_by` | UUID | FK → `profiles.id` |
| `changed_at` | TIMESTAMPTZ | |
| `reason` | TEXT | Optional reason for change |

---

### 5.3 Complete Settings Registry

**Business Identity**

| Key | Type | Description |
|-----|------|-------------|
| `business.name` | string | "KYU Rentals" |
| `business.tagline` | string | Short marketing tagline |
| `business.logo_url` | image_url | Main logo |
| `business.logo_dark_url` | image_url | Dark-mode logo |
| `business.favicon_url` | image_url | Favicon |
| `business.address` | string | Physical business address |
| `business.phone` | string | Primary contact number |
| `business.email` | string | Primary contact email |
| `business.hours` | json | `{ "mon": "8AM-8PM", "tue": "8AM-8PM", ... }` |
| `business.timezone` | string | `"Asia/Manila"` |
| `business.currency` | string | `"PHP"` |
| `business.currency_symbol` | string | `"₱"` |

**Pricing & Fees**

| Key | Type | Description |
|-----|------|-------------|
| `pricing.reservation_pct` | number | Percentage of total charged as reservation fee (e.g., 30) |
| `pricing.tax_rate` | number | VAT/tax percentage (e.g., 12) |
| `pricing.overtime_rate_per_hour` | number | Charge per hour beyond rental period |
| `pricing.late_return_fee` | number | Flat fee for returning equipment late |
| `pricing.damage_deposit` | number | Refundable deposit collected on delivery |
| `pricing.free_delivery_threshold` | number | Booking total above which delivery is free |
| `pricing.weekend_surcharge_pct` | number | Extra percentage charged on Saturdays/Sundays |
| `pricing.holiday_surcharge_pct` | number | Extra percentage on public holidays |

**Policy**

| Key | Type | Description |
|-----|------|-------------|
| `policy.cancellation_window_full_refund_hrs` | number | Hours before event for 100% refund (e.g., 72) |
| `policy.cancellation_window_partial_refund_hrs` | number | Hours before event for 50% refund (e.g., 24) |
| `policy.partial_refund_pct` | number | Refund percentage in partial window (e.g., 50) |
| `policy.booking_expiry_hours` | number | Hours before unpaid bookings auto-cancel |
| `policy.min_advance_booking_hours` | number | Minimum hours in advance a booking must be made |
| `policy.max_advance_booking_days` | number | How far in advance a booking can be placed |
| `policy.terms_and_conditions` | markdown | Full T&C text |
| `policy.privacy_policy` | markdown | Full privacy policy text |
| `policy.refund_policy` | markdown | Full refund policy text |

**Notifications**

| Key | Type | Description |
|-----|------|-------------|
| `notifications.delivery_reminder_hours` | number | Hours before delivery to send customer reminder |
| `notifications.review_request_hours` | number | Hours after COMPLETED to send review request |
| `notifications.balance_reminder_hours` | number | Hours before delivery to send balance reminder |
| `notifications.admin_email` | string | Email for admin notifications |
| `notifications.sms_enabled` | boolean | Global toggle for SMS sending |
| `notifications.email_enabled` | boolean | Global toggle for email sending |

**Social Links**

| Key | Type | Description |
|-----|------|-------------|
| `social.facebook_url` | url | |
| `social.instagram_url` | url | |
| `social.tiktok_url` | url | |
| `social.youtube_url` | url | |
| `social.twitter_url` | url | |

**Integrations**

| Key | Type | Description |
|-----|------|-------------|
| `integrations.paymongo_enabled` | boolean | Toggle PayMongo gateway |
| `integrations.paymongo_mode` | string | `"live"` or `"test"` |
| `integrations.maps_api_key` | string (sensitive) | Google Maps API key |
| `integrations.google_analytics_id` | string | GA4 Measurement ID |

---

### 5.4 Caching Strategy

Settings do not change frequently but are read on every request. To avoid database round-trips:

- Settings are cached in-memory on server startup and after every admin change
- Cache TTL: 5 minutes (or invalidated immediately on `settings` table change via Supabase Realtime)
- A `getSettings(namespace)` helper function in `src/lib/settings.ts` abstracts the cache layer — callers never query the database directly

---

## 6. Inventory Redesign

### 6.1 The Weakness of Flat Inventory

The Phase 0 inventory model treats each karaoke unit as an atomic, indivisible entity. In reality, a karaoke machine is an assembly of multiple components, each of which can break independently, go missing, need replacement, or require maintenance. When a customer returns the unit with a broken microphone, the system needs to know:

- Which specific microphone (serial number?)
- What was its condition before delivery?
- Who was responsible for delivering it?
- Has this component broken before?
- Does this trigger a repair order or replacement?

A flat `inventory_units` table cannot answer any of these questions.

---

### 6.2 Component-Based Inventory Model

```
packages
    │
    └── inventory_units (the complete rental set)
                │
                └── inventory_components (individual physical parts)
                            │
                            ├── maintenance_logs (repair history per component)
                            ├── replacement_records (what replaced what)
                            └── condition_checks (pre/post rental condition per booking)
```

---

### 6.3 `inventory_units` Table — Revised

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Future SaaS |
| `package_id` | UUID | FK → `packages.id`. Which rental package this unit represents. |
| `unit_name` | TEXT | e.g., "Karaoke Set Alpha", "KYU-UNIT-001" |
| `serial_number` | TEXT | Unique serial number or asset tag |
| `condition` | TEXT | Enum: `excellent`, `good`, `fair`, `poor`, `under_maintenance`, `retired` |
| `is_available` | BOOLEAN | Computed: TRUE if no active booking owns this unit |
| `purchase_date` | DATE | When the business acquired this unit |
| `purchase_price` | NUMERIC | Original cost (for depreciation tracking) |
| `current_value` | NUMERIC | Current estimated market value |
| `location` | TEXT | Where this unit is stored when not out on rental |
| `notes` | TEXT | Internal notes |
| `total_rentals` | INTEGER | Denormalized count of completed rentals |
| `is_deleted` | BOOLEAN | Soft delete |
| `deleted_at` | TIMESTAMPTZ | |
| `deleted_by` | UUID | |
| `deletion_reason` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### 6.4 `inventory_components` Table — New

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `unit_id` | UUID | FK → `inventory_units.id`. Which unit this component belongs to. |
| `component_type` | TEXT | Enum: `main_unit`, `speaker`, `microphone`, `remote`, `power_cable`, `extension_cord`, `hdmi_cable`, `stand`, `carry_bag`, `tablet`, `accessory` |
| `component_name` | TEXT | Human label: "Wireless Microphone A", "Main Karaoke Unit" |
| `serial_number` | TEXT | Optional serial number for trackable components |
| `brand` | TEXT | Manufacturer brand |
| `model` | TEXT | Model number |
| `condition` | TEXT | Enum: `excellent`, `good`, `fair`, `poor`, `broken`, `missing`, `retired` |
| `is_active` | BOOLEAN | FALSE if component has been removed from service |
| `purchase_date` | DATE | |
| `purchase_price` | NUMERIC | |
| `is_deleted` | BOOLEAN | |
| `deleted_at` | TIMESTAMPTZ | |
| `deleted_by` | UUID | |
| `notes` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### 6.5 `condition_checks` Table — New

Records the pre-delivery and post-pickup condition of every component per booking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `booking_id` | UUID | FK → `bookings.id` |
| `component_id` | UUID | FK → `inventory_components.id` |
| `check_type` | TEXT | Enum: `pre_delivery`, `post_pickup` |
| `condition_before` | TEXT | Condition at time of check |
| `condition_after` | TEXT | Condition discovered (post-pickup only) |
| `is_damaged` | BOOLEAN | Was damage found? |
| `is_missing` | BOOLEAN | Was the component missing on return? |
| `damage_description` | TEXT | Describe the damage |
| `photo_urls` | TEXT[] | Array of storage paths for condition photos |
| `checked_by` | UUID | FK → `profiles.id`. The staff member who did the check. |
| `checked_at` | TIMESTAMPTZ | |
| `notes` | TEXT | |

---

### 6.6 `maintenance_logs` Table — New

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `component_id` | UUID | FK → `inventory_components.id`. NULL if whole-unit maintenance. |
| `unit_id` | UUID | FK → `inventory_units.id` |
| `maintenance_type` | TEXT | Enum: `repair`, `cleaning`, `inspection`, `calibration`, `replacement` |
| `description` | TEXT | What was done |
| `cost` | NUMERIC | Maintenance cost (links to `expenses` table) |
| `expense_id` | UUID | FK → `expenses.id` |
| `performed_by` | TEXT | Technician name (may be external) |
| `performed_by_staff_id` | UUID | FK → `profiles.id`. If internal staff. |
| `scheduled_at` | TIMESTAMPTZ | When maintenance was/is scheduled |
| `completed_at` | TIMESTAMPTZ | When maintenance was completed |
| `unit_available_after` | TIMESTAMPTZ | When the unit will be available for rental again |
| `status` | TEXT | Enum: `scheduled`, `in_progress`, `completed`, `cancelled` |
| `created_at` | TIMESTAMPTZ | |

---

### 6.7 `replacement_records` Table — New

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `old_component_id` | UUID | FK → `inventory_components.id`. The component being replaced. |
| `new_component_id` | UUID | FK → `inventory_components.id`. The replacement component. |
| `unit_id` | UUID | FK → `inventory_units.id` |
| `reason` | TEXT | Why it was replaced: `broken`, `lost`, `upgrade` |
| `replacement_cost` | NUMERIC | |
| `expense_id` | UUID | FK → `expenses.id` |
| `replaced_by` | UUID | FK → `profiles.id` |
| `replaced_at` | TIMESTAMPTZ | |
| `notes` | TEXT | |

---

## 7. Package Design

### 7.1 Revised `packages` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Future SaaS |
| `name` | TEXT | Package display name: "KYU Pro Package" |
| `slug` | TEXT | URL-safe identifier: `kyu-pro-package` (unique) |
| `tagline` | TEXT | Short marketing hook: "Perfect for parties of 20–50 guests" |
| `description` | TEXT | Full marketing description (markdown supported) |
| `cover_photo_url` | TEXT | Main package photo (Supabase Storage path) |
| `base_price` | NUMERIC | Standard weekday price |
| `weekend_price` | NUMERIC | Price on Saturdays and Sundays |
| `holiday_price` | NUMERIC | Price on public holidays |
| `min_rental_hours` | INTEGER | Minimum hours per booking (e.g., 4) |
| `max_rental_hours` | INTEGER | Maximum hours per booking (e.g., 24) |
| `overtime_rate` | NUMERIC | Per-hour charge beyond max_rental_hours |
| `reservation_fee_pct` | NUMERIC | Override global reservation %. NULL = use global setting. |
| `damage_deposit` | NUMERIC | Refundable deposit collected on delivery. 0 = no deposit. |
| `delivery_fee` | NUMERIC | Base delivery fee. May be overridden by zone. |
| `free_delivery_min_hours` | INTEGER | Free delivery if booking is >= this many hours |
| `delivery_coverage_notes` | TEXT | Description of where this package can be delivered |
| `max_pax` | INTEGER | Suggested maximum number of guests |
| `is_active` | BOOLEAN | Only active packages are bookable |
| `is_featured` | BOOLEAN | Show in "Featured Packages" section on landing page |
| `is_deleted` | BOOLEAN | Soft delete |
| `deleted_at` | TIMESTAMPTZ | |
| `deleted_by` | UUID | |
| `sort_order` | INTEGER | Admin-controlled display order |
| `meta_title` | TEXT | SEO title tag override |
| `meta_description` | TEXT | SEO meta description override |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### 7.2 `package_equipment_templates` Table — New

Defines the *expected* list of components for each package (the template). When a new inventory unit is created for a package, this template is used to auto-generate its component records.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `package_id` | UUID | FK → `packages.id` |
| `component_type` | TEXT | Type of component expected |
| `component_name` | TEXT | Display name: "Wireless Microphone" |
| `quantity` | INTEGER | How many of this component per unit |
| `is_required` | BOOLEAN | If FALSE, component is optional (nice-to-have) |
| `sort_order` | INTEGER | Display order in package inclusions list |

---

### 7.3 `package_pricing_rules` Table — New

Support dynamic pricing overrides beyond the base/weekend/holiday structure.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `package_id` | UUID | FK → `packages.id` |
| `rule_type` | TEXT | Enum: `date_range`, `day_of_week`, `holiday`, `season` |
| `applies_to` | JSONB | Rule definition: `{ "dates": ["2026-12-24", "2026-12-31"] }` or `{ "days": [0, 6] }` |
| `price_override` | NUMERIC | Use this price instead of base_price |
| `surcharge_pct` | NUMERIC | OR add this % on top of base_price |
| `label` | TEXT | "Christmas Eve Pricing", "Holiday Rate" |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

---

## 8. Expense Module

### 8.1 Why Expenses Are Essential

Without expense tracking, the admin dashboard can show revenue but not **profit**. A booking that generates ₱5,000 in revenue while consuming ₱2,000 in fuel, ₱500 in microphone replacement, and ₱800 in driver wages is a ₱1,700 profit — not a ₱5,000 win. Expense tracking transforms the system from a booking tool into a business intelligence platform.

---

### 8.2 `expense_categories` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Future SaaS |
| `name` | TEXT | e.g., "Fuel", "Equipment Repair" |
| `code` | TEXT | Short code for programmatic reference: `FUEL`, `REPAIR` |
| `parent_id` | UUID | FK → self. Supports nested categories. |
| `is_active` | BOOLEAN | |
| `sort_order` | INTEGER | |

**Default Categories:**

| Code | Name | Sub-Categories |
|------|------|----------------|
| `DELIVERY` | Delivery & Logistics | Fuel, Toll Fees, Driver Allowance |
| `REPAIR` | Repairs & Maintenance | Equipment Repair, Cleaning, Calibration |
| `REPLACEMENT` | Replacements | Microphone, Cable, Remote, Speaker Part |
| `MARKETING` | Marketing & Advertising | Social Media Ads, Print Materials, Promotions |
| `UTILITIES` | Utilities | Electricity, Internet, Water |
| `PAYROLL` | Salaries & Wages | Staff Salary, Driver Commission |
| `OFFICE` | Office & Admin | Supplies, Software Subscriptions |
| `MISC` | Miscellaneous | Uncategorized expenses |

---

### 8.3 `expenses` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Future SaaS |
| `category_id` | UUID | FK → `expense_categories.id` |
| `booking_id` | UUID | FK → `bookings.id`. NULL if not tied to a specific booking. |
| `unit_id` | UUID | FK → `inventory_units.id`. NULL if not tied to a unit. |
| `component_id` | UUID | FK → `inventory_components.id`. NULL if not component-specific. |
| `title` | TEXT | Brief description: "Fuel for KYU-UNIT-003 delivery to Quezon City" |
| `description` | TEXT | Detailed notes |
| `amount` | NUMERIC | Expense amount in local currency |
| `expense_date` | DATE | The date the expense was incurred |
| `payment_method` | TEXT | Enum: `cash`, `card`, `gcash`, `bank_transfer` |
| `paid_by` | UUID | FK → `profiles.id`. Which staff member incurred/paid this. |
| `approved_by` | UUID | FK → `profiles.id`. Admin who approved this expense. |
| `status` | TEXT | Enum: `draft`, `pending_approval`, `approved`, `voided` |
| `receipt_url` | TEXT | Supabase Storage path to receipt photo/PDF |
| `reference_number` | TEXT | External reference (receipt number, invoice number) |
| `is_recurring` | BOOLEAN | Is this a recurring monthly expense? |
| `recurrence_rule` | JSONB | `{ "frequency": "monthly", "day": 25 }` |
| `is_deleted` | BOOLEAN | Soft delete (voided expenses, not hard deleted) |
| `deleted_at` | TIMESTAMPTZ | |
| `deleted_by` | UUID | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### 8.4 Connection to Financial Reporting

The `expenses` table connects directly to:
- **Profit calculation:** `Net Profit = Total Revenue − Total Expenses` per period
- **Per-booking profitability:** Filter by `booking_id` to compute delivery cost, driver cost, and equipment cost per booking
- **Category breakdowns:** Sum expenses by `category_id` to identify where money is going
- **Driver efficiency:** Filter by `paid_by + category = FUEL` to calculate cost per driver per delivery

---

## 9. Dashboard Analytics

### 9.1 Metric Definitions and Business Value

**Revenue Metrics**

| Metric | Formula | Business Value |
|--------|---------|----------------|
| Today's Revenue | SUM(payments.amount) WHERE DATE(paid_at) = TODAY | Instant daily pulse check |
| This Month's Revenue | SUM(payments.amount) WHERE month = current month | Monthly target tracking |
| Revenue Trend | Monthly revenue for last 12 months | Identify growth or decline |
| Revenue by Package | SUM(revenue) GROUP BY package_id | Know which packages drive income |
| Revenue by Zone | SUM(revenue) GROUP BY delivery_zone | Identify highest-value areas |

**Booking Metrics**

| Metric | Formula | Business Value |
|--------|---------|----------------|
| Bookings Today | COUNT(bookings) WHERE event_date = TODAY | Daily workload at a glance |
| Bookings This Month | COUNT(bookings) WHERE month = current | Volume tracking |
| Pending Confirmations | COUNT(bookings) WHERE status = PENDING_CONFIRMATION | How many need admin action now |
| Average Booking Value | SUM(revenue) / COUNT(bookings) | Understand deal size over time |
| Cancellation Rate | Cancelled / Total bookings × 100 | Product/service health indicator |
| Booking Conversion Rate | Bookings completed / Bookings started × 100 | Funnel health — how many who start actually pay |

**Operational Metrics**

| Metric | Formula | Business Value |
|--------|---------|----------------|
| Today's Deliveries | COUNT(assignments) WHERE type=delivery AND DATE=today | Driver workload planning |
| Today's Pickups | COUNT(assignments) WHERE type=pickup AND DATE=today | Driver workload planning |
| Active Rentals Right Now | COUNT(bookings) WHERE status=RENTAL_ACTIVE | Live inventory awareness |
| Equipment Occupancy Rate | Active units / Total units × 100 | Are we fully utilizing inventory? |
| Package Utilization | Bookings per package / Available days × 100 | Which packages are most in-demand |

**Customer Metrics**

| Metric | Formula | Business Value |
|--------|---------|----------------|
| New Customers (Month) | COUNT(profiles) WHERE created_at in month | Acquisition rate |
| Returning Customers | COUNT(customers with > 1 completed booking) | Loyalty indicator |
| Customer Lifetime Value | AVG(SUM(revenue) per customer) | Justify customer acquisition costs |
| Top Customers by Revenue | SUM(revenue) GROUP BY customer_id | Identify VIP customers for personalized care |
| Peak Booking Days | booking_count GROUP BY day_of_week | Know your busiest days |
| Peak Booking Hours | booking_count GROUP BY hour_of_day | Know when customers book |

**Financial Health**

| Metric | Formula | Business Value |
|--------|---------|----------------|
| Outstanding Balances | SUM(bookings.balance_due) WHERE balance_due > 0 | Cash flow risk exposure |
| Pending Payments | COUNT(bookings) WHERE paid_amount < total_amount | Receivables tracking |
| Net Profit (Month) | Monthly Revenue − Monthly Expenses | True business health |
| Expense Breakdown | SUM(expenses) GROUP BY category | Where money is being spent |
| Cost per Booking | Total Expenses / Total Bookings | Efficiency benchmark |

---

### 9.2 `analytics_snapshots` Table — New

Pre-aggregated daily snapshots for fast dashboard loading. Recomputed nightly by a cron Edge Function. This avoids expensive real-time aggregation queries on large datasets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Future SaaS |
| `snapshot_date` | DATE | The date this snapshot represents (UNIQUE per tenant) |
| `total_revenue` | NUMERIC | Total payments received on this date |
| `total_expenses` | NUMERIC | Total expenses logged on this date |
| `net_profit` | NUMERIC | Revenue − Expenses |
| `total_bookings` | INTEGER | Bookings created on this date |
| `completed_bookings` | INTEGER | Bookings completed on this date |
| `cancelled_bookings` | INTEGER | Bookings cancelled on this date |
| `new_customers` | INTEGER | New customer registrations on this date |
| `active_rentals_eod` | INTEGER | Active rentals at end of day |
| `equipment_occupancy_rate` | NUMERIC | % of inventory in use |
| `avg_booking_value` | NUMERIC | Average booking value on this date |
| `metadata` | JSONB | Extended metrics stored as JSON for flexibility |
| `computed_at` | TIMESTAMPTZ | When this snapshot was last computed |

---

## 10. Driver & Delivery Module

### 10.1 Design Philosophy

The delivery module must work in two modes:
1. **MVP mode:** Admin assigns staff manually. Staff views their schedule in a web browser. No mobile app.
2. **Future mode:** Dedicated mobile app with real-time GPS tracking, digital signatures, and route optimization.

The data model must support both without a rebuild. Design for Mode 2, deliver Mode 1 first.

---

### 10.2 `drivers` Table — New

Extends staff profiles with driver-specific data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `profile_id` | UUID | FK → `profiles.id` (1:1 with a staff user) |
| `license_number` | TEXT | Driver's license number |
| `license_expiry` | DATE | License expiration date |
| `vehicle_type` | TEXT | Enum: `motorcycle`, `tricycle`, `van`, `truck` |
| `vehicle_plate` | TEXT | Vehicle plate number |
| `vehicle_model` | TEXT | e.g., "Toyota Hi-Ace" |
| `max_units_per_trip` | INTEGER | How many rental sets this driver can carry |
| `is_available` | BOOLEAN | Current availability status |
| `is_active` | BOOLEAN | Is this driver currently employed |
| `created_at` | TIMESTAMPTZ | |

---

### 10.3 `delivery_assignments` Table — Revised

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `booking_id` | UUID | FK → `bookings.id` |
| `driver_id` | UUID | FK → `drivers.id` |
| `unit_id` | UUID | FK → `inventory_units.id` |
| `assignment_type` | TEXT | Enum: `delivery`, `pickup` |
| `scheduled_date` | DATE | Planned date |
| `scheduled_time_start` | TIME | Scheduled departure time |
| `scheduled_time_end` | TIME | Expected completion time |
| `actual_departed_at` | TIMESTAMPTZ | When driver actually left |
| `actual_arrived_at` | TIMESTAMPTZ | When driver arrived at customer |
| `actual_completed_at` | TIMESTAMPTZ | When delivery/pickup was completed |
| `status` | TEXT | Enum: `assigned`, `accepted`, `departed`, `arrived`, `completed`, `failed` |
| `estimated_duration_mins` | INTEGER | Estimated trip duration in minutes |
| `distance_km` | NUMERIC | Estimated distance to delivery address |
| `route_notes` | TEXT | Special directions or landmarks |
| `delivery_address` | TEXT | Denormalized delivery address (snapshot at time of assignment) |
| `gps_start_lat` | NUMERIC | Driver's GPS at departure (future) |
| `gps_start_lng` | NUMERIC | Driver's GPS at departure (future) |
| `gps_end_lat` | NUMERIC | Driver's GPS at arrival (future) |
| `gps_end_lng` | NUMERIC | Driver's GPS at arrival (future) |
| `assigned_by` | UUID | FK → `profiles.id`. Admin who made the assignment. |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

---

### 10.4 `delivery_checklists` Table — New

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `assignment_id` | UUID | FK → `delivery_assignments.id` |
| `component_id` | UUID | FK → `inventory_components.id` |
| `is_loaded` | BOOLEAN | Driver confirmed item loaded on vehicle |
| `is_delivered` | BOOLEAN | Item confirmed delivered to customer |
| `is_returned` | BOOLEAN | Item confirmed returned on pickup |
| `condition_on_delivery` | TEXT | Condition when delivered |
| `condition_on_return` | TEXT | Condition when returned |
| `notes` | TEXT | Any notes about this item |

---

### 10.5 `proof_of_delivery` Table — New

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `assignment_id` | UUID | FK → `delivery_assignments.id` |
| `booking_id` | UUID | FK → `bookings.id` |
| `proof_type` | TEXT | Enum: `signature`, `photo`, `otp_confirmation` |
| `signature_data_url` | TEXT | Base64 encoded SVG/PNG of customer signature |
| `photo_urls` | TEXT[] | Array of photo storage paths |
| `received_by_name` | TEXT | Name of person who received/returned the unit |
| `received_by_phone` | TEXT | Phone number of receiver |
| `otp_code` | TEXT | OTP sent to customer for contactless confirmation (future) |
| `otp_verified_at` | TIMESTAMPTZ | When OTP was confirmed |
| `collected_at` | TIMESTAMPTZ | Timestamp of collection/delivery |
| `notes` | TEXT | |

---

### 10.6 `incident_reports` Table — New

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `assignment_id` | UUID | FK → `delivery_assignments.id` |
| `booking_id` | UUID | FK → `bookings.id` |
| `reported_by` | UUID | FK → `profiles.id` |
| `incident_type` | TEXT | Enum: `damage`, `lost_item`, `customer_dispute`, `accident`, `no_show`, `other` |
| `description` | TEXT | Detailed incident description |
| `photo_urls` | TEXT[] | Evidence photos |
| `estimated_cost` | NUMERIC | Estimated cost of damage or loss |
| `status` | TEXT | Enum: `open`, `under_review`, `resolved`, `escalated` |
| `resolution_notes` | TEXT | How it was resolved |
| `resolved_by` | UUID | FK → `profiles.id` |
| `resolved_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

---

## 11. Financial Reporting Architecture

### 11.1 Gaps in Phase 0 Financial Design

The Phase 0 blueprint had no dedicated financial reporting layer. The following additional tables and relationships are required:

---

### 11.2 `revenue_records` Table — New

A denormalized, append-only record of every revenue event. This is NOT a replacement for `payments` — it is a financial ledger layer that aggregates and categorizes revenue for reporting.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Future SaaS |
| `booking_id` | UUID | FK → `bookings.id` |
| `payment_id` | UUID | FK → `payments.id` |
| `revenue_type` | TEXT | Enum: `rental_fee`, `delivery_fee`, `overtime_fee`, `damage_fee`, `late_fee`, `deposit_forfeited` |
| `amount` | NUMERIC | The revenue amount |
| `tax_amount` | NUMERIC | Tax portion of this revenue |
| `net_amount` | NUMERIC | Amount minus tax |
| `currency` | TEXT | `"PHP"` |
| `recognized_at` | DATE | The date revenue is recognized (booking event_date, not payment date) |
| `received_at` | TIMESTAMPTZ | When money was actually received |
| `created_at` | TIMESTAMPTZ | |

> [!NOTE]
> Revenue recognition: reservations paid in advance should recognize revenue on the **event date**, not the payment date. This matches standard accrual accounting. The `recognized_at` vs `received_at` columns enable both cash-basis and accrual-basis reporting.

---

### 11.3 `cash_flow_entries` Table — New

Records all money in and out of the business for cash flow analysis.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | |
| `entry_type` | TEXT | Enum: `inflow`, `outflow` |
| `category` | TEXT | Enum: `booking_payment`, `refund`, `expense`, `owner_withdrawal`, `investment` |
| `reference_id` | UUID | FK to the source: payment_id, expense_id, etc. |
| `reference_type` | TEXT | The table the reference_id points to |
| `amount` | NUMERIC | Absolute amount (always positive) |
| `currency` | TEXT | |
| `entry_date` | DATE | Date of this cash movement |
| `description` | TEXT | Human-readable description |
| `created_at` | TIMESTAMPTZ | |

---

### 11.4 Financial Reports Supported

| Report | Data Sources |
|--------|-------------|
| Revenue Report | `revenue_records` grouped by date/package/zone |
| Expense Report | `expenses` grouped by date/category |
| Profit & Loss | `revenue_records` − `expenses` per period |
| Cash Flow Statement | `cash_flow_entries` grouped by type and date |
| Outstanding Balances | `bookings WHERE balance_due > 0` |
| Per-Booking P&L | Revenue for booking − expenses linked to that booking |
| Driver Cost Analysis | `expenses WHERE category=FUEL/DRIVER` per driver |
| Refund Analysis | `refunds` grouped by reason and period |
| Monthly Comparison | `analytics_snapshots` comparing current vs prior months |
| Annual Summary | `analytics_snapshots` rolled up by year |

---

## 12. Future SaaS Readiness

### 12.1 Prepare Now, Implement Later

The core principle: **add `tenant_id` columns everywhere today, enforce them later.** A column added now costs almost nothing. A column added after 10,000 records exist requires a complex, risky data migration.

For the MVP of KYU Rentals (single business), `tenant_id` will always equal the same single UUID. All queries will include `WHERE tenant_id = :kyu_tenant_id`. When the SaaS pivot happens, the column is already there and indexes already exist.

---

### 12.2 `tenants` Table — New

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Business name |
| `slug` | TEXT | URL slug: `kyu-rentals`, `star-karaoke-ph` |
| `plan_id` | UUID | FK → `subscription_plans.id` |
| `status` | TEXT | Enum: `trial`, `active`, `suspended`, `cancelled` |
| `trial_ends_at` | TIMESTAMPTZ | When free trial expires |
| `owner_id` | UUID | FK → `profiles.id`. Primary admin. |
| `billing_email` | TEXT | Email for subscription invoices |
| `custom_domain` | TEXT | `karaoke.customerdomain.com` (future white-label) |
| `is_custom_domain_verified` | BOOLEAN | DNS verification status |
| `created_at` | TIMESTAMPTZ | |
| `metadata` | JSONB | Flexible tenant config |

---

### 12.3 `subscription_plans` Table — New

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | "Starter", "Growth", "Enterprise" |
| `slug` | TEXT | `starter`, `growth`, `enterprise` |
| `price_monthly` | NUMERIC | Monthly subscription price |
| `price_annual` | NUMERIC | Annual subscription price (discounted) |
| `max_inventory_units` | INTEGER | Maximum rental units allowed (-1 = unlimited) |
| `max_staff_accounts` | INTEGER | Maximum staff accounts (-1 = unlimited) |
| `max_bookings_per_month` | INTEGER | Booking volume limit (-1 = unlimited) |
| `max_branches` | INTEGER | Number of branches/locations allowed |
| `features` | JSONB | Feature flags for this plan |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

---

### 12.4 `feature_flags` Table — New

Controls which features are enabled per tenant or per plan. This is the engine that powers SaaS tiers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `key` | TEXT | Unique feature identifier: `delivery_module`, `advanced_analytics`, `sms_notifications` |
| `label` | TEXT | Human-readable name |
| `description` | TEXT | What this feature does |
| `default_enabled` | BOOLEAN | Enabled by default for new tenants? |
| `plan_required` | TEXT | Minimum plan slug to access: `growth` |

**`tenant_feature_overrides` Table** — Per-tenant overrides of feature flags

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | |
| `tenant_id` | UUID | FK → `tenants.id` |
| `feature_flag_id` | UUID | FK → `feature_flags.id` |
| `is_enabled` | BOOLEAN | Override: enable or disable for this specific tenant |
| `reason` | TEXT | Why this override was applied |
| `overridden_by` | UUID | Super admin who applied this |
| `created_at` | TIMESTAMPTZ | |

---

### 12.5 `branches` Table — New (Multi-Branch Support)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK → `tenants.id` |
| `name` | TEXT | "Makati Branch", "QC Branch" |
| `address` | TEXT | Physical location |
| `phone` | TEXT | Branch contact number |
| `email` | TEXT | Branch email |
| `is_main_branch` | BOOLEAN | Only one branch per tenant can be main |
| `is_active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

All operational tables (`inventory_units`, `packages`, `bookings`, `staff`, `delivery_zones`) gain a `branch_id` FK for multi-branch isolation.

---

### 12.6 `tenant_billing` Table — New

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | FK → `tenants.id` |
| `period_start` | DATE | Billing period start |
| `period_end` | DATE | Billing period end |
| `plan_id` | UUID | FK → `subscription_plans.id` |
| `amount_due` | NUMERIC | Total billed |
| `amount_paid` | NUMERIC | Amount paid |
| `status` | TEXT | Enum: `pending`, `paid`, `overdue`, `waived` |
| `invoice_url` | TEXT | Link to invoice PDF |
| `stripe_invoice_id` | TEXT | Stripe invoice reference |
| `paid_at` | TIMESTAMPTZ | |
| `due_at` | TIMESTAMPTZ | |
| `created_at` | TIMESTAMPTZ | |

---

### 12.7 What Must Be Prepared Now (Not Built, But Prepared)

| Preparation | Why Now |
|-------------|---------|
| Add `tenant_id` column to ALL tables | Migration later is painful and risky |
| Use UUID primary keys everywhere | No sequential ID conflicts across tenants |
| Seed `tenants` table with one record (KYU Rentals) | The app works with a single tenant from Day 1 |
| RLS policies reference `tenant_id` | Security model is multi-tenant from the start |
| `settings` table is already per-tenant via `tenant_id` | Per-tenant config works without a redesign |
| Keep business logic in `src/lib/` not hardcoded in routes | Business logic is reusable across tenants |
| Domain routing via middleware already abstracted | Adding custom domains later requires only middleware changes |

---

## 13. Risk Assessment

### Risk 1: Database Performance Under Load

**Risk Level:** 🟡 Medium
**Description:** The `bookings` table will become the most-queried table in the system. As the business grows, queries joining `bookings` → `payments` → `booking_timeline_events` → `delivery_assignments` will slow down.

**Mitigation:**
- Add composite indexes from Day 1 on `(status, event_date)`, `(customer_id, created_at)`, `(tenant_id, status)`
- Use the `analytics_snapshots` table for dashboard aggregations — never run `COUNT(*)`/`SUM()` on raw tables for the main dashboard
- Implement Supabase read replicas when monthly bookings exceed 500
- Avoid `SELECT *` — always specify columns to minimize data transfer

---

### Risk 2: Payment Webhook Reliability

**Risk Level:** 🔴 Critical
**Description:** PayMongo sends payment webhooks that update booking status and trigger confirmations. If a webhook fails, is duplicated, or arrives out of order, the booking status becomes inconsistent.

**Mitigation:**
- Verify HMAC signature on every webhook before processing
- Implement idempotency: check `WHERE gateway_payment_id = :id` before inserting a payment record — if it exists, do nothing
- Store the raw webhook payload in `payments.gateway_response` for debugging
- Build a `/admin/tools/reconcile-payments` admin tool that cross-checks PayMongo's payment list against the database
- Log every webhook received and its processing result in `audit_logs`

---

### Risk 3: Availability Race Conditions

**Risk Level:** 🔴 Critical
**Description:** Two customers booking the same unit at exactly the same time (race condition) could result in a double-booking. This is a fundamental concurrency problem.

**Mitigation:**
- Use PostgreSQL **SELECT FOR UPDATE** or **advisory locks** when checking and creating availability
- The booking creation must happen inside a single database transaction: check availability → lock unit → create booking → create availability block
- Add a `UNIQUE` constraint on `unit_availability (unit_id, blocked_from, blocked_until)` to catch any duplicates at the database level
- Admin sees conflicts in real time and can manually resolve
- If a double-booking is somehow created, an automated alert fires to the admin immediately

---

### Risk 4: Notification Delivery Failures Going Undetected

**Risk Level:** 🟡 Medium
**Description:** If an SMS or email fails silently, the customer misses a critical communication (delivery time, confirmation). Currently there's no visibility into failed notifications.

**Mitigation:**
- The notification queue system (Section 4) addresses this by making failures visible
- Admin dashboard has a "Notification Health" widget showing failed notification count
- Critical notifications (booking confirmed, payment received) are sent via BOTH email AND SMS for redundancy
- Admin receives an alert when a notification exceeds max retries

---

### Risk 5: Supabase Vendor Lock-In

**Risk Level:** 🟡 Medium
**Description:** The architecture is heavily dependent on Supabase for database, auth, storage, and Edge Functions. If Supabase pricing changes, has downtime, or is discontinued, migrating is painful.

**Mitigation:**
- All database access goes through `src/queries/*.ts` — the database client is never called directly in components. Swapping the client requires changing only these files.
- Auth tokens follow the JWT standard — migrating to another JWT-based auth system (Auth.js, Clerk) is possible with middleware changes only.
- Supabase Storage is S3-compatible — file references in the database use paths, not full URLs. Switching to Cloudflare R2 or AWS S3 requires only changing the storage client configuration.
- Edge Functions can be migrated to Vercel Edge Functions or Trigger.dev with minimal changes.
- **Accept the dependency** for MVP. Supabase is a best-in-class choice at this scale. Revisit at 10x growth.

---

### Risk 6: Soft Delete Queries Missing the Filter

**Risk Level:** 🟡 Medium
**Description:** A developer forgets to add `WHERE is_deleted = FALSE` to a query. Deleted records appear in production.

**Mitigation:**
- Create Supabase **Views** (e.g., `active_packages`, `active_inventory_units`) that automatically include the `is_deleted = FALSE` filter. Application code queries views by default, not raw tables.
- Code review checklist: any query against a soft-delete-enabled table must include the filter.
- Write integration tests that verify deleted records don't appear in list queries.

---

### Risk 7: Settings Module Becomes a Dumping Ground

**Risk Level:** 🟢 Low
**Description:** The global settings module can grow into an unmaintainable list of hundreds of keys with no organization.

**Mitigation:**
- Namespacing (`business.*`, `pricing.*`, `policy.*`) enforced from Day 1
- Every setting requires a `label`, `description`, and `data_type` — no undocumented keys allowed
- Admin UI groups settings by namespace with clear section headings
- A `settings_registry.ts` config file in source code documents the full list of expected settings and their default values. This file is the source of truth, not the database.

---

### Risk 8: Growing Audit Log Table Size

**Risk Level:** 🟢 Low (now), 🟡 Medium (at scale)
**Description:** Every action writes to `audit_logs`. At 100 bookings/month × 15 events/booking = 1,500 audit records/month. At 1,000 bookings/month, that's 15,000 rows/month. After 2 years, 360,000 rows — manageable but growing.

**Mitigation:**
- Retention policy (Section 2.5) archives old `info` logs after 12 months
- Partial indexes on `category` and `severity` keep query performance high
- PostgreSQL handles tens of millions of rows efficiently with proper indexes
- Monitor table size quarterly. Partition by month if it exceeds 10M rows.

---

### Risk 9: No Defined Error Handling Strategy

**Risk Level:** 🟡 Medium
**Description:** Without a defined error handling approach, developers will use inconsistent patterns (try/catch here, .catch() there, silent failures elsewhere).

**Mitigation:**
- Define a standard `Result<T, E>` type used by all Server Actions — never `throw` from a Server Action; return `{ success: false, error: "..." }` instead
- All Route Handlers return standard JSON error shapes: `{ success: false, code: "BOOKING_001", message: "...", details: {} }`
- Error codes are documented in `src/config/error-codes.ts`
- Sentry captures all unhandled errors with full context
- Client components use TanStack Query's `onError` callbacks — no unhandled promise rejections

---

### Risk 10: No API Versioning Strategy

**Risk Level:** 🟢 Low (now), 🔴 Critical (at SaaS scale)
**Description:** When a mobile app or third-party integration depends on the API, breaking changes become catastrophic.

**Mitigation:**
- Even for internal APIs, prefix routes with `/api/v1/...` from Day 1
- Adding `v2` routes later is non-breaking — old routes continue to work
- Document all API contracts in `docs/api.md` before building integrations

---

## 14. Final Architecture Review

### 14.1 Would You Still Choose the Same Architecture?

**Yes, with the refinements in this document applied.**

Next.js App Router + Supabase is the right foundation for this product at this scale. It reduces infrastructure complexity by approximately 70% compared to a separate Node.js backend + managed PostgreSQL setup, while providing everything needed: auth, database, storage, realtime, and serverless functions. The developer experience is excellent, the ecosystem is mature, and the path to scale is clear.

The additions in this Phase 0.5 document — the notification queue, component-based inventory, booking state machine, audit logging system, and settings module — transform it from a "good MVP architecture" into a production-grade system.

---

### 14.2 If Given Unlimited Time, What Would Be Redesigned?

| Redesign | Rationale |
|----------|-----------|
| **Separate the admin panel as a distinct Next.js app** | Full separation of concerns. Admin can be deployed independently. Different security posture. At current scale, the monorepo approach is correct — revisit at SaaS scale. |
| **Replace Supabase Edge Functions with Trigger.dev** | Trigger.dev provides a far superior developer experience for complex background job workflows (retries, observability, scheduling). Supabase Edge Functions are adequate but limited. |
| **Add a Redis caching layer from Day 1** | Upstash Redis for caching availability queries, settings, and popular package listings. Currently left as a future optimization, but it would make the system noticeably faster from launch. |
| **Use PostgreSQL event sourcing for bookings** | Instead of a status column + timeline table, a pure event-sourced booking model stores only events and derives current state. More complex to implement but provides perfect audit history with zero possibility of state corruption. Worth considering for the SaaS version. |

---

### 14.3 What Decisions Are Irreversible Once Coding Begins?

> [!CAUTION]
> These decisions become very expensive to change after the database has real data in it.

| Decision | Why It's Hard to Change Later |
|----------|------------------------------|
| **UUID vs. sequential integer PKs** | Changing PK type requires rewriting every FK in every table and every JOIN in every query. **Use UUIDs. Lock this in now.** |
| **`tenant_id` on all tables** | Adding a new column to tables with millions of rows requires a careful migration. Missing tenant_id from even one table breaks multi-tenancy isolation. **Add it to every table now.** |
| **Soft delete columns** | Changing hard-delete behavior after the fact means some records are already gone. The data loss is permanent. **Add soft delete columns before writing a single INSERT.** |
| **Booking state machine** | Adding or removing valid state transitions after bookings exist in various states requires a data migration to correct existing records. Design the full state machine now. |
| **Notification queue vs. direct sending** | Migrating from direct sends to a queue after 10,000 notifications have been sent directly requires finding all the notification-sending code and refactoring it. Start with the queue. |
| **`created_at` / `updated_at` on all tables** | These should be present on every table. Retrofitting them means you've lost creation/modification timestamps for existing records. |

---

### 14.4 What Is the Biggest Weakness of the Current Blueprint?

The biggest weakness of the Phase 0 blueprint was its **flat data model for inventory and bookings.** Treating a karaoke unit as an indivisible atom, and a booking status as a single mutable field, would have created painful limitations within the first few months of operation:

- No way to track which microphone is broken without a full support workflow
- No way to reconstruct the exact sequence of events for a disputed booking
- No protection against race conditions in availability checks
- No deferred notification system, meaning any third-party outage could fail a booking

This Phase 0.5 document resolves all of these.

The second-biggest weakness was the **absence of financial depth** — no expense tracking, no revenue recognition model, no cash flow visibility. A rental business without expense tracking cannot calculate its own profit margin.

---

### 14.5 What Improvements Must Be Made Before Phase 1 Begins?

> [!IMPORTANT]
> These are non-negotiable prerequisites before writing application code.

| Priority | Improvement | Reason |
|----------|------------|--------|
| 🔴 P0 | Add `tenant_id` to every table in the schema | Cannot be added cleanly later |
| 🔴 P0 | Add soft delete columns to all eligible tables | Cannot recover deleted data after the fact |
| 🔴 P0 | Implement the full booking state machine (16 states) | Status field design cannot change after bookings exist |
| 🔴 P0 | Design the notification queue table before any notifications are sent | Refactoring direct sends to a queue later is costly |
| 🟡 P1 | Add `booking_timeline_events` table and define valid transitions | Audit trail cannot be reconstructed from missing history |
| 🟡 P1 | Redesign inventory to use `inventory_components` | Retrofitting this after 50 bookings is painful |
| 🟡 P1 | Add `expenses` and `expense_categories` tables | Revenue without expenses is a misleading view of business health |
| 🟡 P1 | Finalize the settings registry | Prevents hardcoded values from entering the codebase |
| 🟢 P2 | Create `analytics_snapshots` table | Not urgent, but add to schema now so the nightly job has somewhere to write |
| 🟢 P2 | Add `revenue_records` and `cash_flow_entries` tables | Financial reporting foundation |

---

### 14.6 Architecture Scorecard

| Dimension | Phase 0 Score | Phase 0.5 Score | Notes |
|-----------|:------------:|:---------------:|-------|
| Data Integrity | 6/10 | 9/10 | Soft deletes, immutable audit logs, state machine |
| Scalability | 6/10 | 8/10 | `tenant_id` everywhere, snapshots, queue |
| Operational Safety | 5/10 | 9/10 | Race condition mitigation, webhook idempotency |
| Developer Experience | 8/10 | 8/10 | No change — already strong |
| Financial Visibility | 3/10 | 8/10 | Expense module, revenue records, cash flow |
| Notification Reliability | 3/10 | 9/10 | Full queue system with retry and logging |
| Inventory Depth | 4/10 | 9/10 | Component-based model, condition checks |
| SaaS Readiness | 5/10 | 8/10 | `tenant_id`, feature flags, subscription plans |
| Security | 7/10 | 9/10 | Audit log hardened, RLS strengthened |
| Maintainability | 7/10 | 9/10 | Settings module, standardized error handling |

---

### 14.7 Overall Architecture Rating

## **Phase 0 Blueprint: 6.2 / 10**
## **Phase 0.5 Refined Blueprint: 8.7 / 10**

**What it would take to reach 10/10 (true enterprise-grade SaaS):**

| Gap | What's Needed |
|-----|--------------|
| Event Sourcing | Replace status + timeline with a pure event-sourced booking model |
| CQRS | Separate read models (materialized views) from write models for complex reporting |
| Dedicated Message Broker | Replace the queue table with a real message broker (Redis Streams or SQS) for high-volume scenarios |
| Multi-Region Database | Supabase read replicas in multiple regions for global SaaS tenants |
| Zero-Trust Security Model | mTLS between services, secret scanning in CI/CD, automated vulnerability scanning |
| Load & Performance Testing | Documented benchmark tests run before every major release |
| Chaos Engineering | Deliberately test failure scenarios (webhook outage, DB slowdown) before they happen in production |

> [!NOTE]
> An 8.7/10 architecture is more than sufficient to build a successful, professional, scalable karaoke rental platform. The gap to 10/10 represents patterns used by companies processing millions of events per day. Build to 8.7 now. The path to 10/10 is clear and non-destructive when the time comes.

---

## Revised Complete Table List

Below is the final authoritative list of all database tables in the refined system:

| # | Table | Category | Soft Delete |
|---|-------|----------|-------------|
| 1 | `tenants` | SaaS | No |
| 2 | `subscription_plans` | SaaS | No |
| 3 | `tenant_billing` | SaaS | No |
| 4 | `feature_flags` | SaaS | No |
| 5 | `tenant_feature_overrides` | SaaS | No |
| 6 | `branches` | Operations | Yes |
| 7 | `profiles` | Users | Yes |
| 8 | `roles` | Users | No |
| 9 | `user_roles` | Users | No |
| 10 | `drivers` | Delivery | No |
| 11 | `packages` | Products | Yes |
| 12 | `package_photos` | Products | Yes |
| 13 | `package_equipment_templates` | Products | No |
| 14 | `package_pricing_rules` | Products | No |
| 15 | `inventory_units` | Inventory | Yes |
| 16 | `inventory_components` | Inventory | Yes |
| 17 | `unit_availability` | Inventory | No |
| 18 | `condition_checks` | Inventory | No |
| 19 | `maintenance_logs` | Inventory | No |
| 20 | `replacement_records` | Inventory | No |
| 21 | `delivery_zones` | Operations | Yes |
| 22 | `bookings` | Core | No |
| 23 | `booking_timeline_events` | Core | No |
| 24 | `payments` | Finance | No |
| 25 | `refunds` | Finance | No |
| 26 | `revenue_records` | Finance | No |
| 27 | `cash_flow_entries` | Finance | No |
| 28 | `expense_categories` | Finance | No |
| 29 | `expenses` | Finance | Yes |
| 30 | `promo_codes` | Marketing | Yes |
| 31 | `delivery_assignments` | Delivery | No |
| 32 | `delivery_checklists` | Delivery | No |
| 33 | `proof_of_delivery` | Delivery | No |
| 34 | `incident_reports` | Delivery | No |
| 35 | `reviews` | Customer | Yes |
| 36 | `notification_queue` | System | No |
| 37 | `notification_log` | System | No |
| 38 | `audit_logs` | System | No |
| 39 | `settings` | System | No |
| 40 | `settings_history` | System | No |
| 41 | `analytics_snapshots` | Analytics | No |

**Total: 41 tables** (up from 21 in Phase 0)

---

*Document version 1.0.0 — Phase 0.5 Architecture Review Complete*
*This document supersedes relevant sections of the Phase 0 Blueprint where conflicts exist.*
*Phase 1 development should begin only after this document is reviewed and approved.*
