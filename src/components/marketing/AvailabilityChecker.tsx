"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AvailabilityCheckerProps {
  packageId?: string;
  packageName?: string;
}

export function AvailabilityChecker({ packageName }: AvailabilityCheckerProps) {
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "unavailable">("idle");

  const handleCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;

    setStatus("checking");
    setTimeout(() => {
      // Demo validation check
      setStatus("available");
    }, 600);
  };

  return (
    <div className="rounded-2xl sm:rounded-3xl border bg-card p-4 sm:p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Calendar className="h-5 w-5 text-primary shrink-0" aria-hidden="true" />
        <h3 className="font-outfit text-base sm:text-lg font-bold">Check Date Availability</h3>
      </div>

      <form onSubmit={handleCheck} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="event-availability-date" className="text-xs sm:text-sm font-semibold">
            Target Event Date
          </Label>
          <Input
            id="event-availability-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setStatus("idle");
            }}
            min={new Date().toISOString().split("T")[0]}
            required
            aria-required="true"
            aria-describedby="availability-status-result"
            className="h-11 sm:h-12 min-h-[44px] text-xs sm:text-sm"
          />
        </div>

        <Button
          type="submit"
          className="w-full h-11 sm:h-12 min-h-[44px] font-bold text-xs sm:text-sm"
          disabled={status === "checking"}
        >
          {status === "checking" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Checking Availability...
            </>
          ) : (
            "Check Availability"
          )}
        </Button>
      </form>

      <div id="availability-status-result" role="status" aria-live="polite">
        {status === "available" && (
          <div className="flex items-start gap-3 rounded-xl bg-green-500/10 p-3.5 text-green-700 dark:text-green-400 border border-green-500/20 text-xs">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-sm block">Date Available!</strong>
              {packageName
                ? `${packageName} is ready for booking on your selected date.`
                : "Equipment units are available on your selected date."}
            </div>
          </div>
        )}

        {status === "unavailable" && (
          <div className="flex items-start gap-3 rounded-xl bg-destructive/10 p-3.5 text-destructive border border-destructive/20 text-xs">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold text-sm block">Fully Booked</strong>
              Sorry, all units for this date are fully reserved. Please select another date.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
