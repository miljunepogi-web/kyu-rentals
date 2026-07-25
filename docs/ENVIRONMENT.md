# KYU Rentals — Environment Guide

All environment variables are validated at startup via `src/config/env.ts` using Zod.

## Variable Reference

| Variable | Scope | Type | Required | Purpose |
|----------|-------|------|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Public | URL | Yes | Application base URL |
| `NEXT_PUBLIC_APP_NAME` | Public | String | Yes | Application display name |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | URL | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | String | Yes | Supabase anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | String | Optional (dev) | Supabase admin service key |
| `PAYMONGO_SECRET_KEY` | Server | String | Optional (dev) | PayMongo gateway secret key |
| `PAYMONGO_PUBLIC_KEY` | Server | String | Optional (dev) | PayMongo gateway public key |
| `RESEND_API_KEY` | Server | String | Optional (dev) | Resend email API key |
| `SEMAPHORE_API_KEY` | Server | String | Optional (dev) | Semaphore SMS API key |
| `ANALYZE` | Build | Boolean | Optional | Set to `true` to run bundle analyzer |
