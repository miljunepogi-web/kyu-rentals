import { Hero } from "@/components/marketing/Hero";
import { PackageGrid } from "@/components/marketing/PackageGrid";
import { Testimonials } from "@/components/marketing/Testimonials";
import { FAQAccordion } from "@/components/marketing/FAQAccordion";
import { CoverageChecker } from "@/components/marketing/CoverageChecker";
import { getPublishedPackages } from "@/queries/packages.queries";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const packages = await getPublishedPackages();

  return (
    <div>
      {/* Hero Section */}
      <Hero />

      {/* Package Showcase */}
      <section className="py-16 md:py-24 container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="font-outfit text-3xl font-bold tracking-tight sm:text-4xl">Choose Your Sound Setup</h2>
          <p className="mt-3 text-muted-foreground">
            All setups include professional sanitization, full cabling, and songbook tablet controllers.
          </p>
        </div>
        <PackageGrid packages={packages} />
      </section>

      {/* Social Proof */}
      <Testimonials />

      {/* Delivery Coverage */}
      <CoverageChecker />

      {/* FAQ */}
      <FAQAccordion />
    </div>
  );
}
