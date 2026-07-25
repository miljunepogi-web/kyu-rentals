"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  AdminInventoryUnit,
  getAdminInventoryUnits,
  InventoryUnitStatus,
} from "@/queries/admin-inventory.queries";
import { AdminInventoryUnitSheet } from "@/components/admin/AdminInventoryUnitSheet";
import { AdminCreateUnitForm } from "@/components/admin/AdminCreateUnitForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Box } from "lucide-react";

// ---------------------------------------------------------------------------
// Status display config
// ---------------------------------------------------------------------------

type StatusFilter = "ALL" | InventoryUnitStatus;

const STATUS_TABS: { label: string; value: StatusFilter }[] = [
  { label: "All Units", value: "ALL" },
  { label: "Ready to Deploy", value: "READY_TO_DEPLOY" },
  { label: "In Use", value: "IN_USE" },
  { label: "Under Repair", value: "UNDER_REPAIR" },
  { label: "Retired", value: "RETIRED" },
];

const STATUS_BADGE: Record<InventoryUnitStatus, string> = {
  READY_TO_DEPLOY: "bg-green-500/10 text-green-600 border-green-500/20",
  IN_USE: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  UNDER_REPAIR: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  RETIRED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

const STATUS_ICON: Record<InventoryUnitStatus, string> = {
  READY_TO_DEPLOY: "✓",
  IN_USE: "🎤",
  UNDER_REPAIR: "🔧",
  RETIRED: "◦",
};

const STATUS_LABELS: Record<InventoryUnitStatus, string> = {
  READY_TO_DEPLOY: "Ready to Deploy",
  IN_USE: "In Use",
  UNDER_REPAIR: "Under Repair",
  RETIRED: "Retired",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminInventoryPage() {
  const searchParams = useSearchParams();
  const [units, setUnits] = useState<AdminInventoryUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(
    () => searchParams.get("action") === "new"
  );

  const loadUnits = useCallback((): Promise<void> => {
    setIsLoading(true);
    return getAdminInventoryUnits(statusFilter).then((data) => {
      setUnits(data);
      setIsLoading(false);
    });
  }, [statusFilter]);

  useEffect(() => {
    let isMounted = true;
    getAdminInventoryUnits(statusFilter).then((data) => {
      if (isMounted) {
        setUnits(data);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [statusFilter]);

  const filteredUnits = units.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.serialNumber.toLowerCase().includes(q) ||
      u.publicId.toLowerCase().includes(q) ||
      u.packageName.toLowerCase().includes(q)
    );
  });

  const hasActiveSearch = search.trim() !== "";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between border-b pb-6">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">Fleet Management</span>
          <h1 className="font-outfit text-3xl font-bold tracking-tight mt-1">Inventory Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage physical equipment units and their lifecycle status.
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="gap-2 font-bold h-10 px-5"
          id="add-inventory-unit-btn"
        >
          <Plus className="h-4 w-4" />
          Add Unit
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            id={`filter-tab-${tab.value.toLowerCase()}`}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              statusFilter === tab.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="inventory-search"
          placeholder="Search serial, ID, or package..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 text-sm"
        />
      </div>

      {/* Inventory Table */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" role="grid">
            <thead>
              <tr className="bg-secondary/50 border-b">
                <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Public ID
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Serial Number
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">
                  Package
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">
                  Condition Notes
                </th>
                <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">
                  Last Updated
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-16 text-muted-foreground text-xs font-medium">
                    Loading inventory units...
                  </td>
                </tr>
              ) : filteredUnits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    {hasActiveSearch ? (
                      <div className="space-y-2">
                        <Box className="h-8 w-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-bold text-foreground">No units match your search</p>
                        <p className="text-xs text-muted-foreground">Try a different serial number or ID.</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => setSearch("")}>
                          Clear Search
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3 max-w-xs mx-auto">
                        <Box className="h-10 w-10 text-muted-foreground mx-auto opacity-30" />
                        <p className="text-sm font-bold text-foreground">No equipment units registered yet</p>
                        <p className="text-xs text-muted-foreground">
                          Add your first karaoke setup unit to start tracking deployment status and availability.
                        </p>
                        <Button onClick={() => setShowCreateForm(true)} className="gap-2 mt-1" size="sm">
                          <Plus className="h-3.5 w-3.5" /> Add First Unit
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                filteredUnits.map((unit, idx) => (
                  <tr
                    key={unit.id}
                    id={`inventory-row-${unit.id}`}
                    onClick={() => setSelectedUnitId(unit.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedUnitId(unit.id);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View details for unit ${unit.serialNumber}`}
                    className={`border-b last:border-b-0 cursor-pointer transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${
                      idx % 2 === 0 ? "bg-background" : "bg-secondary/10"
                    }`}
                  >
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-primary">
                      {unit.publicId}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs font-bold text-foreground">
                      {unit.serialNumber}
                    </td>
                    <td className="px-5 py-4 text-xs text-foreground font-medium hidden sm:table-cell">
                      {unit.packageName}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${STATUS_BADGE[unit.status]}`}>
                        {STATUS_ICON[unit.status]} {STATUS_LABELS[unit.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground max-w-xs truncate hidden md:table-cell">
                      {unit.conditionNotes || "—"}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground hidden lg:table-cell">
                      {new Date(unit.updatedAt).toLocaleDateString("en-PH", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unit Detail Sheet */}
      {selectedUnitId && (
        <AdminInventoryUnitSheet
          unitId={selectedUnitId}
          onClose={() => setSelectedUnitId(null)}
          onRefresh={loadUnits}
        />
      )}

      {/* Create Unit Form */}
      {showCreateForm && (
        <AdminCreateUnitForm
          onClose={() => setShowCreateForm(false)}
          onSuccess={loadUnits}
        />
      )}
    </div>
  );
}
