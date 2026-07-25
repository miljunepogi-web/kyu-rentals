"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DeliveryTeamMember,
  AdminDeliveryScheduleItem,
  AdminDeliverySummary,
  getAdminDeliveryTeam,
  getAdminDeliverySchedule,
  getAdminDeliverySummary,
} from "@/queries/admin-logistics.queries";
import { AdminAssignDeliverySheet } from "@/components/admin/AdminAssignDeliverySheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Truck,
  UserCheck,
  Search,
  Users,
  MapPin,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";

import { submitProofOfDeliveryAction } from "@/actions/admin-pod.actions";
import { Label } from "@/components/ui/label";

type ScheduleFilter = "ALL" | "UNASSIGNED" | "ASSIGNED" | "IN_TRANSIT" | "PICKUPS";

const FILTER_TABS: { label: string; value: ScheduleFilter }[] = [
  { label: "All Deliveries", value: "ALL" },
  { label: "Unassigned", value: "UNASSIGNED" },
  { label: "Delivery Assigned", value: "ASSIGNED" },
  { label: "In Transit", value: "IN_TRANSIT" },
  { label: "Scheduled Pickups", value: "PICKUPS" },
];

export default function AdminLogisticsPage() {
  const [team, setTeam] = useState<DeliveryTeamMember[]>([]);
  const [schedule, setSchedule] = useState<AdminDeliveryScheduleItem[]>([]);
  const [summary, setSummary] = useState<AdminDeliverySummary>({
    unassignedDeliveries: 0,
    assignedDeliveries: 0,
    deliveriesInTransit: 0,
    scheduledPickups: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<ScheduleFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<AdminDeliveryScheduleItem | null>(null);

  // PoD Modal State
  const [podItem, setPodItem] = useState<AdminDeliveryScheduleItem | null>(null);
  const [podSignatureUrl, setPodSignatureUrl] = useState("");
  const [podPhotoUrl, setPodPhotoUrl] = useState("");
  const [podSignerName, setPodSignerName] = useState("");
  const [podNotes, setPodNotes] = useState("");
  const [isSubmittingPod, setIsSubmittingPod] = useState(false);
  const [podError, setPodError] = useState<string | null>(null);

  const loadLogisticsData = useCallback((): Promise<void> => {
    setIsLoading(true);
    return Promise.all([
      getAdminDeliveryTeam(),
      getAdminDeliverySchedule(),
      getAdminDeliverySummary(),
    ]).then(([teamData, scheduleData, summaryData]) => {
      setTeam(teamData);
      setSchedule(scheduleData);
      setSummary(summaryData);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getAdminDeliveryTeam(),
      getAdminDeliverySchedule(),
      getAdminDeliverySummary(),
    ]).then(([teamData, scheduleData, summaryData]) => {
      if (isMounted) {
        setTeam(teamData);
        setSchedule(scheduleData);
        setSummary(summaryData);
        setIsLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

  // Filter schedule list
  const filteredSchedule = schedule.filter((item) => {
    // Tab filter
    if (filterTab === "UNASSIGNED") {
      if (item.assignedPersonnelId || !["CONFIRMED", "PREPARING"].includes(item.status)) {
        return false;
      }
    } else if (filterTab === "ASSIGNED") {
      if (item.status !== "DRIVER_ASSIGNED" && !item.assignedPersonnelId) {
        return false;
      }
    } else if (filterTab === "IN_TRANSIT") {
      if (!["OUT_FOR_DELIVERY", "OUT_FOR_PICKUP"].includes(item.status)) {
        return false;
      }
    } else if (filterTab === "PICKUPS") {
      if (!["RENTAL_ACTIVE", "PICKUP_SCHEDULED", "OUT_FOR_PICKUP"].includes(item.status)) {
        return false;
      }
    }

    // Search query
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.publicId.toLowerCase().includes(q) ||
      item.customerName.toLowerCase().includes(q) ||
      item.packageName.toLowerCase().includes(q) ||
      (item.assignedPersonnelName && item.assignedPersonnelName.toLowerCase().includes(q)) ||
      (item.deliveryAddress && item.deliveryAddress.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight">
            Delivery & Logistics Operations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Assign team members, track vehicles, and schedule equipment deliveries and pickups.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Unassigned</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="font-outfit text-3xl font-extrabold text-foreground">
            {summary.unassignedDeliveries}
          </div>
          <p className="text-[11px] text-muted-foreground">Needs delivery personnel assignment</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Delivery Assigned</span>
            <UserCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="font-outfit text-3xl font-extrabold text-foreground">
            {summary.assignedDeliveries}
          </div>
          <p className="text-[11px] text-muted-foreground">Ready for dispatch & setup</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">In Transit</span>
            <Truck className="h-4 w-4 text-blue-500" />
          </div>
          <div className="font-outfit text-3xl font-extrabold text-foreground">
            {summary.deliveriesInTransit}
          </div>
          <p className="text-[11px] text-muted-foreground">Out for delivery or pickup</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Scheduled Pickups</span>
            <Clock className="h-4 w-4 text-green-500" />
          </div>
          <div className="font-outfit text-3xl font-extrabold text-foreground">
            {summary.scheduledPickups}
          </div>
          <p className="text-[11px] text-muted-foreground">Active rentals awaiting return</p>
        </div>
      </div>

      {/* Main Grid: Delivery Team Panel (Sidebar) + Schedule Table (Main) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Delivery Team Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="font-outfit text-base font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Delivery Team
              </h2>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {team.length} Members
              </span>
            </div>

            {isLoading ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Loading team roster...</p>
            ) : team.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No active team members registered.</p>
            ) : (
              <div className="space-y-3">
                {team.map((member) => (
                  <div
                    key={member.id}
                    className="p-3 rounded-xl border bg-secondary/30 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-foreground">{member.fullName}</span>
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-foreground border">
                        {member.roleName}
                      </span>
                    </div>
                    <p className="text-muted-foreground text-[11px]">{member.phone || member.email}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Schedule & Dispatch Table */}
        <div className="lg:col-span-3 space-y-5">
          {/* Filter Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1.5 flex-wrap">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilterTab(tab.value)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    filterTab === tab.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary/50 text-muted-foreground border-border hover:bg-secondary"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search booking, customer, address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Table */}
          <div className="rounded-2xl border overflow-hidden bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/50 border-b">
                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Booking
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Schedule & Venue
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Assigned Personnel
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-xs text-muted-foreground">
                        Loading delivery schedule...
                      </td>
                    </tr>
                  ) : filteredSchedule.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-16 text-xs text-muted-foreground">
                        No deliveries found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredSchedule.map((item, idx) => (
                      <tr
                        key={item.id}
                        className={`border-b last:border-b-0 hover:bg-primary/5 transition-colors ${
                          idx % 2 === 0 ? "bg-background" : "bg-secondary/10"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-bold text-primary block">
                            {item.publicId}
                          </span>
                          <span className="font-bold text-foreground block text-xs mt-0.5">
                            {item.customerName}
                          </span>
                          <span className="text-[11px] text-muted-foreground block">
                            {item.packageName}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs space-y-1">
                          <span className="font-bold text-foreground block flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-primary" /> {item.eventDate} ({item.startTime})
                          </span>
                          <span className="text-muted-foreground block flex items-center gap-1 max-w-xs truncate">
                            <MapPin className="h-3 w-3 shrink-0" /> {item.deliveryAddress}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs">
                          {item.assignedPersonnelName ? (
                            <div>
                              <span className="font-bold text-foreground block flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> {item.assignedPersonnelName}
                              </span>
                              {item.vehicleInfo && (
                                <span className="text-[11px] text-muted-foreground font-mono block">
                                  🚗 {item.vehicleInfo}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-600 font-semibold text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3.5 w-3.5" /> Unassigned
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <span className="text-[11px] px-2.5 py-1 rounded-full font-bold border bg-secondary/80 text-foreground">
                            {item.status === "DRIVER_ASSIGNED" ? "Delivery Assigned" : item.status.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right space-x-2">
                          {["DRIVER_ASSIGNED", "OUT_FOR_DELIVERY"].includes(item.status) && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => setPodItem(item)}
                              className="font-bold text-xs h-8 px-3 bg-green-600 hover:bg-green-700 text-white"
                            >
                              Complete PoD
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={item.assignedPersonnelName ? "outline" : "default"}
                            onClick={() => setSelectedItem(item)}
                            className="font-bold text-xs h-8 px-3"
                          >
                            {item.assignedPersonnelName ? "Reassign" : "Assign Personnel"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Sheet */}
      {selectedItem && (
        <AdminAssignDeliverySheet
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onRefresh={loadLogisticsData}
        />
      )}

      {/* Proof of Delivery Modal */}
      {podItem && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="font-outfit text-xl font-bold">Proof of Delivery (PoD)</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Booking Ref: <span className="font-mono font-bold text-primary">{podItem.publicId}</span></p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPodItem(null)}>
                ✕
              </Button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsSubmittingPod(true);
                setPodError(null);

                const res = await submitProofOfDeliveryAction({
                  bookingId: podItem.id,
                  signatureUrl: podSignatureUrl.trim() || undefined,
                  photoUrl: podPhotoUrl.trim() || undefined,
                  signerName: podSignerName.trim() || undefined,
                  notes: podNotes.trim() || undefined,
                });

                if (!res.success) {
                  setPodError(res.error || "Failed to submit PoD.");
                  setIsSubmittingPod(false);
                  return;
                }

                setIsSubmittingPod(false);
                setPodItem(null);
                setPodSignatureUrl("");
                setPodPhotoUrl("");
                setPodSignerName("");
                setPodNotes("");
                loadLogisticsData();
              }}
              className="space-y-4"
            >
              {podError && (
                <div className="p-3 rounded-xl bg-destructive/10 text-destructive text-xs font-semibold">
                  {podError}
                </div>
              )}

              <div>
                <Label htmlFor="pod-signer" className="text-xs font-bold">Signer / Customer Name</Label>
                <Input
                  id="pod-signer"
                  placeholder="e.g. Juan Dela Cruz"
                  value={podSignerName}
                  onChange={(e) => setPodSignerName(e.target.value)}
                  className="mt-1 text-xs h-10"
                />
              </div>

              <div>
                <Label htmlFor="pod-sig-url" className="text-xs font-bold">Digital Signature URL</Label>
                <Input
                  id="pod-sig-url"
                  placeholder="https://..."
                  value={podSignatureUrl}
                  onChange={(e) => setPodSignatureUrl(e.target.value)}
                  className="mt-1 text-xs h-10 font-mono"
                />
              </div>

              <div>
                <Label htmlFor="pod-photo-url" className="text-xs font-bold">Setup Photo URL</Label>
                <Input
                  id="pod-photo-url"
                  placeholder="https://..."
                  value={podPhotoUrl}
                  onChange={(e) => setPodPhotoUrl(e.target.value)}
                  className="mt-1 text-xs h-10 font-mono"
                />
              </div>

              <div>
                <Label htmlFor="pod-notes" className="text-xs font-bold">Handover Notes</Label>
                <Input
                  id="pod-notes"
                  placeholder="Equipment tested & handed over in full working condition"
                  value={podNotes}
                  onChange={(e) => setPodNotes(e.target.value)}
                  className="mt-1 text-xs h-10"
                />
              </div>

              <Button type="submit" disabled={isSubmittingPod} className="w-full font-bold text-xs h-11 bg-green-600 hover:bg-green-700 text-white">
                {isSubmittingPod ? "Submitting PoD..." : "Confirm & Activate Rental"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
