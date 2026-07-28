import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t py-6 text-sm text-muted-foreground">
      <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 sm:flex-row">
        <span>© {new Date().getFullYear()} KYU Rentals. All rights reserved.</span>
        <Link href="/policies/cancellation" className="font-medium transition-colors hover:text-foreground">
          Cancellation & Refund Policy
        </Link>
      </div>
    </footer>
  );
}
