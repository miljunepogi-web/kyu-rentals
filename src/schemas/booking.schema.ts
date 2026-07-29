import { z } from "zod";
import {
  BOOKING_ADDON_IDS,
  BOOKING_DELIVERY_ZONE_VALUES,
  BOOKING_DURATION_OPTIONS,
} from "@/config/booking-options.config";

function currentManilaDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const createBookingInputSchema = z.object({
  packageSlug: z.string().min(1, "Package selection is required"),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid event date format (yyyy-MM-dd)")
    .refine((value) => value >= currentManilaDate(), "Event date cannot be in the past"),
  startTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Invalid start time format (HH:mm)"),
  durationHours: z.union(
    BOOKING_DURATION_OPTIONS.map((hours) => z.literal(hours)) as [
      z.ZodLiteral<4>,
      z.ZodLiteral<8>,
      z.ZodLiteral<24>,
    ],
  ),
  deliveryAddress: z.string().trim().min(5, "Delivery address is required").max(500),
  deliveryZone: z.enum(BOOKING_DELIVERY_ZONE_VALUES),
  specialInstructions: z.string().trim().max(1000).optional(),
  customerFullName: z.string().trim().min(2, "Full name is required").max(120),
  customerEmail: z.string().trim().email("Valid email address is required").max(254),
  customerPhone: z
    .string()
    .trim()
    .regex(/^(?:\+63|0)9\d{9}$/, "Enter a valid Philippine mobile number"),
  termsAccepted: z.literal(true, {
    error: "Rental terms must be accepted",
  }),
  addons: z
    .array(
      z.object({
        id: z.enum(BOOKING_ADDON_IDS),
        quantity: z.number().int().min(1),
      }),
    )
    .superRefine((addons, ctx) => {
      const seen = new Set<string>();
      for (const addon of addons) {
        if (seen.has(addon.id)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate add-on selection: ${addon.id}`,
          });
        }
        seen.add(addon.id);

        const maxQuantity = addon.id === "add-mic" ? 4 : 1;
        if (addon.quantity > maxQuantity) {
          ctx.addIssue({
            code: "custom",
            message: `Invalid quantity for add-on: ${addon.id}`,
          });
        }
      }
    })
    .default([]),
});

export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
