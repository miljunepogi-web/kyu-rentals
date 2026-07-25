"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function AdminSignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin");
    router.refresh();
  };

  return (
    <button
      onClick={handleSignOut}
      title="Sign Out"
      className="ml-auto text-muted-foreground hover:text-destructive p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
