import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, ShieldCheck, Truck, Music2 } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/5 via-background to-background py-16 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-xs font-semibold text-primary shadow-sm mb-6">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>The #1 Karaoke Rental Platform in Metro Manila</span>
        </div>

        <h1 className="font-outfit text-4xl font-extrabold tracking-tight text-foreground sm:text-6xl max-w-4xl mx-auto leading-tight">
          Turn Any Event Into a <span className="text-primary underline decoration-amber-500/50 decoration-wavy">Concert Experience</span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-sans leading-relaxed">
          Premium karaoke sound systems delivered to your doorstep. Crystal-clear vocal output, 100k+ song library, and 5-minute online booking.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="w-full sm:w-auto text-base px-8 h-12">
            <Link href="/packages">Explore Packages</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full sm:w-auto text-base px-8 h-12">
            <Link href="#coverage">Check Delivery Area</Link>
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto pt-8 border-t border-border/60">
          <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-card border shadow-xs">
            <Truck className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left">
              <p className="text-xs font-bold">On-Time Delivery</p>
              <p className="text-[11px] text-muted-foreground">Setup before event</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-card border shadow-xs">
            <Music2 className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left">
              <p className="text-xs font-bold">100,000+ Songs</p>
              <p className="text-[11px] text-muted-foreground">Latest 2026 Hits</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-card border shadow-xs">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left">
              <p className="text-xs font-bold">Sanitized Hardware</p>
              <p className="text-[11px] text-muted-foreground">Cleaned & tested</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 p-3 rounded-lg bg-card border shadow-xs">
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="text-left">
              <p className="text-xs font-bold">4.9★ Rating</p>
              <p className="text-[11px] text-muted-foreground">Over 500+ events</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
