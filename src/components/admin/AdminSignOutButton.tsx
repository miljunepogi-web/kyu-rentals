"use client";

import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { useState } from "react";

export function AdminSignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsSigningOut(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      setIsSigningOut(false);
      return;
    }

    window.location.assign("/admin");
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      title="Sign Out"
      aria-label="Sign Out"
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive ml-auto rounded-lg p-1.5 transition-colors disabled:cursor-wait disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
