# Slice 3 UX Audit — Customer Package Discovery & Selection

## 1. Audit Scope & Viewports
- **Target Pages:**
  - `src/app/packages/page.tsx` (Package Discovery Catalog)
  - `src/app/packages/[slug]/page.tsx` (Package Detail View)
  - Associated Presentational Components: `PackageGrid.tsx`, `PackageCard.tsx`, `InclusionsList.tsx`, `AvailabilityChecker.tsx`
- **Evaluated Viewports:**
  - **360px:** Small mobile (e.g. iPhone SE, Galaxy S8)
  - **390px:** Standard mobile (e.g. iPhone 12/13/14)
  - **768px - 1024px:** Tablet (iPad / iPad Mini)
  - **>=1024px:** Desktop (Full-screen viewport)

---

## 2. Comprehensive UX Audit Findings by Category

### A. 360px & 390px Mobile Responsive Behavior & Layout
- **Package Detail Layout (`src/app/packages/[slug]/page.tsx`):**
  - **Issue:** Rigid `gap-12` between the left column (image & inclusions) and right column (pricing & booking panel) generates 48px of empty vertical space on 360px/390px screens.
  - **Issue:** Header flex container (`<div className="flex items-center gap-3">`) wrapping title `h1` and `POPULAR` badge causes title text clipping or awkward wrapping on 360px screens when viewing long titles like "KYU Concert Master".
  - **Issue:** Back navigation link (`<Link href="/packages">`) has a small hit target area (`text-sm`) with no padding on mobile.
- **Package Catalog Layout (`src/app/packages/page.tsx`):**
  - **Issue:** Hero header padding (`py-12 md:py-20`) pushes the package catalog cards off the immediate mobile viewport fold.

### B. Package Card Hierarchy & Visual Polish
- **Card Layout & Typography (`PackageCard.tsx`):**
  - **Issue:** Package tagline (`text-xs text-muted-foreground`) has low contrast against the card background.
  - **Issue:** Inclusions list section lacks visual separation from pricing, creating a dense block of text on 360px screens.
  - **Issue:** Background gradient overlay on card images lacks `aria-hidden="true"`, creating redundant DOM nodes for assistive tech.

### C. Pricing Hierarchy & Deposit Clarity
- **Deposit Announcement:**
  - **Issue:** The 30% non-refundable reservation deposit requirement is buried in small sub-text (`text-xs text-muted-foreground`) under the primary price. Customers cannot quickly identify the exact upfront cash amount required before launching the booking wizard.
  - **Issue:** 4-hour, 8-hour, and Full Day rates in `PackageCard.tsx` lack clear visual distinction, making it hard to compare rental durations at a glance.

### D. Book Now CTA & Touch Target Compliance
- **Touch Target Bounds (<44px Minimum):**
  - **Issue:** Filter category tabs (`All Packages`, `Featured Setups`) in `PackageGrid.tsx` use `size="sm"` (`h-9`), rendering at 36px height, failing the 44px project touch-target rule.
  - **Issue:** `AvailabilityChecker` date input and submit button render at 40px height (`h-10`).
  - **Issue:** Back to Packages link (`<Link href="/packages">`) renders without minimum touch padding on touchscreens.

### E. Loading, Empty & Error States
- **Availability Checker Simulation (`AvailabilityChecker.tsx`):**
  - **Issue:** When a customer clicks "Check Availability", the submit button text changes to `"Checking Availability..."` without an animated spinner icon (`<Loader2 className="animate-spin" />`).
  - **Issue:** When zero packages match a filter criteria in `PackageGrid.tsx`, no dedicated accessible empty state message is rendered.
  - **Issue:** `AvailabilityChecker` alert boxes (`Available!` / `Fully Booked`) lack `role="status"` or `role="alert"` announcements for screen readers.

### F. Keyboard & Screen-Reader Accessibility
- **Semantic ARIA Structure:**
  - **Issue:** Filter tabs in `PackageGrid.tsx` use standard buttons without `role="tablist"`, `role="tab"`, or `aria-selected` attributes.
  - **Issue:** Guest capacity (`maxGuests`) and sound rating (`soundRating`) badges lack descriptive `aria-label` attributes (e.g. `aria-label="Capacity: up to 30 guests"`).
  - **Issue:** Interactive package cards lack keyboard focus ring indicators (`focus-visible:ring-2 focus-visible:ring-primary`).

---

## 3. Categorized Audit Issues by Severity

| Severity | Issue Summary | Target File / Location | Proposed Fix |
| :--- | :--- | :--- | :--- |
| **CRITICAL** | Package detail title & `POPULAR` badge clip on 360px viewports; excessive 48px grid gap on mobile. | `src/app/packages/[slug]/page.tsx` | Use `flex-wrap items-baseline` on title header and responsive grid gap (`gap-6 md:gap-8 lg:gap-12`). |
| **HIGH** | Category filter tabs, date inputs, availability buttons, and back links fail 44px minimum touch target standard. | `PackageGrid.tsx`, `AvailabilityChecker.tsx`, `page.tsx` | Enforce `min-h-[44px]` height and `h-11` sizing across all buttons, inputs, tabs, and links. |
| **MEDIUM** | 30% deposit calculation is subtle; `AvailabilityChecker` lacks animated loading spinner; pricing rates lack visual distinction. | `PackageCard.tsx`, `PackageDetailPage`, `AvailabilityChecker.tsx` | Add prominent "30% Deposit Due Now" highlight card, distinguish 4h/8h/24h pricing clearly, and add `<Loader2 className="animate-spin" />`. |
| **LOW** | Filter tabs lack ARIA tab roles; spec badges lack `aria-label` descriptions; image overlays lack `aria-hidden="true"`. | `PackageGrid.tsx`, `PackageCard.tsx` | Add `role="tablist"` / `role="tab"`, descriptive `aria-label`s on badges, and `aria-hidden="true"` on gradient overlays. |

---

## 4. Verification Requirements for Implementation Phase
1. `npm test`
2. `npm run lint`
3. `npm run build`
4. `git diff --check`
5. Documentation update: `docs/ux/SLICE-3-REVIEW.md`
