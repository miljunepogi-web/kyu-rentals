"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  type AdminPackageItem,
  getAdminPackagesAction,
  setPackageArchivedAction,
} from "@/actions/admin-package.actions";
import { AdminPackageEditor } from "@/components/admin/AdminPackageEditor";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Archive,
  ExternalLink,
  Package,
  Pencil,
  Plus,
  RotateCcw,
} from "lucide-react";
import { formatPHP } from "@/utils/currency";

export default function AdminPackagesPage() {
  const [packages, setPackages] = useState<AdminPackageItem[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<AdminPackageItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [busyPackageId, setBusyPackageId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getAdminPackagesAction().then((result) => {
      if (!isMounted) return;
      if (!result.success || !result.data) {
        setError(result.error || "Package catalog could not be loaded.");
        setIsLoading(false);
        return;
      }
      setTenantId(result.data.tenantId);
      setPackages(result.data.packages);
      setIsLoading(false);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaved = (item: AdminPackageItem) => {
    setPackages((current) => {
      const exists = current.some((entry) => entry.id === item.id);
      return exists
        ? current.map((entry) => (entry.id === item.id ? item : entry))
        : [...current, item];
    });
    setSelectedPackage(item);
    setIsCreating(false);
  };

  const handleArchive = async (item: AdminPackageItem) => {
    const archive = !item.isDeleted;
    const confirmed = window.confirm(
      archive
        ? `Archive "${item.name}"? It will disappear from new customer bookings.`
        : `Restore "${item.name}" to the admin catalog? It will remain unpublished until you edit it.`,
    );
    if (!confirmed) return;

    setBusyPackageId(item.id);
    setError(null);
    const result = await setPackageArchivedAction(item.id, item.version, archive);
    if (!result.success || !result.data) {
      setError(result.error || "Package status could not be changed.");
      setBusyPackageId(null);
      return;
    }
    setPackages((current) =>
      current.map((entry) => (entry.id === item.id ? result.data! : entry)),
    );
    setBusyPackageId(null);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase text-primary">Catalog Management</span>
          <h1 className="mt-1 font-outfit text-3xl font-bold">Rental Packages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage real products, pricing, images, inclusions, and publication status.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/packages" target="_blank">
              <ExternalLink className="mr-2 h-4 w-4" />
              Public Catalog
            </Link>
          </Button>
          <Button onClick={() => setIsCreating(true)} disabled={!tenantId}>
            <Plus className="mr-2 h-4 w-4" />
            New Package
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs font-semibold text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">
          Loading package catalog...
        </div>
      ) : packages.length === 0 ? (
        <div className="border-y py-20 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 font-bold">No rental packages yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create the first real product for customer bookings.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {packages.map((item) => (
            <article
              key={item.id}
              className={`overflow-hidden rounded-lg border bg-card ${
                item.isDeleted ? "opacity-65" : ""
              }`}
            >
              <div className="relative aspect-[16/9] bg-muted">
                {item.featuredImageUrl ? (
                  <Image
                    src={item.featuredImageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Package className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute left-3 top-3 flex gap-1">
                  <span
                    className={`rounded px-2 py-1 text-[10px] font-bold ${
                      item.isDeleted
                        ? "bg-zinc-800 text-white"
                        : item.isPublished
                          ? "bg-green-600 text-white"
                          : "bg-amber-500 text-black"
                    }`}
                  >
                    {item.isDeleted ? "ARCHIVED" : item.isPublished ? "LIVE" : "DRAFT"}
                  </span>
                </div>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-outfit text-lg font-bold">{item.name}</h2>
                      <p className="truncate text-xs text-muted-foreground">/{item.slug}</p>
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      v{item.version}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
                    {item.tagline || item.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 border-y py-3 text-center">
                  <div>
                    <span className="block text-[10px] text-muted-foreground">4 Hours</span>
                    <strong className="text-xs">{formatPHP(item.price4Hours)}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground">8 Hours</span>
                    <strong className="text-xs">{formatPHP(item.price8Hours)}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-muted-foreground">Full Day</span>
                    <strong className="text-xs">{formatPHP(item.priceFullDay)}</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {item.inclusions.length} inclusions
                  </span>
                  <div className="flex gap-1">
                    {!item.isDeleted && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPackage(item)}
                        title="Edit package"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleArchive(item)}
                      disabled={busyPackageId === item.id}
                      title={item.isDeleted ? "Restore package" : "Archive package"}
                    >
                      {item.isDeleted ? (
                        <RotateCcw className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {(selectedPackage || isCreating) && tenantId && (
        <AdminPackageEditor
          tenantId={tenantId}
          initialPackage={isCreating ? null : selectedPackage}
          onClose={() => {
            setSelectedPackage(null);
            setIsCreating(false);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
