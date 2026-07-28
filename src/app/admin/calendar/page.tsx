"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AdminCalendarEvent,
  getAdminCalendarEvents,
} from "@/queries/admin-calendar.queries";
import { AdminBookingDetailSheet } from "@/components/admin/AdminBookingDetailSheet";
import { getStatusLabel, getStatusBadgeClass } from "@/config/booking-status.config";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  AlertTriangle,
  RefreshCw,
  Box,
  Truck,
  Clock,
} from "lucide-react";

type ViewMode = "MONTH" | "WEEK" | "DAY";

export default function AdminCalendarPage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("MONTH");
  const [events, setEvents] = useState<AdminCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1; // 1-indexed

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await getAdminCalendarEvents(year, month);
      setEvents(data);
    } catch {
      setEvents([]);
      setErrorMessage("Could not load the schedule. Try refreshing.");
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    let isMounted = true;
    getAdminCalendarEvents(year, month)
      .then((data) => {
        if (isMounted) {
          setEvents(data);
          setErrorMessage(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setEvents([]);
          setErrorMessage("Could not load the schedule. Try refreshing.");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, [year, month]);

  // Navigation handlers
  const handlePrev = () => {
    if (viewMode === "MONTH") {
      setCurrentDate(new Date(year, currentDate.getMonth() - 1, 1));
    } else if (viewMode === "WEEK") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 1);
      setCurrentDate(d);
    }
  };

  const handleNext = () => {
    if (viewMode === "MONTH") {
      setCurrentDate(new Date(year, currentDate.getMonth() + 1, 1));
    } else if (viewMode === "WEEK") {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 1);
      setCurrentDate(d);
    }
  };

  const handleToday = () => setCurrentDate(new Date());

  // Filter events
  const filteredEvents = events.filter((ev) => {
    if (filterType === "ALL") return true;
    if (filterType === "CONFLICTS") return ev.hasConflict;
    return ev.eventType === filterType;
  });

  const conflictsCount = events.filter((ev) => ev.hasConflict).length;

  // Month grid helpers
  const firstDayOfMonth = new Date(year, currentDate.getMonth(), 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, currentDate.getMonth() + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  // Format month title
  const monthTitle = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">
            Dispatch & Logistics
          </span>
          <h1 className="font-outfit text-3xl font-extrabold mt-1 text-foreground flex items-center gap-3">
            Operational Schedule Calendar
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visualize deliveries, pickups, unit reservations, and logistics overlaps.
          </p>
        </div>

        {/* View mode switcher & refresh */}
        <div className="flex items-center gap-3">
          <div className="flex bg-secondary/80 p-1 rounded-xl border text-xs font-bold">
            {(["MONTH", "WEEK", "DAY"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  viewMode === mode ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {mode.charAt(0) + mode.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadEvents}
            disabled={isLoading}
            className="h-9 gap-1.5 font-semibold text-xs rounded-xl"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="flex flex-col gap-3 border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadEvents} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
      )}

      {/* Toolbar Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border rounded-2xl p-4 shadow-xs">
        {/* Date Navigation */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handlePrev} className="h-9 w-9 p-0 rounded-xl">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-outfit font-extrabold text-lg min-w-[160px] text-center">
            {monthTitle}
          </span>
          <Button variant="outline" size="sm" onClick={handleNext} className="h-9 w-9 p-0 rounded-xl">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleToday} className="h-9 font-bold text-xs rounded-xl">
            Today
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilterType("ALL")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              filterType === "ALL" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary/50 border-border text-muted-foreground"
            }`}
          >
            All Events ({events.length})
          </button>
          <button
            onClick={() => setFilterType("DELIVERY")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              filterType === "DELIVERY" ? "bg-blue-500 text-white border-blue-500" : "bg-blue-500/10 text-blue-600 border-blue-500/20"
            }`}
          >
            Deliveries
          </button>
          <button
            onClick={() => setFilterType("PICKUP")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              filterType === "PICKUP" ? "bg-emerald-500 text-white border-emerald-500" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            }`}
          >
            Pickups
          </button>
          {conflictsCount > 0 && (
            <button
              onClick={() => setFilterType("CONFLICTS")}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 transition-colors ${
                filterType === "CONFLICTS" ? "bg-destructive text-white border-destructive" : "bg-destructive/10 text-destructive border-destructive/20 animate-pulse"
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Conflicts ({conflictsCount})
            </button>
          )}
        </div>
      </div>

      {/* Calendar Render Area */}
      {viewMode === "MONTH" && (
        <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b bg-secondary/50 text-center font-bold text-[11px] text-muted-foreground uppercase tracking-wider py-2.5">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Month Cells Grid */}
          <div className="grid grid-cols-7 divide-x divide-y auto-rows-fr">
            {/* Blank leading cells */}
            {Array.from({ length: firstDayOfMonth }).map((_, idx) => (
              <div key={`blank-${idx}`} className="min-h-[110px] bg-secondary/10 p-2" />
            ))}

            {/* Day Cells */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const isToday = dateStr === todayStr;
              const dayEvents = filteredEvents.filter((ev) => ev.eventDate === dateStr);

              return (
                <div
                  key={dateStr}
                  className={`min-h-[110px] p-2 space-y-1.5 transition-colors ${
                    isToday ? "bg-primary/5 font-bold" : "bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs h-6 w-6 rounded-full flex items-center justify-center font-bold ${
                        isToday ? "bg-primary text-primary-foreground" : "text-foreground"
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {dayEvents.length} job{dayEvents.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Day Events Stack */}
                  <div className="space-y-1 max-h-[120px] overflow-y-auto pr-0.5">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedBookingId(ev.id)}
                        className={`p-1.5 rounded-lg border text-[10px] font-bold cursor-pointer transition-all hover:scale-[1.02] ${
                          ev.hasConflict
                            ? "bg-destructive/15 text-destructive border-destructive/40"
                            : ev.eventType === "PICKUP"
                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20"
                            : "bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/20"
                        }`}
                        title={ev.hasConflict ? ev.conflictReason : `${ev.packageName} · ${ev.customerName}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate">{ev.startTime} {ev.packageName}</span>
                          {ev.hasConflict && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                        </div>
                        <div className="text-[9px] font-normal truncate opacity-80">
                          {ev.customerName} · {ev.assignedDriverName || "Unassigned Driver"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week / Day View List Fallback */}
      {(viewMode === "WEEK" || viewMode === "DAY") && (
        <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4">
          <h2 className="font-bold text-sm text-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> {viewMode} Dispatch Schedule ({filteredEvents.length} events)
          </h2>

          {filteredEvents.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs font-semibold space-y-2">
              <CalendarIcon className="h-8 w-8 mx-auto opacity-40" />
              <p>No dispatch events scheduled for this window.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedBookingId(ev.id)}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all hover:border-primary/50 ${
                    ev.hasConflict ? "border-destructive/40 bg-destructive/5" : "bg-secondary/20"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-mono font-bold text-xs shrink-0">
                      {ev.startTime} ({ev.durationHours}h)
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground truncate">{ev.packageName}</span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${getStatusBadgeClass(ev.status)}`}>
                          {getStatusLabel(ev.status)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {ev.customerName} ({ev.customerPhone}) · {ev.deliveryAddress}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-xs font-bold">
                    {ev.assignedUnitSerial ? (
                      <span className="px-2.5 py-1 rounded-lg bg-secondary border text-foreground flex items-center gap-1">
                        <Box className="h-3.5 w-3.5 text-primary" /> {ev.assignedUnitSerial}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        ⚠ Needs Unit
                      </span>
                    )}

                    {ev.assignedDriverName ? (
                      <span className="px-2.5 py-1 rounded-lg bg-secondary border text-foreground flex items-center gap-1">
                        <Truck className="h-3.5 w-3.5 text-primary" /> {ev.assignedDriverName}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        ⚠ Needs Driver
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking Detail Sheet Integration */}
      {selectedBookingId && (
        <AdminBookingDetailSheet
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
          onRefresh={loadEvents}
        />
      )}
    </div>
  );
}
