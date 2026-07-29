import { z } from "zod";

export const packageInclusionSchema = z.object({
  id: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(160),
  quantity: z.number().int().min(1).max(99),
  iconName: z
    .enum([
      "speaker",
      "subwoofer",
      "mic",
      "music",
      "sparkles",
      "tablet",
      "monitor",
      "wrench",
      "stand",
      "cable",
    ])
    .optional(),
});

export const savePackageSchema = z.object({
  id: z.string().uuid(),
  version: z.number().int().min(0),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens only."),
  tagline: z.string().trim().max(180),
  description: z.string().trim().min(20).max(3000),
  price4Hours: z.number().min(0).max(1_000_000),
  price8Hours: z.number().min(0).max(1_000_000),
  priceFullDay: z.number().min(0).max(1_000_000),
  featuredImageUrl: z.string().url().max(2000),
  galleryUrls: z.array(z.string().url().max(2000)).max(12),
  maxGuests: z.string().trim().max(80),
  soundRating: z.string().trim().max(80),
  inclusions: z.array(packageInclusionSchema).min(1).max(30),
  isFeatured: z.boolean(),
  isPopular: z.boolean(),
  isPublished: z.boolean(),
});

export type SavePackageInput = z.infer<typeof savePackageSchema>;
