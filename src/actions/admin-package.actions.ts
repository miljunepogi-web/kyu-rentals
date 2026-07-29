"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  savePackageSchema,
  type SavePackageInput,
} from "@/schemas/package.schema";
import type { Json } from "@/types/supabase";

export interface AdminPackageItem extends SavePackageInput {
  tenantId: string;
  isDeleted: boolean;
  updatedAt: string;
}

export interface AdminPackageResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

async function resolveCatalogManager(): Promise<
  | { success: true; userId: string; tenantId: string }
  | { success: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized: Please sign in again." };
  }

  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .eq("is_active", true)
    .eq("is_deleted", false)
    .maybeSingle();
  const profile = profileData as { tenant_id: string } | null;

  if (profileError || !profile?.tenant_id) {
    return { success: false, error: "Unable to resolve your active tenant profile." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allowed, error: permissionError } = await (supabase.rpc as any)(
    "has_permission",
    {
      p_permission_key: "catalog.manage",
      p_tenant_id: profile.tenant_id,
    },
  );

  if (permissionError || allowed !== true) {
    return { success: false, error: "Forbidden: Catalog management permission is required." };
  }

  return { success: true, userId: user.id, tenantId: profile.tenant_id };
}

function mapPackage(row: Record<string, unknown>): AdminPackageItem {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    version: Number(row.version),
    name: String(row.name),
    slug: String(row.slug),
    tagline: String(row.tagline || ""),
    description: String(row.description || ""),
    price4Hours: Number(row.price_4_hours),
    price8Hours: Number(row.price_8_hours),
    priceFullDay: Number(row.price_full_day),
    featuredImageUrl: String(row.featured_image_url || ""),
    galleryUrls: Array.isArray(row.gallery_urls)
      ? row.gallery_urls.filter((url): url is string => typeof url === "string")
      : [],
    maxGuests: String(row.max_guests || ""),
    soundRating: String(row.sound_rating || ""),
    inclusions: Array.isArray(row.inclusions)
      ? (row.inclusions as SavePackageInput["inclusions"])
      : [],
    isFeatured: row.is_featured === true,
    isPopular: row.is_popular === true,
    isPublished: row.is_published === true,
    isDeleted: row.is_deleted === true,
    updatedAt: String(row.updated_at),
  };
}

const ADMIN_PACKAGE_SELECT = [
  "id",
  "tenant_id",
  "version",
  "name",
  "slug",
  "tagline",
  "description",
  "price_4_hours",
  "price_8_hours",
  "price_full_day",
  "featured_image_url",
  "gallery_urls",
  "inclusions",
  "max_guests",
  "sound_rating",
  "is_featured",
  "is_popular",
  "is_published",
  "is_deleted",
  "updated_at",
].join(",");

export async function getAdminPackagesAction(): Promise<
  AdminPackageResult<{ tenantId: string; packages: AdminPackageItem[] }>
> {
  const session = await resolveCatalogManager();
  if (!session.success) return session;

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("packages") as any)
    .select(ADMIN_PACKAGE_SELECT)
    .eq("tenant_id", session.tenantId)
    .order("is_deleted", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return { success: false, error: error.message };

  return {
    success: true,
    data: {
      tenantId: session.tenantId,
      packages: ((data || []) as unknown as Record<string, unknown>[]).map(mapPackage),
    },
  };
}

