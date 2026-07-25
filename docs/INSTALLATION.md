# KYU Rentals — Installation & Setup Guide

This document describes how to set up the development environment for KYU Rentals.

---

## Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: v20.x or higher
- **pnpm**: v10.x or higher (`npm i -g pnpm`)
- **Git**: v2.x or higher

---

## Step 1: Clone & Navigate

```bash
git clone <repository-url>
cd kyu-rentals
```

---

## Step 2: Install Dependencies

```bash
pnpm install
```

---

## Step 3: Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your local Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 4: Run Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `pnpm dev` | `next dev` | Starts local development server |
| `pnpm build` | `next build` | Compiles production bundle |
| `pnpm start` | `next start` | Runs production server |
| `pnpm lint` | `next lint` | Runs ESLint checks |
| `pnpm format:check` | `prettier --check .` | Checks code formatting |
| `pnpm format:write` | `prettier --write .` | Auto-formats all code |
| `pnpm analyze` | `ANALYZE=true next build` | Opens Next.js bundle analyzer |
