import { z } from "zod";

export const availabilitySchema = z.object({
  packageId: z.string().min(1, "Package selection is required"),
  eventDate: z.string().min(1, "Event date is required"),
  durationHours: z.number().min(4, "Minimum duration is 4 hours").default(4),
  deliveryZone: z.string().optional(),
});

export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export const coverageCheckSchema = z.object({
  address: z.string().min(3, "Please enter a valid city or barangay"),
});

export type CoverageCheckInput = z.infer<typeof coverageCheckSchema>;
