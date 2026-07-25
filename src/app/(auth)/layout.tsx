import Link from "next/link";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between border-b px-6">
        <Link href="/" className="font-outfit text-xl font-bold tracking-tight text-primary">
          KYU Rentals
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center p-4">{children}</main>
      <footer className="py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} KYU Rentals. All rights reserved.
      </footer>
    </div>
  );
}
