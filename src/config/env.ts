import { z } from "zod";

const envSchema = z.object({
  // Public Client Environment Variables
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_NAME: z.string().default("KYU Rentals"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

  // Server-Only Secrets
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_PUBLIC_KEY: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SEMAPHORE_API_KEY: z.string().optional(),
  SEMAPHORE_SENDER_NAME: z.string().default("KYURentals"),
  ANALYZE: z.string().optional(),
});

function validateEnv() {
  const parsed = envSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY,
    PAYMONGO_PUBLIC_KEY: process.env.PAYMONGO_PUBLIC_KEY,
    PAYMONGO_WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    SEMAPHORE_API_KEY: process.env.SEMAPHORE_API_KEY,
    SEMAPHORE_SENDER_NAME: process.env.SEMAPHORE_SENDER_NAME,
    ANALYZE: process.env.ANALYZE,
  });

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }

  return parsed.data;
}

export const env = validateEnv();
