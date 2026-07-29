import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPackageBySlug, getPublishedPackages } from "@/queries/packages.queries";
import { formatPHP } from "@/utils/currency";
import { InclusionsList } from "@/components/marketing/InclusionsList";
import { AvailabilityChecker } from "@/components/marketing/AvailabilityChecker";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Volume2, ShieldCheck, Sparkles } from "lucide-react";

interface PackageDetailPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PackageDetailPageProps) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  if (!pkg) return { title: "Package Not Found" };

  return {
    title: `${pkg.name} | KYU Rentals`,
    description: pkg.description,
  };
}

export async function generateStaticParams() {
  const pkgs = await getPublishedPackages();
  return pkgs.map((p) => ({ slug: p.slug }));
}

export default async function PackageDetailPage({ params }: PackageDetailPageProps) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);

  if (!pkg) {
    notFound();
  }

  const deposit4Hours = Math.round(pkg.price4Hours * 0.3);

  return (
    <div className="py-8 sm:py-12 md:py-16">
      <div className="container mx-auto px-4">
        {/* Responsive Back Link with 44px+ Touch Target */}
        <Link
          href="/packages"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-primary mb-6 sm:mb-8 min-h-[44px] px-1 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Packages
        </Link>

        {/* Responsive Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12">
          {/* Left Column: Image & Equipment Details */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            <div className="relative h-64 sm:h-80 md:h-96 w-full overflow-hidden rounded-2xl sm:rounded-3xl border bg-muted shadow-xs">
              <Image
                src={pkg.featuredImageUrl}
                alt={pkg.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            </div>

            {/* Title Header with Responsive Flex Wrap */}
            <div>
              <div className="flex flex-wrap items-baseline gap-2.5 sm:gap-3">
                <h1 className="font-outfit text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                  {pkg.name}
                </h1>
                {pkg.isPopular && (
                  <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-extrabold text-white uppercase tracking-wider shadow-xs">
                    MOST POPULAR
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs sm:text-base text-muted-foreground leading-relaxed">{pkg.tagline}</p>
            </div>

            {/* Accessible Spec Badges */}
            <div className="flex flex-wrap gap-3 sm:gap-4 py-4 border-y">
              {pkg.maxGuests && (
                <div
                  className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground bg-secondary/40 px-3 py-1.5 rounded-lg border"
                  aria-label={`Guest capacity: ${pkg.maxGuests}`}
                >
                  <Users className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                  <span>{pkg.maxGuests}</span>
                </div>
              )}
              {pkg.soundRating && (
                <div
                  className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground bg-secondary/40 px-3 py-1.5 rounded-lg border"
                  aria-label={`Sound rating: ${pkg.soundRating}`}
                >
                  <Volume2 className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                  <span>{pkg.soundRating}</span>
                </div>
              )}
              <div
                className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-foreground bg-secondary/40 px-3 py-1.5 rounded-lg border"
                aria-label="Equipment condition: Sanitized and Tested"
              >
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                <span>Sanitized & Tested</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="font-outfit text-lg sm:text-xl font-bold mb-2.5">About This Setup</h3>
              <p className="text-xs sm:text-base text-muted-foreground leading-relaxed font-sans">{pkg.description}</p>
            </div>

            {/* Equipment Inclusions */}
            <div>
              <h3 className="font-outfit text-lg sm:text-xl font-bold mb-3">Complete Equipment Inclusions</h3>
              <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-xs">
                <InclusionsList inclusions={pkg.inclusions} />
              </div>
            </div>
          </div>

          {/* Right Column: Pricing & Booking Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-24 rounded-2xl sm:rounded-3xl border bg-card p-4 sm:p-6 shadow-xs space-y-5 sm:space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rental Pricing</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-muted-foreground">4-Hour Standard Rate</span>
                  <span className="font-outfit text-2xl sm:text-3xl font-extrabold text-primary">{formatPHP(pkg.price4Hours)}</span>
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">8 Hours Rate:</span>
                  <span className="font-bold">{formatPHP(pkg.price8Hours)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-muted-foreground">Full Day Rate:</span>
                  <span className="font-bold">{formatPHP(pkg.priceFullDay)}</span>
                </div>
              </div>

              {/* Prominent 30% Deposit Due Highlight Card */}
              <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4 space-y-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-extrabold text-primary uppercase tracking-wider">30% Reservation Deposit</span>
                  <span className="font-outfit text-xl font-extrabold text-primary">{formatPHP(deposit4Hours)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Required upon checkout to lock event date & inventory. Remaining 70% balance collected on setup delivery.
                </p>
              </div>

              {/* Availability Checker Widget */}
              <AvailabilityChecker packageId={pkg.id} packageName={pkg.name} />

              {/* Book Now Button */}
              <Button asChild size="lg" className="w-full h-12 min-h-[44px] text-sm sm:text-base font-bold transition-all">
                <Link href={`/packages/${pkg.slug}/book`}>Proceed to Reserve Date</Link>
              </Button>

              <p className="text-center text-xs text-muted-foreground leading-relaxed">
                <Sparkles className="inline-block h-3.5 w-3.5 text-amber-500 mr-1 shrink-0" aria-hidden="true" />
                30% non-refundable reservation deposit.{" "}
                <Link href="/policies/cancellation" className="font-semibold underline underline-offset-2 hover:text-primary">
                  View policy
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
