import { getPublishedPackages } from "@/queries/packages.queries";
import { PackageGrid } from "@/components/marketing/PackageGrid";

export const metadata = {
  title: "Karaoke Rental Packages & Pricing",
  description: "Browse our complete lineup of karaoke sound setups for home parties, birthdays, and corporate events.",
};

export default async function PackagesPage() {
  const packages = await getPublishedPackages();

  return (
    <div className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h1 className="font-outfit text-4xl font-extrabold tracking-tight sm:text-5xl">Rental Packages & Pricing</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Select the perfect package for your venue size and guest count. All rentals include setup and high-definition songbooks.
          </p>
        </div>

        {/* Package Catalog Grid */}
        <PackageGrid packages={packages} />
      </div>
    </div>
  );
}
