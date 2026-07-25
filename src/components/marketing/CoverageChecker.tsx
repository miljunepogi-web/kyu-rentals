"use client";

import { useState } from "react";
import { MapPin, CheckCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CoverageChecker() {
  const [city, setCity] = useState("");
  const [result, setResult] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim()) return;

    setResult(`Standard delivery available for ${city.trim()} with zero setup fees!`);
  };

  return (
    <section id="coverage" className="py-16 md:py-24 bg-card border-y">
      <div className="container mx-auto px-4 max-w-4xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-4">
          <Truck className="h-6 w-6" />
        </div>
        <h2 className="font-outfit text-3xl font-bold tracking-tight sm:text-4xl">Check Delivery Coverage</h2>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          We deliver to all major cities in Metro Manila, Rizal, Cavite, and Laguna.
        </p>

        <form onSubmit={handleSearch} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <div className="relative flex-1">
            <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter City or Barangay (e.g. Quezon City, BGC)"
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                setResult(null);
              }}
              className="pl-10 h-11"
              required
            />
          </div>
          <Button type="submit" size="lg" className="h-11 px-6 font-semibold">
            Check Zone
          </Button>
        </form>

        {result && (
          <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400 border border-green-500/20">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{result}</span>
          </div>
        )}
      </div>
    </section>
  );
}
