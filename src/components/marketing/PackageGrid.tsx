"use client";

import { useState } from "react";
import { RentalPackage } from "@/queries/packages.queries";
import { PackageCard } from "./PackageCard";
import { Button } from "@/components/ui/button";

interface PackageGridProps {
  packages: RentalPackage[];
}

export function PackageGrid({ packages }: PackageGridProps) {
  const [filter, setFilter] = useState<"all" | "featured">("all");

  const filteredPackages = filter === "featured" ? packages.filter((p) => p.isFeatured) : packages;

  return (
    <div className="space-y-8">
      {/* Category Tabs */}
      <div className="flex justify-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          className="rounded-full px-6"
        >
          All Packages ({packages.length})
        </Button>
        <Button
          variant={filter === "featured" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("featured")}
          className="rounded-full px-6"
        >
          Featured Setups
        </Button>
      </div>

      {/* Package Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredPackages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} />
        ))}
      </div>
    </div>
  );
}
