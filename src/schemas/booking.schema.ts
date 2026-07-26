import { z } from "zod";

export const createBookingInputSchema = z.object({
  packageSlug: z.string().min(1, "Package selection is required"),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid event date format (yyyy-MM-dd)"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid start time format (HH:mm)"),
  durationHours: z.number().min(4, "Minimum rental duration is 4 hours"),
  deliveryAddress: z.string().min(5, "Delivery address is required"),
  deliveryZone: z.string().optional(),
  specialInstructions: z.string().optional(),
  customerFullName: z.string().min(2, "Full name is required"),
  customerEmail: z.string().email("Valid email address is required"),
  customerPhone: z.string().min(10, "Valid phone number is required"),
  addons: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        unitPrice: z.number().min(0),
        quantity: z.number().min(1),
      })
    )
    .default([]),
});

export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;
