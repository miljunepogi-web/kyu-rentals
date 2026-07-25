"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  CalendarCheck,
  Package,
  Box,
  Truck,
  FileBarChart,
  Shield,
  AlertTriangle,
  Users,
} from "lucide-react";

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  currentPath: string;
  onClick?: () => void;
}

export function SidebarNavLink({ href, icon, label, currentPath, onClick }: NavLinkProps) {
  const isActive =
    currentPath === href ||
    (href !== "/admin/dashboard" && href.startsWith("/admin") && currentPath.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
        isActive
          ? "bg-primary/10 text-primary border-l-2 border-primary pl-[10px]"
          : "text-foreground hover:bg-secondary"
      }`}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

interface SidebarProps {
  pathname: string;
  userDisplay: { name: string; role: string };
  onClose?: () => void;
  showCloseButton?: boolean;
  SignOutButton: React.ReactNode;
}

export function AdminSidebarContent({
  pathname,
  userDisplay,
  onClose,
  showCloseButton = false,
  SignOutButton,
}: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="space-y-6 flex-1 overflow-y-auto">
        {/* Logo & Brand */}
        <div className="flex items-center justify-between gap-3 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold font-outfit text-lg shrink-0">
              K
            </div>
            <div>
              <span className="font-outfit font-extrabold text-lg block leading-none">KYU RENTALS</span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Admin Portal</span>
            </div>
          </div>
          {showCloseButton && onClose && (
            <button
              className="md:hidden p-1 rounded-lg hover:bg-secondary"
              onClick={onClose}
              aria-label="Close navigation"
            >
              <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Section: Operations */}
        <div className="space-y-2">
          <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block px-3">
            Operations
          </span>
          <nav className="space-y-0.5">
            <SidebarNavLink href="/admin/dashboard" icon={<LayoutDashboard className="h-4 w-4 shrink-0" />} label="Dashboard" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/bookings" icon={<CalendarCheck className="h-4 w-4 shrink-0" />} label="Bookings" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/calendar" icon={<CalendarCheck className="h-4 w-4 shrink-0 text-primary" />} label="Calendar Schedule" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/customers" icon={<Users className="h-4 w-4 shrink-0 text-emerald-600" />} label="Customer CRM" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/packages" icon={<Package className="h-4 w-4 shrink-0" />} label="Packages Catalog ↗" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/inventory" icon={<Box className="h-4 w-4 shrink-0" />} label="Inventory Fleet" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/logistics" icon={<Truck className="h-4 w-4 shrink-0" />} label="Delivery & Logistics" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/incidents" icon={<AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />} label="Equipment Incidents" currentPath={pathname} onClick={onClose} />
          </nav>
        </div>

        {/* Section: Administration */}
        <div className="space-y-2 pt-2 border-t">
          <span className="text-xs font-extrabold text-muted-foreground uppercase tracking-wider block px-3">
            Administration
          </span>
          <nav className="space-y-0.5">
            <SidebarNavLink href="/admin/expenses" icon={<FileBarChart className="h-4 w-4 shrink-0 text-destructive" />} label="Operating Expenses" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/pnl" icon={<FileBarChart className="h-4 w-4 shrink-0 text-emerald-600" />} label="P&L Statement" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/promos" icon={<Shield className="h-4 w-4 shrink-0" />} label="Promo Campaigns" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/reports" icon={<FileBarChart className="h-4 w-4 shrink-0 text-primary" />} label="Financial Reports" currentPath={pathname} onClick={onClose} />
            <SidebarNavLink href="/admin/settings" icon={<Shield className="h-4 w-4 shrink-0" />} label="Tenant Settings" currentPath={pathname} onClick={onClose} />
          </nav>
        </div>
      </div>

      {/* Admin User Badge */}
      <div className="border-t pt-4 mt-4 flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
            <Shield className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <span className="font-bold block text-foreground truncate">{userDisplay.name}</span>
            <span className="text-[10px] text-muted-foreground truncate block">{userDisplay.role}</span>
          </div>
        </div>
        {SignOutButton}
      </div>
    </div>
  );
}


