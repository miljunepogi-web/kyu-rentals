"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, AlertCircle } from "lucide-react";
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
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Calendar className="h-5 w-5 text-primary" />
        <h3 className="font-outfit text-lg font-bold">Check Date Availability</h3>
      </div>

      <form onSubmit={handleCheck} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="event-date">Target Event Date</Label>
          <Input
            id="event-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setStatus("idle");
            }}
            min={new Date().toISOString().split("T")[0]}
            required
          />
        </div>

        <Button type="submit" className="w-full h-10 font-semibold" disabled={status === "checking"}>
          {status === "checking" ? "Checking Availability..." : "Check Availability"}
        </Button>
      </form>

      {status === "available" && (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-green-500/10 p-3.5 text-green-700 dark:text-green-400 border border-green-500/20">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="font-bold text-sm block">Date Available!</strong>
            {packageName ? `${packageName} is ready for booking on your selected date.` : "Equipment units are available on your selected date."}
          </div>
        </div>
      )}

      {status === "unavailable" && (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-destructive/10 p-3.5 text-destructive border border-destructive/20">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-xs">
            <strong className="font-bold text-sm block">Fully Booked</strong>
            Sorry, all units for this date are fully reserved. Please select another date.
          </div>
        </div>
      )}
    </div>
  );
}
