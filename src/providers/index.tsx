"use client";

import { ThemeProvider } from "./ThemeProvider";
import { QueryProvider } from "./QueryProvider";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryProvider>
        {children}
        <Toaster position="top-right" />
      </QueryProvider>
    </ThemeProvider>
  );
}
