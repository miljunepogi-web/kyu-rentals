import { getPublishedPackages } from "@/queries/packages.queries";
import { PackageGrid } from "@/components/marketing/PackageGrid";

export const metadata = {
  title: "Karaoke Rental Packages & Pricing",
  description: "Browse our complete lineup of karaoke sound setups for home parties, birthdays, and corporate events.",
};

export default async function PackagesPage() {
  const packages = await getPublishedPackages();

  return (
    <div className="py-8 sm:py-12 md:py-16">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <h1 className="font-outfit text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">Rental Packages & Pricing</h1>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base md:text-lg text-muted-foreground leading-relaxed">
            Select the perfect package for your venue size and guest count. All rentals include setup and high-definition songbooks.
          </p>
        </div>

        {/* Package Catalog Grid */}
        <PackageGrid packages={packages} />
      </div>
    </div>
  );
}