export async function savePackageAction(
  input: SavePackageInput,
): Promise<AdminPackageResult<AdminPackageItem>> {
  const parsed = savePackageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((issue) => issue.message).join(", "),
    };
  }

  const session = await resolveCatalogManager();
  if (!session.success) return session;

  const payload = parsed.data;
  const supabase = await createClient();
  const values = {
    name: payload.name,
    slug: payload.slug,
    tagline: payload.tagline || null,
    description: payload.description,
    price_4_hours: payload.price4Hours,
    price_8_hours: payload.price8Hours,
    price_full_day: payload.priceFullDay,
    featured_image_url: payload.featuredImageUrl,
    gallery_urls: payload.galleryUrls,
    inclusions: payload.inclusions as unknown as Json,
    max_guests: payload.maxGuests || null,
    sound_rating: payload.soundRating || null,
    is_featured: payload.isFeatured,
    is_popular: payload.isPopular,
    is_published: payload.isPublished,
  };

  let saved: Record<string, unknown> | null = null;
  let error: { message: string; code?: string } | null = null;

  if (payload.version === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (supabase.from("packages") as any)
      .insert({
        id: payload.id,
        tenant_id: session.tenantId,
        ...values,
      })
      .select(ADMIN_PACKAGE_SELECT)
      .single();
    saved = response.data as unknown as Record<string, unknown> | null;
    error = response.error;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (supabase.from("packages") as any)
      .update(values)
      .eq("id", payload.id)
      .eq("tenant_id", session.tenantId)
      .eq("version", payload.version)
      .eq("is_deleted", false)
      .select(ADMIN_PACKAGE_SELECT)
      .maybeSingle();
    saved = response.data as unknown as Record<string, unknown> | null;
    error = response.error;

    if (!error && !saved) {
      return {
        success: false,
        error: "This package changed in another admin session. Reload it before saving again.",
      };
    }
  }

  if (error || !saved) {
    const duplicateSlug = error?.code === "23505";
    return {
      success: false,
      error: duplicateSlug
        ? `The slug "${payload.slug}" is already used by another package.`
        : error?.message || "Package could not be saved.",
    };
  }

  const adminSupabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminSupabase.rpc as any)("log_audit_event", {
    p_tenant_id: session.tenantId,
    p_action: payload.version === 0 ? "PACKAGE_CREATED" : "PACKAGE_UPDATED",
    p_category: "CATALOG",
    p_entity_type: "packages",
    p_entity_id: payload.id,
    p_entity_label: payload.name,
    p_performed_by: session.userId,
    p_performed_by_role: "catalog_manager",
    p_severity: "info",
    p_metadata: {
      version_before: payload.version,
      published: payload.isPublished,
    },
  });

  revalidateCatalog();
  return { success: true, data: mapPackage(saved) };
}

export async function setPackageArchivedAction(
  packageId: string,
  expectedVersion: number,
  archived: boolean,
): Promise<AdminPackageResult<AdminPackageItem>> {
  if (!packageId || !Number.isInteger(expectedVersion) || expectedVersion < 1) {
    return { success: false, error: "Invalid package archive request." };
  }

  const session = await resolveCatalogManager();
  if (!session.success) return session;

  const supabase = await createClient();
  const archiveValues = archived
    ? {
        is_deleted: true,
        is_published: false,
        deleted_at: new Date().toISOString(),
        deleted_by: session.userId,
        deletion_reason: "Archived from admin package management",
      }
    : {
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        deletion_reason: null,
      };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("packages") as any)
    .update(archiveValues)
    .eq("id", packageId)
    .eq("tenant_id", session.tenantId)
    .eq("version", expectedVersion)
    .select(ADMIN_PACKAGE_SELECT)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) {
    return {
      success: false,
      error: "This package changed in another admin session. Reload before trying again.",
    };
  }

  const item = mapPackage(data as unknown as Record<string, unknown>);
  const adminSupabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminSupabase.rpc as any)("log_audit_event", {
    p_tenant_id: session.tenantId,
    p_action: archived ? "PACKAGE_ARCHIVED" : "PACKAGE_RESTORED",
    p_category: "CATALOG",
    p_entity_type: "packages",
    p_entity_id: packageId,
    p_entity_label: item.name,
    p_performed_by: session.userId,
    p_performed_by_role: "catalog_manager",
    p_severity: "info",
    p_metadata: { version_before: expectedVersion },
  });

  revalidateCatalog();
  return { success: true, data: item };
}

function revalidateCatalog() {
  revalidatePath("/");
  revalidatePath("/packages");
  revalidatePath("/packages/[slug]", "page");
  revalidatePath("/packages/[slug]/book", "page");
  revalidatePath("/admin/packages");
}
