"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { UserSession } from "@/types";

export const QUERY_KEYS = {
  SESSION: ["auth", "session"] as const,
};

export function useSession() {
  const supabase = createClient();

  return useQuery<UserSession | null>({
    queryKey: QUERY_KEYS.SESSION,
    queryFn: async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error || !session) {
        return null;
      }

      return {
        id: session.user.id,
        email: session.user.email || "",
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
