import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { Database, Json } from "@/types/supabase";
import { logger } from "@/utils/logger";

export interface PackageInclusion {
  id: string;
  name: string;
  quantity: number;
  iconName?: string;
}

export interface RentalPackage {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  price4Hours: number;
  price8Hours: number;
  priceFullDay: number;
  featuredImageUrl: string;
  galleryUrls: string[];
  inclusions: PackageInclusion[];
  isFeatured: boolean;
  isPopular?: boolean;
  maxGuests?: string;
  soundRating?: string;
  version: number;
}

type PackageRow = Pick<
  Database["public"]["Tables"]["packages"]["Row"],
  | "id"
  | "slug"
  | "name"
  | "tagline"
  | "description"
  | "price_4_hours"
  | "price_8_hours"
  | "price_full_day"
  | "featured_image_url"
  | "gallery_urls"
  | "inclusions"
  | "is_featured"
  | "is_popular"
  | "max_guests"
  | "sound_rating"
  | "version"
>;

function createPublicCatalogClient() {
  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            cache: "no-store",
          }),
      },
    },
  );
}

function isInclusion(value: unknown): value is PackageInclusion {
  if (!value || typeof value !== "object") return false;
  const inclusion = value as Record<string, unknown>;
  return (
    typeof inclusion.id === "string" &&
    typeof inclusion.name === "string" &&
    typeof inclusion.quantity === "number" &&
    inclusion.quantity > 0 &&
    (inclusion.iconName === undefined || typeof inclusion.iconName === "string")
  );
}

function parseInclusions(value: Json): PackageInclusion[] {
  if (!Array.isArray(value)) return [];
  return (value as unknown[]).filter(isInclusion);
}

function mapPackage(row: PackageRow): RentalPackage {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline || "",
    description: row.description || "",
    price4Hours: Number(row.price_4_hours),
    price8Hours: Number(row.price_8_hours),
    priceFullDay: Number(row.price_full_day),
    featuredImageUrl: row.featured_image_url || "/package-placeholder.jpg",
    galleryUrls: row.gallery_urls || [],
    inclusions: parseInclusions(row.inclusions),
    isFeatured: row.is_featured,
    isPopular: row.is_popular,
    maxGuests: row.max_guests || undefined,
    soundRating: row.sound_rating || undefined,
    version: row.version,
  };
}

const PACKAGE_SELECT = [
  "id",
  "slug",
  "name",
  "tagline",
  "description",
  "price_4_hours",
  "price_8_hours",
  "price_full_day",
  "featured_image_url",
  "gallery_urls",
  "inclusions",
  "is_featured",
  "is_popular",
  "max_guests",
  "sound_rating",
  "version",
].join(",");

export async function getPublishedPackages(): Promise<RentalPackage[]> {
  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("packages")
    .select(PACKAGE_SELECT)
    .eq("is_published", true)
    .eq("is_deleted", false)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("Published package catalog query failed", { error });
    return [];
  }

  return ((data || []) as unknown as PackageRow[]).map(mapPackage);
}

export async function getPackageBySlug(slug: string): Promise<RentalPackage | null> {
  const supabase = createPublicCatalogClient();
  const { data, error } = await supabase
    .from("packages")
    .select(PACKAGE_SELECT)
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error) {
    logger.error("Published package lookup failed", { slug, error });
    return null;
  }

  return data ? mapPackage(data as unknown as PackageRow) : null;
}
