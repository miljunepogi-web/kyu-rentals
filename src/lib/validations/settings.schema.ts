import { z } from "zod";

export const tenantSettingsSchema = z.object({
  businessName: z.string().min(2, "Business name must be at least 2 characters."),
  tagline: z.string().optional(),
  contactEmail: z.string().email("Invalid email address."),
  contactPhone: z.string().min(7, "Invalid phone number."),
  currency: z.string().default("PHP"),
  currencySymbol: z.string().default("₱"),
  reservationPct: z
    .number()
    .min(0, "Reservation fee percentage cannot be negative.")
    .max(100, "Reservation fee percentage cannot exceed 100%."),
  overtimeRatePerHour: z.number().min(0, "Overtime rate cannot be negative."),
  bookingExpiryHours: z
    .number()
    .int("Booking expiry must be an integer (hours).")
    .min(1, "Booking expiry must be at least 1 hour."),
});

export type TenantSettingsInput = z.infer<typeof tenantSettingsSchema>;
