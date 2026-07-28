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
    <div
      className={`group relative flex flex-col rounded-2xl sm:rounded-3xl border bg-card overflow-hidden shadow-xs transition-all duration-300 hover:shadow-md ${
        pkg.isPopular ? "border-amber-500/50 ring-1 ring-amber-500/20" : ""
      }`}
    >
      {pkg.isPopular && (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-amber-500 px-3 py-1 text-[11px] font-extrabold text-white shadow-xs tracking-wider uppercase">
          MOST POPULAR
        </div>
      )}

      {/* Package Image */}
      <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-muted">
        <Image
          src={pkg.featuredImageUrl}
          alt={pkg.name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
        {/* Background gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />

        {/* Spec Badges */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium">
          {pkg.maxGuests && (
            <span
              className="flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-semibold"
              aria-label={`Capacity: ${pkg.maxGuests}`}
            >
              <Users className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              <span>{pkg.maxGuests}</span>
            </span>
          )}
          {pkg.soundRating && (
            <span
              className="flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-semibold"
              aria-label={`Sound rating: ${pkg.soundRating}`}
            >
              <Volume2 className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
              <span>{pkg.soundRating}</span>
            </span>
          )}
        </div>
      </div>

      {/* Package Content */}
      <div className="flex flex-1 flex-col p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="font-outfit text-xl sm:text-2xl font-bold tracking-tight text-foreground">{pkg.name}</h3>
          <p className="mt-1 text-xs sm:text-sm font-medium text-muted-foreground leading-relaxed">{pkg.tagline}</p>
        </div>

        {/* Pricing Summary Box */}
        <div className="rounded-xl bg-secondary/50 p-3.5 sm:p-4 border space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">4-Hour Standard</span>
            <span className="font-outfit text-xl sm:text-2xl font-extrabold text-primary">{formatPHP(pkg.price4Hours)}</span>
          </div>
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <span>8 Hours: <strong className="text-foreground font-bold">{formatPHP(pkg.price8Hours)}</strong></span>
            <span>Full Day: <strong className="text-foreground font-bold">{formatPHP(pkg.priceFullDay)}</strong></span>
          </div>
        </div>

        {/* Inclusions List */}
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">What&apos;s Included:</p>
          <InclusionsList inclusions={pkg.inclusions} />
        </div>

        {/* Action Button */}
        <div className="pt-3 border-t">
          <Button
            asChild
            className="w-full h-11 sm:h-12 min-h-[44px] text-sm sm:text-base font-bold transition-all focus-visible:ring-2 focus-visible:ring-primary"
            variant={pkg.isPopular ? "default" : "outline"}
          >
            <Link href={`/packages/${pkg.slug}`}>View Package & Book</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
