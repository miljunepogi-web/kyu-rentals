"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Menu, Bell } from "lucide-react";
import { AdminSignOutButton } from "@/components/admin/AdminSignOutButton";
import { AdminSidebarContent } from "@/components/admin/AdminSidebarContent";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [userDisplay, setUserDisplay] = useState<{ name: string; role: string }>({
    name: "KYU Admin",
    role: "Admin Portal",
  });

  // Fetch the actual signed-in user for the sidebar badge
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const email = user.email ?? "";
        const displayName =
          (user.user_metadata?.full_name as string | undefined) ||
          email.split("@")[0] ||
          "Admin";
        setUserDisplay({ name: displayName, role: email });
      }
    });
  }, []);

  const closeMobile = () => setIsMobileOpen(false);

  // Standalone full-screen layout for /admin login page
  if (pathname === "/admin") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col p-6 shrink-0">
        <AdminSidebarContent
          pathname={pathname}
          userDisplay={userDisplay}
          SignOutButton={<AdminSignOutButton />}
        />
      </aside>

      {/* Mobile Sidebar — Slide-over drawer */}
      {isMobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={closeMobile}
            aria-hidden="true"
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-card border-r p-6 flex flex-col md:hidden shadow-2xl">
            <AdminSidebarContent
              pathname={pathname}
              userDisplay={userDisplay}
              onClose={closeMobile}
              showCloseButton
              SignOutButton={<AdminSignOutButton />}
            />
          </aside>
        </>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-secondary transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground font-extrabold font-outfit text-sm">
              K
            </div>
            <span className="font-outfit font-extrabold text-base">KYU RENTALS</span>
          </div>
          <button
            className="p-2 rounded-xl hover:bg-secondary transition-colors"
            aria-label="Notifications"
            disabled
          >
            <Bell className="h-5 w-5 text-muted-foreground opacity-50" />
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
