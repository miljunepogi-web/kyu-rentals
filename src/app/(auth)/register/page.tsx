"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin");
  }, [router]);

  return (
    <div className="py-20 text-center text-sm font-semibold text-muted-foreground">
      Redirecting to Admin Portal...
    </div>
  );
}
