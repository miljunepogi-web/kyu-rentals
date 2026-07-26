import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { Button } from "@/components/ui/button";
import { getPackageBySlug } from "@/queries/packages.queries";
import { createClient } from "@/lib/supabase/server";

interface PackageBookingPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PackageBookingPageProps) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);
  if (!pkg) return { title: "Package Not Found" };

  return {
    title: `Book ${pkg.name} | KYU Rentals`,
    description: `Reserve ${pkg.name} for your event with KYU Rentals.`,
  };
}

export default async function PackageBookingPage({ params }: PackageBookingPageProps) {
  const { slug } = await params;
  const pkg = await getPackageBySlug(slug);

  if (!pkg) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/register?package=${pkg.slug}`);
  }

  return (
    <div className="py-10 md:py-14">
      <div className="container mx-auto px-4">
        <div className="mb-8 flex flex-col gap-4 border-b pb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href={`/packages/${pkg.slug}`}
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Package Details
            </Link>
            <h1 className="font-outfit text-3xl font-extrabold tracking-tight md:text-4xl">
              Reserve {pkg.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Complete your event details, lock inventory, and continue to secure deposit payment.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full md:w-auto">
            <Link href="/dashboard">My Dashboard</Link>
          </Button>
        </div>

        <BookingWizard initialPackage={pkg} />
      </div>
    </div>
  );
}
