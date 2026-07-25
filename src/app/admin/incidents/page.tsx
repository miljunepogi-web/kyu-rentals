"use client";

import { useState, useEffect } from "react";
import { IncidentListItem, getAdminIncidents } from "@/queries/admin-pod.queries";
import { reportIncidentAction } from "@/actions/admin-pod.actions";
import { formatPHP } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, AlertTriangle, CheckCircle2, AlertCircle, X, ShieldAlert } from "lucide-react";

export default function AdminIncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form Sheet State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [severity, setSeverity] = useState<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">("MEDIUM");
  const [incidentType, setIncidentType] = useState<"DAMAGE" | "MISSING_ITEM" | "EQUIPMENT_FAILURE" | "ACCIDENT">("DAMAGE");
  const [description, setDescription] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getAdminIncidents().then((data) => {
      if (isMounted) {
        setIncidents(data);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!bookingId.trim()) {
      setErrorMsg("Booking ID is required.");
      return;
    }
    if (!description.trim()) {
      setErrorMsg("Please describe the incident or equipment damage.");
      return;
    }

    setIsSubmitting(true);

    const result = await reportIncidentAction({
      bookingId: bookingId.trim(),
      severity,
      incidentType,
      description: description.trim(),
      estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
    });

    if (!result.success) {
      setErrorMsg(result.error || "Failed to submit incident report.");
      setIsSubmitting(false);
      return;
    }

    setSuccessMsg("Incident report logged successfully.");
    setIsSubmitting(false);
    setShowCreateSheet(false);

    // Reset Form
    setBookingId("");
    setDescription("");
    setEstimatedCost("");

    // Refresh
    const updated = await getAdminIncidents();
    setIncidents(updated);
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-destructive text-destructive-foreground font-bold";
      case "HIGH":
        return "bg-amber-500/20 text-amber-600 border-amber-500/30 font-bold";
      case "MEDIUM":
        return "bg-primary/10 text-primary border-primary/20 font-bold";
      default:
        return "bg-secondary text-muted-foreground font-bold";
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight">
            Equipment Incident & Damage Ledger
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track damaged components, missing accessories, technical failures, and repair cost estimates.
          </p>
        </div>
        <Button onClick={() => setShowCreateSheet(true)} className="font-bold text-xs h-10 px-5 gap-2">
          <Plus className="h-4 w-4" /> Report Incident
        </Button>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-xs font-semibold text-destructive border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" /> {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl bg-green-500/10 p-4 text-xs font-semibold text-green-600 border border-green-500/20">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {successMsg}
        </div>
      )}

      {/* Incidents Table */}
      <div className="rounded-3xl border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-secondary/50 font-bold text-muted-foreground uppercase tracking-wider">
                <th className="p-4">Incident ID</th>
                <th className="p-4">Booking Ref</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Type</th>
                <th className="p-4">Description</th>
                <th className="p-4 text-right">Est. Cost</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading equipment incidents...
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No equipment incidents or damage reports logged.
                  </td>
                </tr>
              ) : (
                incidents.map((i) => (
                  <tr key={i.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 font-mono font-extrabold text-primary flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-destructive" /> {i.publicId}
                    </td>
                    <td className="p-4 font-mono font-bold">{i.bookingPublicId}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getSeverityBadgeClass(i.severity)}`}>
                        {i.severity}
                      </span>
                    </td>
                    <td className="p-4 font-bold">{i.incidentType}</td>
                    <td className="p-4 font-normal text-muted-foreground max-w-xs truncate">
                      {i.description}
                    </td>
                    <td className="p-4 text-right font-extrabold text-destructive">
                      {i.estimatedCost ? formatPHP(i.estimatedCost) : "—"}
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-secondary border">
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Incident Form Sheet */}
      {showCreateSheet && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-card border-l h-full p-6 space-y-6 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="font-outfit text-xl font-bold flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" /> Report Equipment Incident
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateSheet(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label htmlFor="inc-booking" className="text-xs font-bold">Booking UUID / ID</Label>
                <Input
                  id="inc-booking"
                  placeholder="Paste Booking ID"
                  value={bookingId}
                  onChange={(e) => setBookingId(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 font-mono text-xs h-10"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="inc-severity" className="text-xs font-bold">Severity</Label>
                  <select
                    id="inc-severity"
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL")}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="inc-type" className="text-xs font-bold">Incident Type</Label>
                  <select
                    id="inc-type"
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value as "DAMAGE" | "MISSING_ITEM" | "EQUIPMENT_FAILURE" | "ACCIDENT")}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  >
                    <option value="DAMAGE">DAMAGE</option>
                    <option value="MISSING_ITEM">MISSING ITEM</option>
                    <option value="EQUIPMENT_FAILURE">EQUIPMENT FAILURE</option>
                    <option value="ACCIDENT">ACCIDENT</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="inc-desc" className="text-xs font-bold">Description of Damage / Issue</Label>
                <Input
                  id="inc-desc"
                  placeholder="e.g. Microphone 2 grill cracked, Bluetooth transmitter failing"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 text-xs h-10"
                  required
                />
              </div>

              <div>
                <Label htmlFor="inc-cost" className="text-xs font-bold">Estimated Repair/Replacement Cost (PHP)</Label>
                <Input
                  id="inc-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Optional cost estimate"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 text-xs h-10"
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full font-bold text-xs h-11 mt-4">
                {isSubmitting ? "Logging Incident..." : "Confirm & Save Incident Report"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
