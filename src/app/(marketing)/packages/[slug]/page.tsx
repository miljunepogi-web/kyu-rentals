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

  return (
    <div className="py-12 md:py-16">
      <div className="container mx-auto px-4">
        {/* Back Link */}
        <Link href="/packages" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary mb-8">
          <ArrowLeft className="h-4 w-4" /> Back to Packages
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Left Column: Image & Details */}
          <div className="lg:col-span-7 space-y-8">
            <div className="relative h-80 md:h-96 w-full overflow-hidden rounded-3xl border bg-muted shadow-sm">
              <Image
                src={pkg.featuredImageUrl}
                alt={pkg.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-outfit text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">{pkg.name}</h1>
                {pkg.isPopular && (
                  <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white">
                    POPULAR
                  </span>
                )}
              </div>
              <p className="mt-2 text-base text-muted-foreground">{pkg.tagline}</p>
            </div>

            {/* Spec Badges */}
            <div className="flex flex-wrap gap-4 py-4 border-y">
              {pkg.maxGuests && (
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  <span>{pkg.maxGuests}</span>
                </div>
              )}
              {pkg.soundRating && (
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Volume2 className="h-4 w-4 text-primary" />
                  <span>{pkg.soundRating}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Sanitized & Tested</span>
              </div>
            </div>

            {/* Description */}
            <div>
              <h3 className="font-outfit text-xl font-bold mb-3">About This Setup</h3>
              <p className="text-muted-foreground leading-relaxed font-sans">{pkg.description}</p>
            </div>

            {/* Inclusions */}
            <div>
              <h3 className="font-outfit text-xl font-bold mb-4">Complete Equipment Inclusions</h3>
              <div className="rounded-2xl border bg-card p-6">
                <InclusionsList inclusions={pkg.inclusions} />
              </div>
            </div>
          </div>

          {/* Right Column: Pricing & Booking Panel */}
          <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-24 rounded-3xl border bg-card p-6 shadow-md space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Rental Pricing</span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-sm font-semibold text-muted-foreground">4 Hours Rate</span>
                  <span className="font-outfit text-3xl font-extrabold text-primary">{formatPHP(pkg.price4Hours)}</span>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">8 Hours Rate</span>
                  <span className="font-bold">{formatPHP(pkg.price8Hours)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Full Day Rate</span>
                  <span className="font-bold">{formatPHP(pkg.priceFullDay)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground pt-2">
                  <span>30% Deposit Required to Reserve</span>
                  <strong className="text-primary font-bold">{formatPHP(pkg.price4Hours * 0.3)}</strong>
                </div>
              </div>

              {/* Availability Checker Widget */}
              <AvailabilityChecker packageId={pkg.id} packageName={pkg.name} />

              {/* Book Button */}
              <Button asChild size="lg" className="w-full text-base h-12 font-bold">
                <Link href={`/packages/${pkg.slug}/book`}>Proceed to Reserve Date</Link>
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                <Sparkles className="inline-block h-3.5 w-3.5 text-amber-500 mr-1" />
                30% non-refundable reservation deposit.{" "}
                <Link href="/policies/cancellation" className="font-semibold underline underline-offset-2">
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
