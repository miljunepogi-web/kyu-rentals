"use client";

import { useState } from "react";
import { RentalPackage } from "@/queries/packages.queries";
import { PackageCard } from "./PackageCard";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

interface PackageGridProps {
  packages: RentalPackage[];
}

export function PackageGrid({ packages }: PackageGridProps) {
  const [filter, setFilter] = useState<"all" | "featured">("all");

  const filteredPackages = filter === "featured" ? packages.filter((p) => p.isFeatured) : packages;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Accessible Category Tabs with 44px+ Touch Targets */}
      <div
        role="tablist"
        aria-label="Package category filters"
        className="flex flex-wrap justify-center gap-2.5 sm:gap-3"
      >
        <Button
          role="tab"
          aria-selected={filter === "all"}
          aria-controls="package-grid-list"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
          className="min-h-[44px] h-11 rounded-full px-5 sm:px-6 font-bold text-xs sm:text-sm cursor-pointer transition-all"
        >
          All Packages ({packages.length})
        </Button>
        <Button
          role="tab"
          aria-selected={filter === "featured"}
          aria-controls="package-grid-list"
          variant={filter === "featured" ? "default" : "outline"}
          onClick={() => setFilter("featured")}
          className="min-h-[44px] h-11 rounded-full px-5 sm:px-6 font-bold text-xs sm:text-sm cursor-pointer transition-all gap-1.5"
        >
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
          Featured Setups
        </Button>
      </div>

      {/* Package Grid or Accessible Empty State */}
      {filteredPackages.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-3xl border bg-card p-8 sm:p-12 text-center max-w-md mx-auto space-y-3"
        >
          <p className="font-outfit text-lg font-bold text-foreground">No Featured Setups Available</p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            There are currently no packages flagged under featured setups. Please view all available packages.
          </p>
          <Button
            variant="outline"
            onClick={() => setFilter("all")}
            className="min-h-[44px] h-11 px-6 font-bold text-xs sm:text-sm mt-2"
          >
            Show All Packages ({packages.length})
          </Button>
        </div>
      ) : (
        <div id="package-grid-list" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {filteredPackages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}
