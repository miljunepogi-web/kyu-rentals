import Link from "next/link";

export function Sidebar() {
  return (
    <aside className="flex w-64 flex-col border-r bg-card p-4">
      <div className="mb-6 px-2 py-4">
        <Link href="/dashboard" className="font-outfit text-xl font-bold tracking-tight text-primary">
          KYU Rentals
        </Link>
      </div>
      <nav className="space-y-1">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          Dashboard
        </Link>
      </nav>
    </aside>
  );
}
