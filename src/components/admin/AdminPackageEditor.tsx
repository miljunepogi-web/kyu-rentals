"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  type AdminPackageItem,
  savePackageAction,
} from "@/actions/admin-package.actions";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

interface AdminPackageEditorProps {
  tenantId: string;
  initialPackage: AdminPackageItem | null;
  onClose: () => void;
  onSaved: (item: AdminPackageItem) => void;
}

const ICON_OPTIONS = [
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
] as const;

function createDraft(tenantId: string): AdminPackageItem {
  return {
    id: crypto.randomUUID(),
    tenantId,
    version: 0,
    name: "",
    slug: "",
    tagline: "",
    description: "",
    price4Hours: 0,
    price8Hours: 0,
    priceFullDay: 0,
    featuredImageUrl: "",
    galleryUrls: [],
    maxGuests: "",
    soundRating: "",
    inclusions: [
      {
        id: crypto.randomUUID(),
        name: "",
        quantity: 1,
        iconName: "speaker",
      },
    ],
    isFeatured: false,
    isPopular: false,
    isPublished: false,
    isDeleted: false,
    updatedAt: new Date().toISOString(),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function AdminPackageEditor({
  tenantId,
  initialPackage,
  onClose,
  onSaved,
}: AdminPackageEditorProps) {
  const [draft, setDraft] = useState<AdminPackageItem>(() =>
    initialPackage ? structuredClone(initialPackage) : createDraft(tenantId),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const previewUrl = useMemo(
    () => (imageFile ? URL.createObjectURL(imageFile) : draft.featuredImageUrl),
    [draft.featuredImageUrl, imageFile],
  );

  useEffect(() => {
    return () => {
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const update = <K extends keyof AdminPackageItem>(
    key: K,
    value: AdminPackageItem[K],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const handleNameChange = (name: string) => {
    setDraft((current) => ({
      ...current,
      name,
      slug: current.version === 0 ? slugify(name) : current.slug,
    }));
  };

  const updateInclusion = (
    index: number,
    patch: Partial<AdminPackageItem["inclusions"][number]>,
  ) => {
    setDraft((current) => ({
      ...current,
      inclusions: current.inclusions.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const removeInclusion = (index: number) => {
    setDraft((current) => ({
      ...current,
      inclusions: current.inclusions.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const addInclusion = () => {
    setDraft((current) => ({
      ...current,
      inclusions: [
        ...current.inclusions,
        {
          id: crypto.randomUUID(),
          name: "",
          quantity: 1,
          iconName: "speaker",
        },
      ],
    }));
  };

  const handleImageSelection = (file: File | null) => {
    setError(null);
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use a JPG, PNG, or WebP product image.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Product image must be 8 MB or smaller.");
      return;
    }
    setImageFile(file);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!draft.featuredImageUrl && !imageFile) {
      setError("Upload a real product image or provide an image URL.");
      return;
    }

    setIsSaving(true);
    let uploadedPath: string | null = null;
    let featuredImageUrl = draft.featuredImageUrl;

    if (imageFile) {
      const extension =
        imageFile.type === "image/png"
          ? "png"
          : imageFile.type === "image/webp"
            ? "webp"
            : "jpg";
      uploadedPath = `${tenantId}/${draft.id}/${crypto.randomUUID()}.${extension}`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("package-images")
        .upload(uploadedPath, imageFile, {
          cacheControl: "3600",
          contentType: imageFile.type,
          upsert: false,
        });

      if (uploadError) {
        setError(uploadError.message || "Product image upload failed.");
        setIsSaving(false);
        return;
      }

      featuredImageUrl = supabase.storage
        .from("package-images")
        .getPublicUrl(uploadedPath).data.publicUrl;
    }

    const galleryUrls = Array.from(
      new Set([featuredImageUrl, ...draft.galleryUrls].filter(Boolean)),
    );
    const result = await savePackageAction({
      ...draft,
      featuredImageUrl,
      galleryUrls,
    });

    if (!result.success || !result.data) {
      if (uploadedPath) {
        await createClient().storage.from("package-images").remove([uploadedPath]);
      }
      setError(result.error || "Package could not be saved.");
      setIsSaving(false);
      return;
    }

    setDraft(result.data);
    setImageFile(null);
    setSuccess("Package saved. Published catalog changes are now live.");
    setIsSaving(false);
    onSaved(result.data);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l bg-card shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-card px-5 py-4">
          <div>
            <h2 className="font-outfit text-xl font-bold">
              {draft.version === 0 ? "Create Rental Package" : "Edit Rental Package"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Version {draft.version || "new"}
            </p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} title="Close editor">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-7 p-5 md:p-7">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 rounded-md border border-green-500/20 bg-green-500/10 p-3 text-xs font-semibold text-green-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {success}
            </div>
          )}

          <section className="space-y-4">
            <h3 className="border-b pb-2 text-sm font-bold">Product Identity</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="package-name">Package Name</Label>
                <Input
                  id="package-name"
                  value={draft.name}
                  onChange={(event) => handleNameChange(event.target.value)}
                  disabled={isSaving}
                  required
                />
              </div>
              <div>
                <Label htmlFor="package-slug">Public URL Slug</Label>
                <Input
                  id="package-slug"
                  value={draft.slug}
                  onChange={(event) => update("slug", slugify(event.target.value))}
                  disabled={isSaving}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="package-tagline">Tagline</Label>
              <Input
                id="package-tagline"
                value={draft.tagline}
                onChange={(event) => update("tagline", event.target.value)}
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="package-description">Description</Label>
              <textarea
                id="package-description"
                value={draft.description}
                onChange={(event) => update("description", event.target.value)}
                disabled={isSaving}
                required
                rows={5}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="border-b pb-2 text-sm font-bold">Rental Pricing</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["price4Hours", "4 Hours"],
                  ["price8Hours", "8 Hours"],
                  ["priceFullDay", "Full Day"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <Label htmlFor={key}>{label} (PHP)</Label>
                  <Input
                    id={key}
                    type="number"
                    min={0}
                    step="0.01"
                    value={draft[key]}
                    onChange={(event) => update(key, Number(event.target.value))}
                    disabled={isSaving}
                    required
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="border-b pb-2 text-sm font-bold">Real Product Image</h3>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="relative aspect-square overflow-hidden rounded-md border bg-muted">
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt={draft.name || "Product preview"}
                    fill
                    className="object-cover"
                    unoptimized={previewUrl.startsWith("blob:")}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImagePlus className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="package-image-file">Upload Image</Label>
                  <Input
                    id="package-image-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      handleImageSelection(event.target.files?.[0] || null)
                    }
                    disabled={isSaving}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    JPG, PNG, or WebP. Maximum 8 MB.
                  </p>
                </div>
                <div>
                  <Label htmlFor="package-image-url">Or Existing Image URL</Label>
                  <Input
                    id="package-image-url"
                    type="url"
                    value={draft.featuredImageUrl}
                    onChange={(event) => update("featuredImageUrl", event.target.value)}
                    disabled={isSaving || Boolean(imageFile)}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold">Equipment Inclusions</h3>
              <Button type="button" variant="outline" size="sm" onClick={addInclusion}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add
              </Button>
            </div>
            <div className="space-y-3">
              {draft.inclusions.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-md border p-3 sm:grid-cols-[80px_1fr_130px_36px]"
                >
                  <div>
                    <Label htmlFor={`inclusion-quantity-${item.id}`}>Qty</Label>
                    <Input
                      id={`inclusion-quantity-${item.id}`}
                      type="number"
                      min={1}
                      max={99}
                      value={item.quantity}
                      onChange={(event) =>
                        updateInclusion(index, { quantity: Number(event.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor={`inclusion-name-${item.id}`}>Item</Label>
                    <Input
                      id={`inclusion-name-${item.id}`}
                      value={item.name}
                      onChange={(event) =>
                        updateInclusion(index, { name: event.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`inclusion-icon-${item.id}`}>Icon</Label>
                    <select
                      id={`inclusion-icon-${item.id}`}
                      value={item.iconName || "cable"}
                      onChange={(event) =>
                        updateInclusion(index, {
                          iconName: event.target
                            .value as AdminPackageItem["inclusions"][number]["iconName"],
                        })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                    >
                      {ICON_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-end"
                    onClick={() => removeInclusion(index)}
                    disabled={draft.inclusions.length === 1}
                    title="Remove inclusion"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="border-b pb-2 text-sm font-bold">Catalog Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="package-guests">Guest Capacity</Label>
                <Input
                  id="package-guests"
                  value={draft.maxGuests}
                  onChange={(event) => update("maxGuests", event.target.value)}
                  placeholder="e.g. 10-20 Guests"
                />
              </div>
              <div>
                <Label htmlFor="package-sound">Sound Rating</Label>
                <Input
                  id="package-sound"
                  value={draft.soundRating}
                  onChange={(event) => update("soundRating", event.target.value)}
                  placeholder="e.g. 500 Watts"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["isPublished", "Published"],
                  ["isFeatured", "Featured"],
                  ["isPopular", "Popular badge"],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-xs font-semibold"
                >
                  <input
                    type="checkbox"
                    checked={draft[key]}
                    onChange={(event) => update(key, event.target.checked)}
                    disabled={isSaving}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>

          <div className="sticky bottom-0 flex gap-3 border-t bg-card py-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save Package"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
