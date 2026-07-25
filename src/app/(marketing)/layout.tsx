import Link from "next/link";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Footer } from "@/components/layout/Footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Banner */}
      <div className="bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground">
        🎉 Book today and get <strong>Free Laser Party Lights</strong> with any 8-hour rental!
      </div>

      {/* Main Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-outfit text-2xl font-extrabold tracking-tight text-primary">KYU</span>
            <span className="font-outfit text-2xl font-bold tracking-tight text-foreground">Rentals</span>
          </Link>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
            <Link href="/" className="text-foreground/80 transition-colors hover:text-primary">
              Home
            </Link>
            <Link href="/packages" className="text-foreground/80 transition-colors hover:text-primary">
              Packages & Pricing
            </Link>
            <Link href="#coverage" className="text-foreground/80 transition-colors hover:text-primary">
              Delivery Zones
            </Link>
          </nav>

          {/* Action Header Items */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link href="/packages">Book Now</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
