"use client";

import { ThemeToggle } from "@/components/shared/ThemeToggle";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-4">
        <h1 className="font-outfit text-lg font-semibold">KYU Rentals Platform</h1>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
