import Link from "next/link";
import Image from "next/image";
import { RentalPackage } from "@/queries/packages.queries";
import { formatPHP } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { InclusionsList } from "./InclusionsList";
import { Users, Volume2 } from "lucide-react";

interface PackageCardProps {
  pkg: RentalPackage;
}

export function PackageCard({ pkg }: PackageCardProps) {
  return (
    <div className={`group relative flex flex-col rounded-2xl border bg-card overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md ${pkg.isPopular ? "border-amber-500/50 ring-1 ring-amber-500/20" : ""}`}>
      {pkg.isPopular && (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-bold text-white shadow-xs">
          MOST POPULAR
        </div>
      )}

      {/* Package Image */}
      <div className="relative h-48 w-full overflow-hidden bg-muted">
        <Image
          src={pkg.featuredImageUrl}
          alt={pkg.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium">
          {pkg.maxGuests && (
            <span className="flex items-center gap-1 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-md">
              <Users className="h-3.5 w-3.5" />
              {pkg.maxGuests}
            </span>
          )}
          {pkg.soundRating && (
            <span className="flex items-center gap-1 bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-md">
              <Volume2 className="h-3.5 w-3.5" />
              {pkg.soundRating}
            </span>
          )}
        </div>
      </div>

      {/* Package Content */}
      <div className="flex flex-1 flex-col p-6">
        <div>
          <h3 className="font-outfit text-2xl font-bold tracking-tight text-foreground">{pkg.name}</h3>
          <p className="mt-1 text-xs font-medium text-muted-foreground leading-relaxed">{pkg.tagline}</p>
        </div>

        {/* Pricing Summary */}
        <div className="my-5 rounded-xl bg-secondary/50 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">4-Hour Rental</span>
            <span className="font-outfit text-2xl font-extrabold text-primary">{formatPHP(pkg.price4Hours)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
            <span>8 Hours: <strong className="text-foreground">{formatPHP(pkg.price8Hours)}</strong></span>
            <span>Full Day: <strong className="text-foreground">{formatPHP(pkg.priceFullDay)}</strong></span>
          </div>
        </div>

        {/* Inclusions */}
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">What&apos;s Included:</p>
          <InclusionsList inclusions={pkg.inclusions} />
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t">
          <Button asChild className="w-full h-11 text-base font-semibold" variant={pkg.isPopular ? "default" : "outline"}>
            <Link href={`/packages/${pkg.slug}`}>View Package & Book</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
