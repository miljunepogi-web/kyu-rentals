"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { captureException } from "@/lib/monitoring";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h2 className="text-2xl font-bold tracking-tight">Something went wrong!</h2>
      <p className="mt-2 text-muted-foreground max-w-md">
        An unexpected error occurred. Our team has been notified.
      </p>
      <div className="mt-6 flex gap-4">
        <Button onClick={() => reset()} variant="default">
          Try Again
        </Button>
      </div>
    </div>
  );
}
