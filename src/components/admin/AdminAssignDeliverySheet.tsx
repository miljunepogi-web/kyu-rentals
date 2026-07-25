"use client";

import { useState, useEffect } from "react";
import {
  DeliveryTeamMember,
  getAdminDeliveryTeam,
  AdminDeliveryScheduleItem,
} from "@/queries/admin-logistics.queries";
import { assignDeliveryPersonnelAction } from "@/actions/admin-logistics.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Truck, UserCheck, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";

interface AdminAssignDeliverySheetProps {
  item: AdminDeliveryScheduleItem | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

export function AdminAssignDeliverySheet({
  item,
  onClose,
  onRefresh,
}: AdminAssignDeliverySheetProps) {
  const [team, setTeam] = useState<DeliveryTeamMember[]>([]);
  const [assigneeId, setAssigneeId] = useState("");
  const [vehicleInfo, setVehicleInfo] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoadingTeam, setIsLoadingTeam] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;

    let isMounted = true;
    getAdminDeliveryTeam().then((members) => {
      if (isMounted) {
        setTeam(members);
        setIsLoadingTeam(false);
        if (members.length > 0) {
          const firstMember = members[0];
          setAssigneeId(item.assignedPersonnelId || (firstMember ? firstMember.id : ""));
        }
        if (item.vehicleInfo) {
          setVehicleInfo(item.vehicleInfo);
        }
      }
    });

    return () => { isMounted = false; };
  }, [item]);

  if (!item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!assigneeId) {
      setErrorMsg("Please select a delivery team member.");
      return;
    }

    setIsSubmitting(true);

    const result = await assignDeliveryPersonnelAction({
      bookingId: item.id,
      currentStatus: item.status,
      assigneeId,
      vehicleInfo: vehicleInfo.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      setErrorMsg(result.error || "Assignment failed.");
      setIsSubmitting(false);
      return;
    }

    const assignedMember = team.find((m) => m.id === assigneeId);
    setSuccessMsg(
      `Assigned ${assignedMember?.fullName || "team member"} to booking ${item.publicId}.`
    );
    setIsSubmitting(false);

    // Await parent list refresh before closing dialog so stale data is never visible
    await onRefresh();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-md bg-card border-l h-full shadow-2xl flex flex-col justify-between">
        <div className="p-6 md:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <span className="text-xs font-bold text-primary tracking-wider uppercase">
                Delivery Assignment
              </span>
              <h2 className="font-outfit text-xl font-bold flex items-center gap-2 mt-0.5">
                {item.publicId} — {item.customerName}
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="h-5 w-5" />
            </Button>
          </div>

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

          {/* Target Booking Overview */}
          <div className="rounded-2xl border bg-secondary/30 p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Package:</span>
              <span className="font-bold">{item.packageName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Event Date:</span>
              <span className="font-bold">{item.eventDate} ({item.startTime})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location:</span>
              <span className="font-bold">{item.deliveryAddress} ({item.deliveryZone || "Metro Manila"})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Status:</span>
              <span className="font-bold text-primary">{item.status.replace(/_/g, " ")}</span>
            </div>
          </div>

          {/* Form Controls */}
          <form id="assign-delivery-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="assignee-select" className="text-xs font-bold flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-primary" /> Delivery Personnel <span className="text-destructive">*</span>
              </Label>
              <select
                id="assignee-select"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                disabled={isSubmitting || isLoadingTeam || team.length === 0}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isLoadingTeam ? (
                  <option value="">Loading delivery team...</option>
                ) : team.length === 0 ? (
                  <option value="">No active team members available</option>
                ) : (
                  team.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName} ({member.roleName}) — {member.phone || member.email}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <Label htmlFor="vehicle-info-input" className="text-xs font-bold flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" /> Vehicle Information <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="vehicle-info-input"
                placeholder="e.g. L300 Van (ABC 1234)"
                value={vehicleInfo}
                onChange={(e) => setVehicleInfo(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 h-10 text-xs"
              />
            </div>

            <div>
              <Label htmlFor="assignment-notes-input" className="text-xs font-bold">
                Assignment Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                id="assignment-notes-input"
                rows={2}
                placeholder="Special delivery instructions, gate pass code, etc..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="border-t p-6 bg-card space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
            <span>Assigning personnel auto-transitions status to <strong className="text-foreground">Delivery Assigned</strong>.</span>
          </div>
          <Button
            type="submit"
            form="assign-delivery-form"
            disabled={isSubmitting || isLoadingTeam || team.length === 0}
            className="w-full h-11 font-bold text-sm"
          >
            {isSubmitting ? "Assigning..." : "Confirm Delivery Assignment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
