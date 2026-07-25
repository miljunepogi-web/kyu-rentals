# KYU Rentals — Complete Technical Blueprint
### Phase 0: System Planning Document
**Prepared by:** Senior Software Architect / SaaS Engineer / UI-UX Designer / Database Engineer / Product Manager
**Date:** July 22, 2026
**Version:** 1.0.0

---

> [!IMPORTANT]
> This is a planning-only document. No source code, SQL migrations, UI components, or API routes are generated here. This blueprint is the single source of truth for all future development phases.

---

## Table of Contents

1. [Functional Requirements](#1-functional-requirements)
2. [User Roles](#2-user-roles)
3. [Complete User Flows](#3-complete-user-flows)
4. [System Architecture](#4-system-architecture)
5. [Tech Stack Recommendation](#5-tech-stack-recommendation)
6. [Database Planning](#6-database-planning)
7. [Folder Structure](#7-folder-structure)
8. [Feature Development Order](#8-feature-development-order)
9. [Security Planning](#9-security-planning)
10. [Scalability Planning](#10-scalability-planning)

---

## 1. Functional Requirements

### 1.1 Customer-Facing Features

| # | Feature | Description |
|---|---------|-------------|
| C-01 | Public Landing Page | Hero section, featured packages, testimonials, FAQs, contact info |
| C-02 | Package Catalog | Browse all karaoke packages with photos, specs, and pricing |
| C-03 | Package Detail Page | Full description, included equipment list, pricing tiers, availability calendar |
| C-04 | Availability Checker | Real-time date/time picker that reflects live inventory availability |
| C-05 | Booking Wizard | Step-by-step flow: date → package → location → contact info → payment |
| C-06 | Address / Delivery Zone Validation | Validate delivery address is within service area before booking proceeds |
| C-07 | Reservation Fee Payment | Pay a partial deposit to lock in the booking |
| C-08 | Full Payment Option | Pay 100% upfront at booking time |
| C-09 | Payment Confirmation Page | Summary of booking details with reference number |
| C-10 | Email Confirmation | Automated email sent immediately after booking with all details |
| C-11 | Customer Dashboard | View all bookings: upcoming, active, completed, cancelled |
| C-12 | Booking Detail View | See booking status, payment breakdown, delivery schedule, receipt |
| C-13 | Booking Cancellation Request | Customer can request cancellation with reason |
| C-14 | Rebooking / Rescheduling | Customer can request a new date (subject to admin approval) |
| C-15 | Review & Rating | After booking completes, customer can leave a star rating and comment |
| C-16 | Receipt Download | Download or print a PDF receipt for any paid booking |
| C-17 | Account Registration & Login | Email/password registration or social login (Google, Facebook) |
| C-18 | Profile Management | Update name, phone, address, profile photo |
| C-19 | Notification Preferences | Toggle SMS, email, and push notification preferences |
| C-20 | Real-time Booking Status | Live status updates: Pending → Confirmed → Out for Delivery → Active → Completed |

---

### 1.2 Admin-Facing Features

| # | Feature | Description |
|---|---------|-------------|
| A-01 | Admin Dashboard Home | KPI cards: total bookings, revenue, active rentals, pending approvals |
| A-02 | Booking Management | Full list of all bookings with filters by date, status, package, customer |
| A-03 | Booking Approval Workflow | Review pending bookings, confirm or reject with reason |
| A-04 | Booking Detail View | See full customer info, payment status, delivery notes, timeline |
| A-05 | Manual Booking Creation | Admin can create bookings on behalf of walk-in or phone-in customers |
| A-06 | Inventory Management | Add, edit, archive karaoke units with serial numbers and condition tracking |
| A-07 | Package Management | Create, edit, disable packages. Manage pricing, photos, descriptions |
| A-08 | Pricing & Promo Management | Set base prices, weekend/holiday surcharges, promo codes, discounts |
| A-09 | Delivery Scheduling | Assign delivery personnel and time slots to confirmed bookings |
| A-10 | Pickup Scheduling | Assign pickup personnel and time slots after rental period ends |
| A-11 | Staff Management | Create/edit/deactivate staff accounts. Assign roles and permissions |
| A-12 | Delivery Zone Configuration | Draw or define service area boundaries (polygon or radius-based) |
| A-13 | Payment Management | View payment records, mark cash payments, issue refunds |
| A-14 | Revenue Reports | Daily, weekly, monthly, and custom-range revenue reports with charts |
| A-15 | Booking Analytics | Booking trends, popular packages, peak dates, cancellation rates |
| A-16 | Customer Management | View all customers, booking history, total spent, flag/ban accounts |
| A-17 | Review Moderation | Approve, reject, or flag customer reviews before they appear publicly |
| A-18 | Notification Center | Send manual SMS/email notifications to specific customers |
| A-19 | Calendar View | Visual calendar showing all deliveries, pickups, and active rentals per day |
| A-20 | Audit Log | Track all admin actions: who changed what and when |
| A-21 | Settings Panel | Business info, social media links, operating hours, payment gateway config |

---

### 1.3 Future Features (Post-MVP)

| # | Feature | Description |
|---|---------|-------------|
| F-01 | SaaS Multi-Tenancy | Allow other karaoke rental businesses to sign up and use the platform |
| F-02 | Franchise / Branch Management | One parent account managing multiple branch locations |
| F-03 | Mobile App (React Native) | iOS and Android customer app with push notifications |
| F-04 | Delivery Personnel App | Mobile app for delivery staff with route navigation and checklist |
| F-05 | Live Chat Support | Embedded chat widget (Intercom or custom) |
| F-06 | Song Library Integration | Browse available karaoke songs by package |
| F-07 | Dynamic Pricing Engine | AI-based pricing based on demand, season, and day of week |
| F-08 | Loyalty / Points System | Customers earn points per booking, redeemable for discounts |
| F-09 | Affiliate / Referral Program | Customers earn credits for referring new customers |
| F-10 | Third-Party Marketplace Integration | List packages on Airbnb Experiences, Facebook Marketplace, etc. |
| F-11 | Equipment Maintenance Tracker | Log maintenance history, schedule servicing, track repairs |
| F-12 | Insurance / Damage Deposit Module | Collect and release damage deposits per rental |
| F-13 | AI Chatbot | Answer FAQs and assist in booking through conversational interface |
| F-14 | White-Label Mode | SaaS tenants can use their own domain and branding |

---

## 2. User Roles

### Role Overview Table

| Role | Access Level | Primary Responsibility |
|------|-------------|------------------------|
| **Guest** | Public only | Browse packages, check availability |
| **Customer** | Authenticated (customer portal) | Book rentals, manage own bookings, pay, leave reviews |
| **Delivery Staff** | Authenticated (limited staff portal) | View assigned deliveries and pickups, update delivery status |
| **Support Staff** | Authenticated (admin panel, limited) | Manage bookings, communicate with customers, no financial access |
| **Admin** | Full admin panel | Full control over all operations, inventory, staff, payments, settings |
| **Super Admin** | System-level | Manage admin accounts, view platform-wide analytics (for future SaaS) |

---

### Detailed Role Descriptions

#### Guest
A non-registered visitor. They can browse the website, view packages, check availability, and read testimonials. To make a booking, they must register or log in. Guests represent the primary acquisition funnel entry point.

#### Customer
A registered user who has created an account. Customers can complete the booking wizard, make payments, view their booking dashboard, request cancellations, reschedule bookings, and leave reviews. All their data is scoped to their own account — they cannot see other customers' data.

#### Delivery Staff
An employee responsible for physically delivering and picking up karaoke units. They log in to a simplified staff portal (or eventually a mobile app) to view their daily schedule, see delivery/pickup assignments, mark deliveries as completed, and record any equipment condition notes. They have **no access** to payments, customer financial data, or admin settings.

#### Support Staff
An internal team member who helps manage bookings and communicates with customers. They can view and update booking statuses, send notifications, and create manual bookings. They **cannot** access financial reports, change pricing, or manage other staff accounts.

#### Admin
The primary business operator. Admins have full access to the admin panel: inventory management, package and pricing configuration, delivery zone settings, staff account management, payment records, revenue reports, analytics, and system settings. All admin actions are logged in the audit trail.

#### Super Admin
A system-level role reserved for the platform owner (when the product evolves into a SaaS). Super Admins can manage multiple tenant (business) accounts, view cross-tenant analytics, configure platform-wide settings, and handle billing for SaaS subscriptions. This role is not visible to regular admin users.

---

## 3. Complete User Flows

### 3.1 Customer Booking Flow

```
[Guest visits website]
        │
        ▼
[Browse package catalog]
        │
        ▼
[Select a package → View detail page]
        │
        ▼
[Click "Book Now" → Date/Time picker appears]
        │
        ▼
[System checks availability for selected date + package]
        │
    ┌───┴───┐
Available?  Not Available
    │               │
    ▼               ▼
[Proceed]    [Show next available dates]
    │
    ▼
[Enter event address]
        │
        ▼
[System validates address is within delivery zone]
        │
    ┌───┴───┐
In Zone?   Out of Zone
    │               │
    ▼               ▼
[Proceed]    [Show "We don't deliver here yet" message]
    │
    ▼
[Enter contact details: name, phone, email]
        │
        ▼
[Review booking summary: package, date, price breakdown]
        │
        ▼
[Choose payment option: Reservation Fee or Full Payment]
        │
        ▼
[Enter payment details (card, GCash, Maya, PayMongo, etc.)]
        │
        ▼
[Payment processed successfully]
        │
        ▼
[Booking created with status: PENDING_CONFIRMATION]
        │
        ▼
[Customer receives email confirmation with booking reference]
        │
        ▼
[Customer can view booking in their dashboard]
```

---

### 3.2 Admin Booking Approval Flow

```
[New booking arrives → Admin receives notification (email + in-app)]
        │
        ▼
[Admin opens booking detail in admin panel]
        │
        ▼
[Review: customer info, date, address, package, payment status]
        │
    ┌───┴───────────┐
 Approve?          Reject?
    │                   │
    ▼                   ▼
[Admin clicks         [Admin enters rejection reason]
 "Confirm Booking"]           │
    │                   ▼
    ▼           [Booking status → REJECTED]
[Assign delivery             │
 staff + time slot]          ▼
    │           [Customer notified via email/SMS]
    ▼                   │
[Booking status →           ▼
 CONFIRMED]         [If payment was made →
    │                refund initiated]
    ▼
[Customer notified:
 "Your booking is confirmed!
  Delivery on [date] at [time]"]
```

---

### 3.3 Payment Process Flow

```
[Customer selects payment option]
        │
   ┌────┴────┐
Reservation  Full
   Fee       Payment
   │              │
   └──────┬───────┘
          ▼
[Payment gateway (PayMongo) processes transaction]
          │
     ┌────┴────┐
  Success     Failure
     │              │
     ▼              ▼
[Webhook received   [Customer shown error]
 from PayMongo]     [Prompted to retry or
     │               use different method]
     ▼
[Payment record created in DB]
     │
     ▼
[Booking status updated]
     │
     ▼
[Customer receives payment receipt via email]
     │
     ▼
[If reservation fee was paid →
 remaining balance recorded as BALANCE_DUE]
     │
     ▼
[Balance due collected on delivery day
 (cash or pre-payment)]
```

---

### 3.4 Delivery Process Flow

```
[Booking is CONFIRMED + delivery date approaches]
        │
        ▼
[Admin/Staff sees booking in Calendar View or Daily Schedule]
        │
        ▼
[Delivery staff assigned to booking]
        │
        ▼
[Delivery staff receives notification: booking details + address]
        │
        ▼
[On delivery day → staff marks "Out for Delivery"]
        │
        ▼
[Booking status → OUT_FOR_DELIVERY]
        │
        ▼
[Customer receives SMS/email: "Your karaoke is on the way!"]
        │
        ▼
[Staff arrives at location → delivers unit]
        │
        ▼
[Staff collects remaining balance (if applicable)]
        │
        ▼
[Staff records equipment condition (photos, notes)]
        │
        ▼
[Staff marks booking as "Delivered"]
        │
        ▼
[Booking status → ACTIVE]
        │
        ▼
[Customer receives "Enjoy your rental!" notification]
```

---

### 3.5 Pickup Process Flow

```
[Rental period ends (based on booking end date/time)]
        │
        ▼
[System or Admin triggers pickup scheduling]
        │
        ▼
[Pickup staff assigned (may be same as delivery)]
        │
        ▼
[Staff receives pickup notification with address]
        │
        ▼
[Staff marks "Out for Pickup"]
        │
        ▼
[Customer notified: "Our team is coming to pick up the unit"]
        │
        ▼
[Staff arrives, collects karaoke unit]
        │
        ▼
[Staff records return condition (photos, notes, damage if any)]
        │
        ▼
[If damage detected → Admin flagged for review]
        │
        ▼
[Staff marks "Pickup Complete"]
        │
        ▼
[Booking status → COMPLETED]
        │
        ▼
[Customer receives "Thank you" email + review invitation]
```

---

### 3.6 Booking Cancellation Flow

```
[Customer or Admin initiates cancellation]
        │
   ┌────┴────┐
Customer  Admin
initiates  initiates
   │              │
   ▼              ▼
[Customer opens  [Admin opens booking
 booking →        → clicks "Cancel"]
 clicks "Request
 Cancellation"]
   │              │
   └──────┬───────┘
          ▼
[Cancellation reason entered]
          │
          ▼
[System checks cancellation policy:
 - >72 hrs before: full refund eligible
 - 24–72 hrs: partial refund (50%)
 - <24 hrs: no refund]
          │
          ▼
[Admin reviews if customer-initiated]
          │
          ▼
[Cancellation approved]
          │
          ▼
[Booking status → CANCELLED]
          │
          ▼
[Refund processed (if applicable)]
          │
          ▼
[Customer notified via email with refund timeline]
          │
          ▼
[Inventory unit freed up for that date]
```

---

### 3.7 Booking Completion Flow

```
[Pickup marked as Complete by staff]
        │
        ▼
[Booking status → COMPLETED]
        │
        ▼
[Final payment status reconciled (if balance was owed)]
        │
        ▼
[Revenue recorded in analytics]
        │
        ▼
[24 hours later → automated review request email sent]
        │
        ▼
[Customer submits review (optional)]
        │
        ▼
[Review → PENDING_MODERATION]
        │
        ▼
[Admin approves → Review published publicly]
```

---

## 4. System Architecture

### 4.1 Architecture Overview

KYU Rentals follows a **modern fullstack monorepo architecture** built on Next.js, with a clear separation of concerns between the customer-facing frontend, the admin dashboard, and the backend API layer. The system uses Supabase as its primary backend-as-a-service, handling the database, authentication, file storage, and realtime capabilities.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│   ┌─────────────────────┐        ┌──────────────────────────────┐  │
│   │  Customer Website   │        │       Admin Dashboard        │  │
│   │  (Next.js App       │        │  (Next.js App Router         │  │
│   │   Router - Public)  │        │   - Protected Routes)        │  │
│   └──────────┬──────────┘        └──────────────┬───────────────┘  │
└──────────────┼──────────────────────────────────┼───────────────────┘
               │                                  │
               ▼                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API LAYER (Next.js)                          │
│                                                                     │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────┐ │
│  │  Route Handlers│  │  Server Actions  │  │  Middleware (Auth,  │ │
│  │  /api/...      │  │  (form mutations)│  │  Rate Limiting)     │ │
│  └────────┬───────┘  └────────┬─────────┘  └──────────┬──────────┘ │
└───────────┼──────────────────┼───────────────────────┼─────────────┘
            │                  │                        │
            ▼                  ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       SUPABASE BACKEND                              │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  PostgreSQL  │  │    Auth      │  │  Storage (S3-compatible) │  │
│  │  Database    │  │  (JWT/OAuth) │  │  (Photos, Receipts, Docs)│  │
│  └──────┬───────┘  └──────┬───────┘  └──────────────────────────┘  │
│         │                 │                                         │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────────────────────────┐  │
│  │  Row Level   │  │  Realtime    │  │  Edge Functions          │  │
│  │  Security    │  │  (WebSockets)│  │  (Webhooks, Automations) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                               │
│                                                                     │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │
│  │  PayMongo  │  │  Resend      │  │  Twilio/     │  │  Vercel  │  │
│  │  (Payments)│  │  (Email)     │  │  Semaphore   │  │  (Host)  │  │
│  └────────────┘  └──────────────┘  │  (SMS)       │  └──────────┘  │
│                                    └──────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Frontend

**Technology:** Next.js 14+ (App Router)

The frontend is split into two logical sections within the same Next.js project:
- **`/` (Customer-facing):** Public website with landing page, package catalog, booking wizard, and customer portal.
- **`/admin` (Admin dashboard):** A fully protected route group accessible only to admin and staff roles.

Next.js Server Components are used by default for static and data-heavy views (package listings, availability calendar). Client Components (`"use client"`) are used only where interactivity is required (booking wizard steps, payment forms, real-time status updates).

Server Actions handle form mutations (booking submissions, profile updates) to eliminate the need for separate API endpoints for simple CRUD operations.

---

### 4.3 Backend

**Technology:** Next.js API Routes + Supabase

The backend logic is handled through a combination of:
1. **Next.js Route Handlers** (`/app/api/...`): Used for webhook receivers (PayMongo payment confirmations), and any complex server-side logic that doesn't fit into Server Actions.
2. **Next.js Server Actions**: Used for all form-based mutations (create booking, update profile, submit review).
3. **Supabase Edge Functions** (Deno-based): Used for scheduled jobs (automated reminder emails, pickup scheduling), and event-driven logic (trigger notifications on status changes).

All database operations from the Next.js layer use the **Supabase Server Client** with service role keys (server-side only) or anon keys (with RLS enforced).

---

### 4.4 Database

**Technology:** PostgreSQL via Supabase

PostgreSQL is the core data store. All business logic constraints (foreign keys, unique constraints, check constraints) are enforced at the database level. **Row Level Security (RLS)** policies ensure data isolation — customers can only read and write their own bookings, staff can only access the records relevant to their role.

---

### 4.5 Authentication

**Technology:** Supabase Auth

Supabase Auth handles:
- Email/password registration and login
- Magic link (passwordless) login
- OAuth providers (Google, Facebook)
- JWT token issuance and refresh
- Session management via HTTP-only cookies (handled by `@supabase/ssr`)

The `user_roles` table extends Supabase Auth users with application-level roles (customer, staff, admin, super_admin). Middleware reads the JWT and role claim on every request to enforce route-level protection.

---

### 4.6 File Storage

**Technology:** Supabase Storage (S3-compatible)

Used to store:
- Package photos (uploaded by admin)
- Equipment condition photos (uploaded by delivery staff)
- PDF receipts (generated server-side)
- Customer profile photos

Storage buckets have policies aligned with RLS: public read for package photos, private access for receipts and condition reports.

---

### 4.7 Automation

**Technology:** Supabase Edge Functions + Cron Jobs + Webhooks

| Automation | Trigger | Action |
|-----------|---------|--------|
| Booking confirmation email | New booking created | Resend email via Edge Function |
| Payment receipt | Payment webhook received | Generate PDF receipt + send email |
| Admin notification | New pending booking | In-app + email notification |
| Delivery reminder | 24 hrs before delivery date | SMS + email to customer |
| Pickup reminder | 1 hr before pickup time | SMS to delivery staff |
| Review request | Booking marked COMPLETED | Email sent 24 hrs later |
| Refund processing | Booking cancelled | Trigger PayMongo refund API |
| Daily schedule summary | Every day at 6 AM | Email to admin with day's deliveries/pickups |

---

### 4.8 Deployment

**Technology:** Vercel (Primary) + Supabase Cloud

- **Vercel** hosts the Next.js application with automatic preview deployments for each branch, edge network for global CDN, and serverless function execution.
- **Supabase Cloud** hosts the PostgreSQL database, Auth, Storage, and Edge Functions.
- **Environment variables** are stored securely in Vercel's environment variable settings and never committed to version control.
- **CI/CD** is handled by GitHub Actions: lint → test → build → deploy on every push to `main`.

---

## 5. Tech Stack Recommendation

| Category | Technology | Justification |
|----------|-----------|---------------|
| **Frontend Framework** | Next.js 14+ (App Router) | Server components, SEO optimization, Server Actions, image optimization, built-in routing. Best-in-class for fullstack React applications. |
| **UI Component Library** | Shadcn/ui + Radix UI | Headless, accessible components. Fully customizable. No runtime CSS-in-JS overhead. Copy-paste ownership of components. |
| **Styling** | Tailwind CSS | Utility-first, consistent design system, excellent developer experience, minimal bundle size with PurgeCSS. |
| **State Management** | Zustand (client) + TanStack Query | Zustand for lightweight global UI state. TanStack Query for server state, caching, and data fetching with optimistic updates. |
| **Backend Runtime** | Next.js (Node.js) + Supabase Edge Functions (Deno) | Zero infrastructure to manage. Serverless scales automatically. Edge Functions run globally close to users. |
| **Database** | PostgreSQL via Supabase | ACID-compliant, relational, battle-tested. Row Level Security is critical for multi-user data isolation. Free tier for development. |
| **ORM / Query Builder** | Supabase JS Client + Supabase Type Generator | Type-safe database access without a heavy ORM. Auto-generated TypeScript types from the database schema. |
| **Authentication** | Supabase Auth | Integrated with the database, supports OAuth, magic links, JWTs, and row-level security. Eliminates a separate auth service. |
| **File Storage** | Supabase Storage | Integrated with Auth and RLS. S3-compatible. Simple to use within the existing stack. |
| **Email** | Resend | Modern transactional email API. React Email for beautiful, type-safe email templates. Excellent deliverability. |
| **SMS Notifications** | Semaphore (PH) or Twilio | Semaphore is the best-in-class SMS provider for the Philippines with competitive rates. Twilio as an international fallback. |
| **Payment Gateway** | PayMongo | Purpose-built for the Philippine market. Supports GCash, Maya, credit/debit cards, and bank transfers. Has a webhook system for payment events. |
| **PDF Generation** | Puppeteer or @react-pdf/renderer | Server-side PDF generation for receipts and delivery documents. |
| **Automation / Cron** | Supabase Edge Functions + pg_cron | Scheduled database functions via pg_cron. Event-driven Edge Functions via database webhooks. |
| **Hosting** | Vercel | Best-in-class Next.js hosting. Automatic previews, global CDN, zero-config deployment, built-in analytics. |
| **Analytics** | Vercel Analytics + PostHog | Vercel for performance/Core Web Vitals. PostHog for product analytics (event tracking, funnels, session replays). |
| **Monitoring & Errors** | Sentry | Error tracking, performance monitoring, alerting. Integrates seamlessly with Next.js. |
| **Testing** | Vitest + Playwright | Vitest for unit/integration tests. Playwright for end-to-end testing of critical booking and payment flows. |
| **Version Control & CI/CD** | GitHub + GitHub Actions + Vercel | Industry standard. Vercel auto-deploys from GitHub. GitHub Actions for running tests before deployment. |
| **Maps / Delivery Zone** | Google Maps API or Mapbox | Visualize delivery zones, validate customer addresses against service boundaries. |

---

## 6. Database Planning

### 6.1 Tables Overview

| Table | Purpose |
|-------|---------|
| `users` | Managed by Supabase Auth. Extended by `profiles`. |
| `profiles` | Customer/staff profile data linked 1:1 to auth user. |
| `roles` | Lookup table of available roles. |
| `user_roles` | Junction table: assigns roles to users (many-to-many). |
| `packages` | Karaoke rental packages available for booking. |
| `package_photos` | Multiple photos per package. |
| `package_inclusions` | Items included in each package (microphone, stand, etc.). |
| `inventory_units` | Individual physical karaoke machines with serial numbers. |
| `unit_availability` | Blocks of time when a unit is unavailable (booked, maintenance). |
| `delivery_zones` | Geographic zones defining service area boundaries. |
| `bookings` | Core booking records. Central table of the application. |
| `booking_status_history` | Immutable log of every status transition for a booking. |
| `payments` | Payment transactions linked to bookings. |
| `refunds` | Refund records linked to payments. |
| `delivery_assignments` | Which staff member is assigned to deliver/pickup a booking. |
| `delivery_logs` | Timestamped delivery/pickup events with condition notes and photos. |
| `promo_codes` | Discount codes that can be applied at checkout. |
| `reviews` | Customer reviews linked to completed bookings. |
| `notifications` | In-app notifications for customers and admins. |
| `audit_logs` | Immutable record of all admin actions for compliance. |
| `settings` | Business-wide settings (business name, hours, etc.). |

---

### 6.2 Table Relationships

```
profiles (1) ────── (1) users [Supabase Auth]
profiles (1) ────── (N) bookings
packages (1) ────── (N) package_photos
packages (1) ────── (N) package_inclusions
packages (1) ────── (N) bookings
inventory_units (1) ──── (N) unit_availability
inventory_units (1) ──── (N) delivery_assignments
bookings (1) ────── (N) payments
bookings (1) ────── (N) refunds
bookings (1) ────── (N) booking_status_history
bookings (1) ────── (N) delivery_assignments
bookings (1) ────── (1) reviews
delivery_assignments (1) ── (N) delivery_logs
promo_codes (1) ─── (N) bookings
profiles (1) ────── (N) notifications
user_roles (N) ──── (1) profiles
user_roles (N) ──── (1) roles
```

---

### 6.3 Table Details

#### `profiles`
- **Primary Key:** `id` (UUID, references `auth.users.id`)
- **Foreign Keys:** `auth.users.id`
- **Key Fields:** `full_name`, `phone`, `email`, `profile_photo_url`, `delivery_address`, `created_at`
- **Indexes:** `phone` (unique), `email` (unique)
- **Purpose:** Extends Supabase Auth with application-specific user data. Created automatically when a new user signs up.

#### `roles`
- **Primary Key:** `id` (serial or UUID)
- **Key Fields:** `name` (e.g., 'customer', 'admin', 'staff', 'delivery_staff', 'super_admin')
- **Purpose:** Lookup table for all available system roles. Seeded on first deployment.

#### `user_roles`
- **Primary Key:** `(user_id, role_id)` composite
- **Foreign Keys:** `user_id` → `profiles.id`, `role_id` → `roles.id`
- **Purpose:** Assigns one or more roles to a user. A user can have multiple roles (e.g., admin + delivery staff).

#### `packages`
- **Primary Key:** `id` (UUID)
- **Key Fields:** `name`, `slug`, `description`, `base_price`, `weekend_price`, `holiday_price`, `min_hours`, `max_hours`, `is_active`, `created_at`, `updated_at`
- **Indexes:** `slug` (unique), `is_active`
- **Purpose:** Defines all rental packages customers can book. Prices can vary by day type.

#### `package_photos`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `package_id` → `packages.id`
- **Key Fields:** `storage_path`, `alt_text`, `sort_order`, `is_cover`
- **Purpose:** Stores references to uploaded photos in Supabase Storage for each package.

#### `package_inclusions`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `package_id` → `packages.id`
- **Key Fields:** `item_name`, `quantity`, `description`, `sort_order`
- **Purpose:** Lists what's included in a rental package (e.g., 2 microphones, 1 speaker stand).

#### `inventory_units`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `package_id` → `packages.id` (which package this unit belongs to)
- **Key Fields:** `serial_number`, `name`, `condition` (enum: new, good, fair, needs_repair, retired), `is_available`, `notes`
- **Indexes:** `serial_number` (unique)
- **Purpose:** Tracks individual physical karaoke machines. Each unit can be booked independently.

#### `unit_availability`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `unit_id` → `inventory_units.id`, `booking_id` → `bookings.id`
- **Key Fields:** `blocked_from`, `blocked_until`, `reason` (enum: booked, maintenance, reserved)
- **Indexes:** `unit_id, blocked_from, blocked_until` (composite for availability queries)
- **Purpose:** Tracks when each unit is unavailable. Queried during availability checks to prevent double-booking.

#### `delivery_zones`
- **Primary Key:** `id` (UUID)
- **Key Fields:** `name`, `boundary` (PostGIS geometry polygon), `delivery_fee`, `is_active`
- **Purpose:** Geographic areas the business services. Customer addresses are validated against these zones during booking. Requires PostGIS extension.

#### `bookings`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `customer_id` → `profiles.id`, `package_id` → `packages.id`, `unit_id` → `inventory_units.id`, `promo_code_id` → `promo_codes.id`, `delivery_zone_id` → `delivery_zones.id`
- **Key Fields:** `reference_number` (unique, human-readable), `event_date`, `start_time`, `end_time`, `delivery_address`, `status` (enum), `base_amount`, `discount_amount`, `delivery_fee`, `total_amount`, `paid_amount`, `balance_due`, `payment_option` (reservation_fee/full), `notes`, `admin_notes`, `created_at`, `updated_at`
- **Status Enum Values:** `PENDING_CONFIRMATION`, `CONFIRMED`, `OUT_FOR_DELIVERY`, `ACTIVE`, `OUT_FOR_PICKUP`, `COMPLETED`, `CANCELLED`, `REJECTED`
- **Indexes:** `customer_id`, `status`, `event_date`, `reference_number` (unique)
- **Purpose:** The core business table. Every booking passes through this table from creation to completion. All financial and operational data for a booking is here or linked here.

#### `booking_status_history`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `booking_id` → `bookings.id`, `changed_by` → `profiles.id`
- **Key Fields:** `previous_status`, `new_status`, `reason`, `created_at`
- **Purpose:** Immutable append-only log of every status change for a booking. Critical for dispute resolution, auditing, and timeline display.

#### `payments`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `booking_id` → `bookings.id`, `processed_by` → `profiles.id` (if cash, which admin recorded it)
- **Key Fields:** `amount`, `payment_method` (enum: card, gcash, maya, cash, bank_transfer), `payment_type` (enum: reservation_fee, balance, full_payment), `status` (enum: pending, completed, failed), `gateway_payment_id`, `gateway_response`, `paid_at`, `created_at`
- **Indexes:** `booking_id`, `gateway_payment_id` (unique)
- **Purpose:** Records every payment transaction for a booking. Supports multiple payments per booking (e.g., reservation fee + balance payment).

#### `refunds`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `payment_id` → `payments.id`, `booking_id` → `bookings.id`, `approved_by` → `profiles.id`
- **Key Fields:** `amount`, `reason`, `status` (enum: pending, processed, failed), `gateway_refund_id`, `processed_at`
- **Purpose:** Tracks refunds issued due to cancellations or disputes.

#### `delivery_assignments`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `booking_id` → `bookings.id`, `staff_id` → `profiles.id`, `unit_id` → `inventory_units.id`
- **Key Fields:** `assignment_type` (enum: delivery, pickup), `scheduled_at`, `completed_at`, `notes`, `status`
- **Purpose:** Links a booking to a specific staff member for delivery or pickup, with a scheduled time slot.

#### `delivery_logs`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `assignment_id` → `delivery_assignments.id`, `logged_by` → `profiles.id`
- **Key Fields:** `event_type` (enum: departed, arrived, delivered, condition_noted, picked_up), `notes`, `condition_photos` (array of storage paths), `created_at`
- **Purpose:** Timestamped event log for each step of the delivery or pickup process. Includes photos of equipment condition.

#### `promo_codes`
- **Primary Key:** `id` (UUID)
- **Key Fields:** `code` (unique), `discount_type` (enum: percentage, fixed), `discount_value`, `min_booking_amount`, `max_uses`, `used_count`, `valid_from`, `valid_until`, `is_active`
- **Indexes:** `code` (unique), `is_active`
- **Purpose:** Discount codes customers can enter during checkout to reduce their booking total.

#### `reviews`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `booking_id` → `bookings.id`, `customer_id` → `profiles.id`, `package_id` → `packages.id`
- **Key Fields:** `rating` (1-5), `comment`, `status` (enum: pending_moderation, published, rejected), `admin_notes`, `published_at`, `created_at`
- **Indexes:** `package_id`, `status`
- **Purpose:** Customer feedback after a completed rental. Moderated before public display.

#### `notifications`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `recipient_id` → `profiles.id`
- **Key Fields:** `title`, `body`, `type` (enum: booking, payment, delivery, system), `read_at`, `action_url`, `created_at`
- **Indexes:** `recipient_id, read_at` (for unread count queries)
- **Purpose:** In-app notification inbox for customers and admins. Marked as read when viewed.

#### `audit_logs`
- **Primary Key:** `id` (UUID)
- **Foreign Keys:** `performed_by` → `profiles.id`
- **Key Fields:** `action` (e.g., 'booking.confirmed', 'package.updated'), `entity_type`, `entity_id`, `before_state` (JSONB), `after_state` (JSONB), `ip_address`, `user_agent`, `created_at`
- **Purpose:** Immutable compliance log of all admin and staff actions. Stored as JSONB snapshots before/after.

#### `settings`
- **Primary Key:** `id` (UUID)
- **Key Fields:** `key` (unique), `value` (JSONB), `description`, `updated_by`, `updated_at`
- **Purpose:** Key-value store for business-wide configuration (business name, contact email, operating hours, reservation fee percentage, cancellation policy, etc.).

---

## 7. Folder Structure

```
kyu-rentals/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Run tests and lint on PR
│       └── deploy.yml                # Deploy to Vercel on merge to main
│
├── .env.local                        # Local environment variables (not committed)
├── .env.example                      # Template for required env vars
├── .gitignore
├── next.config.ts                    # Next.js configuration
├── tailwind.config.ts                # Tailwind configuration
├── tsconfig.json
├── package.json
│
├── public/                           # Static assets served directly
│   ├── images/
│   ├── fonts/
│   └── favicon.ico
│
├── src/
│   │
│   ├── app/                          # Next.js App Router — all pages and layouts
│   │   │
│   │   ├── (marketing)/              # Route group: public customer-facing pages
│   │   │   ├── layout.tsx            # Marketing layout (nav, footer)
│   │   │   ├── page.tsx              # Landing page (/)
│   │   │   ├── packages/
│   │   │   │   ├── page.tsx          # Package catalog
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx      # Package detail
│   │   │   └── contact/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (auth)/                   # Route group: authentication pages
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── forgot-password/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (customer)/               # Route group: authenticated customer portal
│   │   │   ├── layout.tsx            # Customer portal layout (with auth check)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── bookings/
│   │   │   │   ├── page.tsx          # Booking list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx      # Booking detail
│   │   │   ├── book/
│   │   │   │   └── page.tsx          # Booking wizard
│   │   │   └── profile/
│   │   │       └── page.tsx
│   │   │
│   │   ├── admin/                    # Admin dashboard
│   │   │   ├── layout.tsx            # Admin layout (sidebar, auth guard)
│   │   │   ├── page.tsx              # Admin home / KPI dashboard
│   │   │   ├── bookings/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── packages/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── inventory/
│   │   │   │   └── page.tsx
│   │   │   ├── customers/
│   │   │   │   └── page.tsx
│   │   │   ├── staff/
│   │   │   │   └── page.tsx
│   │   │   ├── schedule/
│   │   │   │   └── page.tsx          # Calendar view
│   │   │   ├── reports/
│   │   │   │   └── page.tsx
│   │   │   ├── reviews/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/                      # API Route Handlers
│   │       ├── webhooks/
│   │       │   ├── paymongo/
│   │       │   │   └── route.ts      # Payment webhook receiver
│   │       │   └── supabase/
│   │       │       └── route.ts      # DB event webhooks
│   │       └── og/
│   │           └── route.ts          # Open Graph image generation
│   │
│   ├── components/                   # Reusable UI components
│   │   ├── ui/                       # Shadcn/ui base components (auto-generated)
│   │   ├── layout/                   # Header, Footer, Sidebar, Navigation
│   │   ├── booking/                  # Booking wizard steps, availability calendar
│   │   ├── packages/                 # Package cards, detail sections
│   │   ├── admin/                    # Admin-specific components (tables, KPI cards)
│   │   ├── payments/                 # Payment form, receipt components
│   │   ├── forms/                    # Reusable form components
│   │   └── shared/                   # Generic shared components (badges, modals)
│   │
│   ├── lib/                          # Core utilities and integrations
│   │   ├── supabase/
│   │   │   ├── client.ts             # Browser-side Supabase client
│   │   │   ├── server.ts             # Server-side Supabase client (with cookie handling)
│   │   │   └── middleware.ts         # Session refresh in Next.js middleware
│   │   ├── paymongo/
│   │   │   └── client.ts             # PayMongo API wrapper
│   │   ├── resend/
│   │   │   └── client.ts             # Resend email client
│   │   ├── pdf/
│   │   │   └── generator.ts          # PDF receipt generation
│   │   └── utils.ts                  # Shared utility functions (cn, formatters, etc.)
│   │
│   ├── actions/                      # Next.js Server Actions
│   │   ├── booking.actions.ts        # Create, cancel, reschedule bookings
│   │   ├── payment.actions.ts        # Initiate payments, handle refunds
│   │   ├── admin.actions.ts          # Admin approval, rejection, assignment
│   │   ├── package.actions.ts        # Package CRUD
│   │   └── profile.actions.ts        # Profile updates
│   │
│   ├── queries/                      # Data fetching functions (server-side)
│   │   ├── bookings.ts               # Booking queries
│   │   ├── packages.ts               # Package queries
│   │   ├── inventory.ts              # Inventory queries
│   │   └── analytics.ts              # Analytics/reporting queries
│   │
│   ├── types/                        # TypeScript type definitions
│   │   ├── database.types.ts         # Auto-generated from Supabase schema
│   │   ├── booking.types.ts          # Application-level booking types
│   │   └── api.types.ts              # API request/response types
│   │
│   ├── hooks/                        # Custom React hooks (client-side)
│   │   ├── use-booking.ts
│   │   ├── use-availability.ts
│   │   └── use-notifications.ts
│   │
│   ├── stores/                       # Zustand state stores
│   │   ├── booking-wizard.store.ts   # Multi-step booking wizard state
│   │   └── ui.store.ts               # Global UI state (modals, sidebars)
│   │
│   ├── config/                       # Application configuration constants
│   │   ├── site.ts                   # Business name, URLs, social links
│   │   └── constants.ts              # App-wide constants (status enums, etc.)
│   │
│   ├── emails/                       # React Email templates
│   │   ├── booking-confirmation.tsx
│   │   ├── booking-approved.tsx
│   │   ├── payment-receipt.tsx
│   │   └── review-request.tsx
│   │
│   └── middleware.ts                 # Next.js Edge Middleware (auth session, routing)
│
├── supabase/                         # Supabase local development config
│   ├── config.toml
│   ├── seed.sql                      # Initial data (roles, settings, sample packages)
│   └── functions/                    # Supabase Edge Functions
│       ├── send-reminder/
│       │   └── index.ts
│       └── process-booking-event/
│           └── index.ts
│
└── tests/
    ├── unit/
    │   └── utils.test.ts
    ├── integration/
    │   └── booking.test.ts
    └── e2e/
        ├── booking-flow.spec.ts
        └── admin-approval.spec.ts
```

### Key Folder Explanations

| Folder | Purpose |
|--------|---------|
| `src/app/(marketing)` | Route group for all public-facing pages. Parentheses mean it doesn't affect the URL path. |
| `src/app/(customer)` | Protected route group for logged-in customers. Layout enforces authentication. |
| `src/app/admin` | Admin panel. Layout enforces role-based access (admin/staff only). |
| `src/app/api` | API Route Handlers for webhooks and server-generated content. |
| `src/components` | All React components organized by domain. Never contains business logic. |
| `src/lib` | Pure utility functions and third-party service clients. Framework-agnostic. |
| `src/actions` | Server Actions — the bridge between client forms and the database. |
| `src/queries` | Server-side data fetching logic, separated from components for reusability. |
| `src/types` | All TypeScript types. `database.types.ts` is auto-generated and should never be edited manually. |
| `src/emails` | React Email templates for all transactional emails. Can be previewed locally. |
| `src/middleware.ts` | Runs on every request edge — validates session and enforces route protection. |
| `supabase/` | Local Supabase configuration for development. Seed file for test data. Edge Functions. |
| `tests/` | Tests organized by type. E2E tests cover the critical user journey end-to-end. |

---

## 8. Feature Development Order

### Phase 1 — Foundation (Weeks 1–2)
**Goal:** Project is set up, running locally, deployed to staging, and basic infrastructure is in place.

| Task | Description |
|------|-------------|
| Initialize Next.js project | Setup App Router, TypeScript, Tailwind, Shadcn/ui |
| Setup Supabase project | Configure auth, storage buckets, RLS enabled |
| Design database schema | Create all tables with proper RLS policies |
| Authentication | Email/password + Google OAuth, middleware route protection |
| CI/CD pipeline | GitHub Actions + Vercel preview deployments |
| Environment configuration | .env.example with all required variables documented |

**Why first?** Everything else depends on authentication and the database being in place. No feature can be built without a foundation.

---

### Phase 2 — Customer Browsing Experience (Weeks 3–4)
**Goal:** A real customer can browse packages and view availability.

| Task | Description |
|------|-------------|
| Landing page | Hero, value propositions, featured packages, testimonials (placeholder) |
| Package catalog page | List all active packages with photos and pricing |
| Package detail page | Full description, inclusions, pricing, availability calendar |
| Availability checker | Connect date picker to inventory_units and unit_availability tables |

**Why second?** The browsing experience is the top of the funnel. It must exist before booking can be tested. It's also simpler to build than the booking flow.

---

### Phase 3 — Booking Flow & Payments (Weeks 5–7)
**Goal:** A customer can complete a real booking and pay online.

| Task | Description |
|------|-------------|
| Booking wizard (multi-step) | Date → Package → Address → Contact → Review → Payment |
| Address / delivery zone validation | Check if delivery address is within service area |
| PayMongo integration | Card, GCash, Maya payment processing |
| Payment webhook handler | Receive and verify payment events from PayMongo |
| Booking creation | Create booking record, lock inventory, send confirmation email |
| Customer booking dashboard | View own bookings and statuses |
| Email notifications | Booking confirmation, payment receipt via Resend |

**Why third?** This is the core revenue-generating flow. It can only be built once browsing (Phase 2) and auth (Phase 1) are complete.

---

### Phase 4 — Admin Dashboard Core (Weeks 8–10)
**Goal:** Admin can manage all bookings end-to-end.

| Task | Description |
|------|-------------|
| Admin dashboard home | KPI cards, recent bookings, quick actions |
| Booking management | List, filter, search all bookings |
| Booking approval workflow | Confirm or reject with reason + notifications |
| Package management | Create, edit, publish/archive packages with photo uploads |
| Inventory management | Add units, track condition, view availability |
| Manual booking creation | Admin creates booking on behalf of customer |
| Delivery scheduling | Assign staff and time slots to confirmed bookings |

**Why fourth?** The business cannot operate without the admin dashboard. Once bookings can be created (Phase 3), admins need tools to manage them.

---

### Phase 5 — Delivery & Operations (Weeks 11–12)
**Goal:** Staff can manage deliveries and pickups operationally.

| Task | Description |
|------|-------------|
| Staff portal | Simplified view of daily delivery/pickup assignments |
| Delivery status updates | Staff marks Out for Delivery, Delivered, Out for Pickup, Picked Up |
| Condition photo upload | Staff uploads equipment condition photos |
| Customer real-time status | Status updates visible to customer in their dashboard |
| SMS notifications | Delivery reminders and alerts via Semaphore/Twilio |
| Admin calendar view | Visual calendar of all daily operations |

**Why fifth?** This phase operationalizes the bookings created in Phases 3–4. It requires the booking and admin systems to be stable first.

---

### Phase 6 — Reviews, Reports & Analytics (Weeks 13–14)
**Goal:** Business intelligence and customer feedback loop.

| Task | Description |
|------|-------------|
| Review submission & moderation | Customer reviews after completed booking |
| Revenue reports | Date-range revenue dashboards with charts |
| Booking analytics | Popular packages, peak dates, cancellation rates |
| Promo code system | Create and apply discount codes |
| Customer management | Admin view of all customers with history |
| Audit log viewer | Admin can browse all admin actions |

**Why sixth?** Analytics and reviews are valuable but not blockers for core operations. They enrich the product after the primary workflows are working.

---

### Phase 7 — Polish, Performance & Launch (Weeks 15–16)
**Goal:** Production-ready, performant, and secure.

| Task | Description |
|------|-------------|
| SEO optimization | Meta tags, Open Graph images, sitemap, robots.txt |
| Performance optimization | Image optimization, lazy loading, Core Web Vitals |
| Accessibility audit | WCAG 2.1 compliance review |
| Security audit | Penetration testing, OWASP checklist review |
| End-to-end tests | Critical flow E2E tests with Playwright |
| Error monitoring | Sentry integration |
| Production deployment | Final Vercel production config, custom domain, SSL |

**Why last?** Polish and optimization should happen after all features are stable. Launch readiness is the final gate before going live.

---

## 9. Security Planning

### 9.1 Authentication Security

| Measure | Implementation |
|---------|---------------|
| Password requirements | Minimum 8 characters, complexity enforced at registration |
| Email verification | Required before account is fully active |
| Rate limiting on login | Max 5 failed attempts per 15 minutes (IP + email-based) |
| JWT expiry | Access tokens expire in 1 hour; refresh tokens in 7 days |
| HTTP-only cookies | Session cookies are HTTP-only and Secure; not accessible to JavaScript |
| HTTPS only | All traffic forced to HTTPS; HSTS header enabled |
| OAuth security | Use only verified OAuth providers (Google, Facebook) with state parameter validation |
| Password reset | Tokens are single-use and expire in 15 minutes |

---

### 9.2 Authorization

| Measure | Implementation |
|---------|---------------|
| Row Level Security (RLS) | Every table has RLS policies. Customers can only access their own data. |
| Role-based access control | Middleware checks user role on every admin route request |
| Server-side role verification | Never trust role from client request. Always verify from database on the server. |
| Principle of least privilege | Service role key only used in server-side code. Browser client uses anon key with RLS. |
| Admin route protection | `/admin/*` routes check for admin/staff role in middleware and in layout |

---

### 9.3 Input Validation

| Measure | Implementation |
|---------|---------------|
| Schema validation | Zod schemas validate all form inputs and API request bodies |
| Server-side validation | All Server Actions re-validate data even if client-side validation passed |
| Sanitization | Strip HTML from user inputs. Never trust user-supplied data. |
| File upload validation | Validate MIME type, file size limits (max 5MB per photo), and scan for malicious files |
| SQL injection prevention | Supabase JS client uses parameterized queries. Never concatenate user input into SQL. |
| XSS prevention | React escapes output by default. Content Security Policy header configured. |

---

### 9.4 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| Login | 5 attempts | 15 minutes |
| Registration | 3 registrations | 1 hour (per IP) |
| Booking creation | 5 bookings | 1 hour (per user) |
| Payment initiation | 3 attempts | 10 minutes (per booking) |
| API endpoints | 100 requests | 1 minute (per IP) |
| Webhook endpoints | Signature verification | Per-request (no open access) |

**Implementation:** Upstash Redis with `@upstash/ratelimit` in Next.js Middleware, or Vercel's built-in rate limiting.

---

### 9.5 Database Security

| Measure | Implementation |
|---------|---------------|
| Row Level Security | Enabled on all tables. Default deny — must explicitly grant access. |
| Database roles | Separate `anon`, `authenticated`, and `service_role` roles with different privileges |
| No direct DB access | Database is never exposed publicly. All access is through Supabase API layer. |
| Encrypted at rest | Supabase encrypts all data at rest by default |
| Backups | Point-in-time recovery enabled. Daily automated backups retained for 30 days. |
| Audit trail | All sensitive operations logged in `audit_logs` table |
| Connection pooling | PgBouncer via Supabase to prevent connection exhaustion |

---

### 9.6 Payment Security

| Measure | Implementation |
|---------|---------------|
| No card data stored | Payment card data is handled entirely by PayMongo. Never touches KYU Rentals servers. |
| Webhook signature verification | Verify PayMongo HMAC webhook signatures before processing payment events |
| Idempotent payment processing | Use PayMongo's idempotency keys to prevent duplicate payments |
| Payment intent validation | Cross-check payment amount with booking total before confirming |
| PCI Compliance | Achieved by delegating all card processing to PayMongo |

---

### 9.7 Environment Variables & Secrets

| Measure | Implementation |
|---------|---------------|
| Never commit secrets | `.env.local` is in `.gitignore`. `.env.example` has placeholder values only. |
| Vercel env management | All secrets stored in Vercel's encrypted environment variable store |
| Separate envs | Different values for local, staging, and production environments |
| Secret rotation | Plan to rotate all API keys quarterly or immediately upon suspected exposure |
| Principle of minimal scope | API keys are created with the minimal required permissions (e.g., PayMongo read-only key for webhooks) |
| Server-only secrets | Service role key, PayMongo secret key, and email API key are never exposed to the browser |

---

## 10. Scalability Planning

### 10.1 Current State — Single Business (MVP)

The MVP is designed as a single-tenant application for KYU Rentals. The database schema, auth, and routing all assume one business. This is the appropriate starting point — premature multi-tenancy adds significant complexity.

**The key design decisions made now that enable future scaling:**
- `settings` table uses a key-value structure (not hardcoded config), making it easy to scope settings per tenant later
- All business-specific data (packages, inventory, delivery zones, bookings) uses `UUID` primary keys — no sequential IDs that would conflict in a multi-tenant merge
- Audit logs and booking history are append-only, which is a sound pattern at any scale
- No business logic is hardcoded in the UI — all config comes from the database

---

### 10.2 Phase 1 Scaling — Geographic Expansion (Multiple Branches)

**Scenario:** KYU Rentals opens multiple branches in different cities.

**Changes required:**
- Add a `branches` table with location, operating hours, delivery zones
- Add `branch_id` foreign key to `packages`, `inventory_units`, `bookings`, and `staff` records
- RLS policies updated to scope data per branch
- Admin role gains a `branch_id` — admins only see their branch
- A new "Franchise Admin" role can view all branches
- Delivery zone polygons linked to specific branches

**Architecture impact:** No frontend rebuild needed. Routing adds a branch selector. Database schema change is additive (add columns/tables, don't remove).

---

### 10.3 Phase 2 Scaling — SaaS Platform (Multiple Businesses)

**Scenario:** KYU Rentals evolves into a platform where any karaoke rental business can sign up.

**Changes required:**
- Add a `tenants` (organizations) table — each business is a tenant
- All tables gain a `tenant_id` column enforced by RLS
- Auth flow includes tenant selection at login (or subdomain-based routing)
- Billing system added (Stripe for subscription management)
- Super Admin dashboard for platform-level management
- Custom domain / white-label support via Vercel wildcard domains
- Supabase schema isolation via PostgreSQL schemas or separate Supabase projects per tenant

**Two multi-tenancy models to choose from:**

| Model | Approach | Pros | Cons |
|-------|----------|------|------|
| **Shared Schema** | All tenants in one DB, `tenant_id` on all rows | Simple, cost-efficient | Requires flawless RLS. Data isolation risk if misconfigured. |
| **Separate Schema** | One PostgreSQL schema per tenant | Strong isolation | More complex migrations, harder to query across tenants |
| **Separate Database** | One Supabase project per tenant | Maximum isolation | Expensive, complex to manage at scale |

**Recommendation for KYU:** Start with **Shared Schema** (add `tenant_id`). This is the most common SaaS approach and is well-supported by Supabase RLS. Move to Separate Schema only if a tenant requires enterprise-level isolation guarantees.

---

### 10.4 Infrastructure Scaling

| Layer | Current (MVP) | Future (Scale) |
|-------|--------------|----------------|
| **Hosting** | Vercel Hobby/Pro | Vercel Enterprise or self-hosted on Railway/Fly.io |
| **Database** | Supabase Free/Pro | Supabase Business tier with read replicas |
| **CDN** | Vercel Edge Network | Cloudflare CDN for global asset delivery |
| **Caching** | TanStack Query client cache | Redis (Upstash) for server-side caching of package listings |
| **Search** | PostgreSQL full-text search | Algolia or Meilisearch for advanced package/booking search |
| **Background Jobs** | Supabase Edge Functions | Trigger.dev or inngest for complex workflow orchestration |
| **File Storage** | Supabase Storage | Cloudflare R2 or AWS S3 for large volumes at lower cost |
| **Email Volume** | Resend free tier | Resend or AWS SES for high-volume sending |

---

### 10.5 Code Architecture for Scalability

The folder structure and architecture choices already support scalability:

- **Route groups** make it easy to add a new portal (e.g., `/franchise` admin) without restructuring the project
- **Server Actions and Queries are separated** — swapping the data layer (e.g., from Supabase client to a custom API) requires changing only `src/queries/` and `src/actions/`, not every component
- **`src/config/site.ts`** centralizes business identity — in SaaS mode, this becomes tenant-aware
- **TypeScript throughout** ensures refactoring is safe and type-checked as the schema evolves
- **Tests from Day 1** (E2E for critical flows) provide a regression safety net for future changes

---

> [!NOTE]
> **Summary of Key Architectural Decisions**
>
> 1. **Next.js App Router** over Pages Router — future-proof, better performance, Server Components reduce client bundle size
> 2. **Supabase** over a custom Express/Node backend — reduces infrastructure management by ~70% while providing auth, database, storage, and realtime in one platform
> 3. **PayMongo** over Stripe — Philippines-first, supports GCash and Maya which are dominant local payment methods
> 4. **UUID primary keys** on all tables — safe for future multi-tenant merges and prevents enumerable IDs
> 5. **Append-only status history** — never mutate booking history; only append new records. This is critical for disputes, auditing, and debugging
> 6. **RLS from Day 1** — security cannot be bolted on later. Every table has policies before any data enters it
> 7. **Monorepo for admin + customer** — one deployment, shared types and components. Splitting into microservices would add DevOps complexity with no benefit at this scale

---

*Document version 1.0.0 — To be updated as architectural decisions are revised during development phases.*
