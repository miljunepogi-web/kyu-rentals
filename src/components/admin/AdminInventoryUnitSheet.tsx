"use client";

import { useState, useEffect } from "react";
import {
  AdminInventoryUnitDetail,
  getAdminInventoryUnitDetail,
  InventoryUnitStatus,
} from "@/queries/admin-inventory.queries";
import { updateInventoryUnitStatusAction } from "@/actions/admin-inventory.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  ShieldCheck,
  Box,
  Wrench,
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
} from "lucide-react";

interface AdminInventoryUnitSheetProps {
  unitId: string | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

// Legal transition matrix (mirrors RPC state machine)
const LEGAL_UNIT_TRANSITIONS: Record<string, string[]> = {
  READY_TO_DEPLOY: ["IN_USE", "UNDER_REPAIR"],
  IN_USE: ["READY_TO_DEPLOY", "UNDER_REPAIR"],
  UNDER_REPAIR: ["READY_TO_DEPLOY", "RETIRED"],
  RETIRED: [],
};

const STATUS_COLORS: Record<InventoryUnitStatus, string> = {
  READY_TO_DEPLOY: "bg-green-500/10 text-green-600 border-green-500/20",
  IN_USE: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  UNDER_REPAIR: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  RETIRED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
};

export function AdminInventoryUnitSheet({
  unitId,
  onClose,
  onRefresh,
}: AdminInventoryUnitSheetProps) {
  const [detail, setDetail] = useState<AdminInventoryUnitDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [targetStatus, setTargetStatus] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) return;
    let isMounted = true;

    getAdminInventoryUnitDetail(unitId).then((data) => {
      if (isMounted) {
        setDetail(data);
        setIsLoading(false);
        if (data) {
          const allowed = LEGAL_UNIT_TRANSITIONS[data.status] || [];
          setTargetStatus(allowed[0] || "");
        }
      }
    });

    return () => { isMounted = false; };
  }, [unitId]);

  if (!unitId) return null;

  const allowedNextStates = detail ? LEGAL_UNIT_TRANSITIONS[detail.status] || [] : [];

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;

    if (!targetStatus) { setErrorMsg("Please select a target status."); return; }
    if (!reason.trim() || reason.trim().length < 3) {
      setErrorMsg("Please provide a valid reason (at least 3 characters).");
      return;
    }

    setIsUpdating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await updateInventoryUnitStatusAction({
      unitId: detail.id,
      currentStatus: detail.status,
      targetStatus,
      reason,
      notes: notes || undefined,
    });

    if (!result.success) {
      setErrorMsg(result.error || "Transition failed.");
      setIsUpdating(false);
      return;
    }

    setSuccessMsg(`Status updated to ${targetStatus}`);
    setReason("");
    setNotes("");
    setIsUpdating(false);

    // Await parent list refresh before updating local state to prevent
    // a window where the sheet shows the new status but the list still shows the old one.
    await onRefresh();

    const updated = await getAdminInventoryUnitDetail(detail.id);
    if (updated) {
      setDetail(updated);
      const allowed = LEGAL_UNIT_TRANSITIONS[updated.status] || [];
      setTargetStatus(allowed[0] || "");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-card border-l h-full overflow-y-auto shadow-2xl flex flex-col justify-between">
        <div className="p-6 md:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <span className="text-xs font-bold text-primary tracking-wider uppercase">
                Unit Operational Snapshot
              </span>
              <h2 className="font-outfit text-2xl font-bold flex items-center gap-3 mt-0.5">
                {detail ? detail.publicId : "Loading..."}
                {detail && (
                  <span className={`text-xs px-3 py-1 rounded-full font-bold border ${STATUS_COLORS[detail.status]}`}>
                    {detail.status.replace(/_/g, " ")}
                  </span>
                )}
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {isLoading ? (
            <div className="py-20 text-center text-muted-foreground text-sm">Loading unit snapshot...</div>
          ) : !detail ? (
            <div className="py-20 text-center text-destructive text-sm">Failed to load unit details.</div>
          ) : (
            <div className="space-y-5 text-sm">
              {/* Feedback */}
              {errorMsg && (
                <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-xs font-semibold text-destructive border border-destructive/20">
                  <AlertCircle className="h-4 w-4 shrink-0" />{errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="flex items-center gap-3 rounded-xl bg-green-500/10 p-4 text-xs font-semibold text-green-600 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />{successMsg}
                </div>
              )}

              {/* Unit Info */}
              <div className="rounded-2xl border bg-secondary/30 p-5 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Box className="h-4 w-4 text-primary" /> Unit Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Serial Number</span>
                    <span className="font-bold font-mono text-foreground">{detail.serialNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Active Bookings</span>
                    <span className="font-bold text-foreground">{detail.activeBookingCount}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground block flex items-center gap-1">
                      <Package className="h-3 w-3" /> Package
                    </span>
                    <span className="font-bold text-foreground">{detail.packageName}</span>
                  </div>
                  {detail.conditionNotes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground block">Condition Notes</span>
                      <span className="text-foreground leading-snug">{detail.conditionNotes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Maintenance Log History */}
              <div className="rounded-2xl border bg-secondary/30 p-5 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" /> Maintenance History
                </h3>
                {detail.maintenanceLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No maintenance log entries yet.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.maintenanceLogs.map((log) => (
                      <div key={log.id} className="border-l-2 border-primary/30 pl-3 space-y-1 text-xs">
                        <div className="flex justify-between font-bold">
                          <span>{log.previousStatus} → {log.newStatus}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(log.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{log.reason}</p>
                        {log.notes && (
                          <p className="text-[11px] text-muted-foreground/80 italic">{log.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Atomic Transition Form */}
        {detail && allowedNextStates.length > 0 && (
          <form onSubmit={handleTransition} className="border-t p-6 md:p-8 space-y-4 bg-card">
            <h4 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Atomic Status Transition
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="unit-target-status" className="text-xs font-bold">Target Status</Label>
                <select
                  id="unit-target-status"
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value)}
                  disabled={isUpdating}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {allowedNextStates.map((st) => (
                    <option key={st} value={st}>{st.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="unit-reason" className="text-xs font-bold">Reason <span className="text-destructive">*</span></Label>
                <Input
                  id="unit-reason"
                  placeholder="e.g. Unit returned from rental"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isUpdating}
                  className="mt-1 h-10 text-xs"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="unit-notes" className="text-xs font-bold flex items-center gap-1">
                <Wrench className="h-3 w-3" /> Maintenance Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="unit-notes"
                rows={2}
                placeholder="Optional: Describe repairs, damage, or observations..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isUpdating}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <Button type="submit" disabled={isUpdating} className="w-full h-11 font-bold text-sm">
              {isUpdating ? "Executing Transition..." : `Transition to ${targetStatus.replace(/_/g, " ")}`}
            </Button>
          </form>
        )}

        {detail && detail.status === "RETIRED" && (
          <div className="border-t p-6 text-center text-xs text-muted-foreground font-semibold">
            This unit is <span className="text-zinc-500 font-bold">RETIRED</span>. No further status transitions are possible.
          </div>
        )}
      </div>
    </div>
  );
}
