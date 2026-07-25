"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AdminDashboardStats, getAdminDashboardStats } from "@/queries/admin.queries";
import { formatPHP } from "@/utils/currency";
import { formatShortDate } from "@/utils/date";
import { getStatusLabel, getStatusBadgeClass } from "@/config/booking-status.config";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck,
  Clock,
  Activity,
  DollarSign,
  Box,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  PlusCircle,
  Calendar,
  Truck,
  ListFilter,
  UserCheck,
  CreditCard,
  PackageCheck,
  RefreshCw,
  WifiOff,
  ArrowUpRight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Skeleton card placeholder
// ---------------------------------------------------------------------------
function SkeletonCard() {
  return (
    <div className="rounded-3xl border bg-card p-6 shadow-xs animate-pulse space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-28 bg-secondary rounded-full" />
        <div className="h-9 w-9 rounded-xl bg-secondary" />
      </div>
      <div className="h-8 w-16 bg-secondary rounded-lg" />
      <div className="h-2.5 w-36 bg-secondary rounded-full" />
    </div>
  );
}

function SkeletonTimeline() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border p-4 bg-secondary/20">
          <div className="h-7 w-16 rounded-xl bg-secondary" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-40 bg-secondary rounded-full" />
            <div className="h-2.5 w-28 bg-secondary rounded-full" />
          </div>
          <div className="h-6 w-20 rounded-full bg-secondary" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------
export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const data = await getAdminDashboardStats();
      setStats(data);
      setLastRefreshed(new Date());
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    getAdminDashboardStats()
      .then((data) => {
        if (isMounted) {
          setStats(data);
          setLastRefreshed(new Date());
        }
      })
      .catch(() => {
        if (isMounted) setIsError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, []);

  const sortedTimeline = stats?.scheduleTimeline
    ? [...stats.scheduleTimeline].sort((a, b) => a.startTime.localeCompare(b.startTime))
    : [];

  const lastRefreshedLabel = lastRefreshed
    ? lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">
            KYU Rentals Operations Command
          </span>
          <h1 className="font-outfit text-3xl font-extrabold mt-1 text-foreground">
            {greeting}, Admin 👋
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshedLabel && !isLoading && (
            <span className="text-[11px] text-muted-foreground hidden sm:block">
              Updated {lastRefreshedLabel}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="h-9 gap-2 font-semibold text-xs rounded-xl"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Link href="/admin/bookings">
            <Button className="font-bold text-sm h-9 px-4 shadow-xs">
              All Bookings <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Executive BI KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-3xl border bg-card p-5 space-y-2 shadow-xs border-primary/20">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Gross Revenue</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className="font-outfit text-2xl font-extrabold text-foreground">
            {isLoading ? "—" : formatPHP(stats?.totalRevenue ?? 0)}
          </div>
          <p className="text-[11px] text-muted-foreground">All valid tenant bookings</p>
        </div>

        <div className="rounded-3xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Active Rentals</span>
            <Activity className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="font-outfit text-2xl font-extrabold text-emerald-600">
            {isLoading ? "—" : (stats?.activeRentals ?? 0)}
          </div>
          <p className="text-[11px] text-muted-foreground">Equipment out on field</p>
        </div>

        <div className="rounded-3xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Today&apos;s Dispatches</span>
            <Truck className="h-4 w-4 text-blue-500" />
          </div>
          <div className="font-outfit text-2xl font-extrabold text-foreground">
            {isLoading ? "—" : (stats?.todayDeliveries ?? 0)} Deliveries / {stats?.todayPickups ?? 0} Pickups
          </div>
          <p className="text-[11px] text-muted-foreground">Logistics workload</p>
        </div>

        <div className="rounded-3xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold uppercase tracking-wider">
            <span>Pending Deposits</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <div className="font-outfit text-2xl font-extrabold text-amber-600">
            {isLoading ? "—" : (stats?.pendingConfirmations ?? 0)}
          </div>
          <p className="text-[11px] text-muted-foreground">Awaiting initial deposit</p>
        </div>
      </div>

      {/* 2. Quick Actions Bar */}
      <div className="rounded-3xl border bg-card/60 backdrop-blur-xs p-5 shadow-xs space-y-3 max-w-4xl">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
          ⚡ Daily Operational Quick Actions
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link href="/packages">
            <Button variant="outline" className="w-full justify-start font-semibold text-xs h-11 rounded-2xl gap-2 hover:border-primary/50">
              <PlusCircle className="h-4 w-4 text-primary shrink-0" />
              <span>New Booking</span>
            </Button>
          </Link>
          <Link href="/admin/bookings">
            <Button variant="outline" className="w-full justify-start font-semibold text-xs h-11 rounded-2xl gap-2 hover:border-primary/50">
              <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
              <span>All Bookings</span>
            </Button>
          </Link>
          <Link href="/admin/inventory?action=new">
            <Button variant="outline" className="w-full justify-start font-semibold text-xs h-11 rounded-2xl gap-2 hover:border-primary/50">
              <Box className="h-4 w-4 text-emerald-500 shrink-0" />
              <span>Add Unit</span>
            </Button>
          </Link>
          <Link href="/admin/logistics">
            <Button variant="outline" className="w-full justify-start font-semibold text-xs h-11 rounded-2xl gap-2 hover:border-primary/50">
              <Truck className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Logistics</span>
            </Button>
          </Link>
          <Link href="/admin/bookings?date=today">
            <Button variant="outline" className="w-full justify-start font-semibold text-xs h-11 rounded-2xl gap-2 col-span-2 sm:col-span-1 hover:border-primary/50">
              <ListFilter className="h-4 w-4 text-purple-500 shrink-0" />
              <span>Today&apos;s Bookings</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Error State */}
      {isError && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-3">
          <WifiOff className="h-8 w-8 text-destructive mx-auto opacity-60" />
          <p className="font-bold text-sm text-foreground">Unable to load dashboard data</p>
          <p className="text-xs text-muted-foreground">Check your connection or Supabase session.</p>
          <Button onClick={loadData} variant="outline" size="sm" className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      )}

      {!isError && (
        <>
          {/* ─── SECTION A: Booking Health Matrix (urgency first) ─── */}
          <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="font-outfit text-lg font-bold">Booking Health</h2>
                <p className="text-xs text-muted-foreground">Tap any card to view matching bookings</p>
              </div>
              <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              {/* Healthy */}
              <Link
                href="/admin/bookings?status=CONFIRMED"
                className="flex items-center justify-between rounded-2xl border p-4 bg-secondary/30 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-bold">Healthy</p>
                    <p className="text-[11px] text-muted-foreground">Confirmed & setup ready</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-outfit text-xl font-extrabold text-foreground">
                    {isLoading ? "—" : (stats?.bookingHealth.healthy ?? 0)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>

              {/* Pending Balances */}
              <Link
                href="/admin/bookings?status=DELIVERED"
                className="flex items-center justify-between rounded-2xl border p-4 bg-secondary/30 hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-bold">Pending Balances</p>
                    <p className="text-[11px] text-muted-foreground">On-site cash/e-wallet collect</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`font-outfit text-xl font-extrabold ${!isLoading && (stats?.bookingHealth.pendingBalance ?? 0) > 0 ? "text-amber-600" : "text-foreground"}`}>
                    {isLoading ? "—" : (stats?.bookingHealth.pendingBalance ?? 0)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>

              {/* Unassigned Drivers */}
              <Link
                href="/admin/logistics?filter=UNASSIGNED"
                className="flex items-center justify-between rounded-2xl border p-4 bg-secondary/30 hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <UserCheck className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-bold">Unassigned Drivers</p>
                    <p className="text-[11px] text-muted-foreground">Needs logistics allocation</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`font-outfit text-xl font-extrabold ${!isLoading && (stats?.bookingHealth.unassignedDriver ?? 0) > 0 ? "text-blue-600" : "text-foreground"}`}>
                    {isLoading ? "—" : (stats?.bookingHealth.unassignedDriver ?? 0)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>

              {/* Requires Action */}
              <Link
                href="/admin/bookings?status=CANCELLATION_REQUESTED"
                className="flex items-center justify-between rounded-2xl border p-4 bg-secondary/30 hover:border-destructive/50 hover:bg-destructive/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <p className="font-bold">Requires Action</p>
                    <p className="text-[11px] text-muted-foreground">Cancellation or payment issue</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span className={`font-outfit text-xl font-extrabold ${!isLoading && (stats?.bookingHealth.requiresAction ?? 0) > 0 ? "text-destructive" : "text-foreground"}`}>
                    {isLoading ? "—" : (stats?.bookingHealth.requiresAction ?? 0)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            </div>
          </div>

          {/* ─── SECTION B: Today's Schedule Timeline & Fleet Utilization ─── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Today's Schedule Timeline */}
            <div className="lg:col-span-7 rounded-3xl border bg-card p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="font-outfit text-lg font-bold">Today&apos;s Operational Schedule</h2>
                  <p className="text-xs text-muted-foreground">
                    {formatShortDate(new Date().toISOString().split("T")[0] ?? "")} · Chronological dispatch timeline
                  </p>
                </div>
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Truck className="h-4 w-4" />
                </div>
              </div>

              {isLoading ? (
                <SkeletonTimeline />
              ) : sortedTimeline.length === 0 ? (
                <div className="py-10 text-center rounded-2xl border border-dashed p-6 space-y-2">
                  <PackageCheck className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                  <p className="font-bold text-sm text-foreground">No bookings scheduled for today</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    All setups and pickups are up to date. Check upcoming bookings in the calendar.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sortedTimeline.map((item) => {
                    const isPickup = ["COMPLETED", "RETRIEVED", "PICKUP_SCHEDULED", "OUT_FOR_PICKUP", "PICKED_UP"].includes(item.status);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-2xl border p-4 bg-secondary/20 hover:border-primary/40 transition-colors gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="px-3 py-1.5 rounded-xl bg-primary/10 text-primary font-mono font-bold text-xs shrink-0">
                            {item.startTime}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-foreground truncate">{item.packageName}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {item.customerName} · {item.deliveryZone}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-1">
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border block ${getStatusBadgeClass(item.status)}`}>
                            {getStatusLabel(item.status)}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full block ${isPickup ? "bg-emerald-500/10 text-emerald-700" : "bg-blue-500/10 text-blue-700"}`}>
                            {isPickup ? "PICKUP" : "DELIVERY"}
                          </span>
                          {item.assignedDriverName && (
                            <span className="text-[10px] text-muted-foreground block">
                              🚗 {item.assignedDriverName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fleet Utilization */}
            <div className="lg:col-span-5 rounded-3xl border bg-card p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h2 className="font-outfit text-lg font-bold">Inventory Fleet Status</h2>
                  <p className="text-xs text-muted-foreground">Equipment availability & utilization</p>
                </div>
                <div className="h-8 w-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Box className="h-4 w-4" />
                </div>
              </div>

              {isLoading ? (
                <div className="space-y-4 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-secondary rounded-full" />
                    <div className="h-2.5 w-full bg-secondary rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-secondary rounded-full" />
                    <div className="h-2.5 w-full bg-secondary rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-16 rounded-2xl bg-secondary" />
                    <div className="h-16 rounded-2xl bg-secondary" />
                    <div className="h-16 rounded-2xl bg-secondary" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-muted-foreground">Fleet Utilization Rate</span>
                        <span className="text-primary">{stats?.inventoryAvailability.utilizationPct ?? 0}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500 rounded-full"
                          style={{ width: `${stats?.inventoryAvailability.utilizationPct ?? 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-bold mb-1.5">
                        <span className="text-muted-foreground">Available Capacity</span>
                        <span className="text-emerald-600">{stats?.inventoryAvailability.availablePct ?? 0}%</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                          style={{ width: `${stats?.inventoryAvailability.availablePct ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl border bg-emerald-500/5 p-3.5 border-emerald-500/20">
                      <span className="font-outfit text-2xl font-extrabold text-emerald-600 block">
                        {stats?.inventoryAvailability.availableUnits ?? 0}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Ready</span>
                    </div>
                    <div className="rounded-2xl border bg-amber-500/5 p-3.5 border-amber-500/20">
                      <span className="font-outfit text-2xl font-extrabold text-amber-600 block">
                        {stats?.inventoryAvailability.reservedUnits ?? 0}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">In Use</span>
                    </div>
                    <div className="rounded-2xl border bg-destructive/5 p-3.5 border-destructive/20">
                      <span className="font-outfit text-2xl font-extrabold text-destructive block">
                        {stats?.inventoryAvailability.maintenanceUnits ?? 0}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Repair</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ─── SECTION C: KPI Cards ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                <div className={`rounded-3xl border bg-card p-6 shadow-xs space-y-2 transition-colors ${(stats?.todayDeliveries ?? 0) > 0 ? "border-primary/40" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Today Deliveries</span>
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <CalendarCheck className="h-5 w-5" />
                    </div>
                  </div>
                  <span className="font-outfit text-3xl font-extrabold block text-foreground">
                    {stats?.todayDeliveries ?? 0}
                  </span>
                  <p className="text-[11px] text-muted-foreground">Scheduled setups for today</p>
                </div>

                <div className={`rounded-3xl border bg-card p-6 shadow-xs space-y-2 transition-colors ${(stats?.todayPickups ?? 0) > 0 ? "border-emerald-500/40" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Today Pickups</span>
                    <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                      <Truck className="h-5 w-5" />
                    </div>
                  </div>
                  <span className="font-outfit text-3xl font-extrabold block text-foreground">
                    {stats?.todayPickups ?? 0}
                  </span>
                  <p className="text-[11px] text-muted-foreground">Equipment retrievals today</p>
                </div>

                <div className={`rounded-3xl border bg-card p-6 shadow-xs space-y-2 transition-colors ${(stats?.pendingConfirmations ?? 0) > 0 ? "border-amber-500/40" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Awaiting Deposit</span>
                    <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                      <Clock className="h-5 w-5" />
                    </div>
                  </div>
                  <span className="font-outfit text-3xl font-extrabold block text-foreground">
                    {stats?.pendingConfirmations ?? 0}
                  </span>
                  <p className="text-[11px] text-muted-foreground">Pending deposit validation</p>
                </div>

                <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Active Rentals</span>
                    <div className="h-9 w-9 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                      <Activity className="h-5 w-5" />
                    </div>
                  </div>
                  <span className="font-outfit text-3xl font-extrabold block text-foreground">
                    {stats?.activeRentals ?? 0}
                  </span>
                  <p className="text-[11px] text-muted-foreground">Deployed equipment setups</p>
                </div>

                <div className="rounded-3xl border bg-card p-6 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Total Revenue</span>
                    <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <DollarSign className="h-5 w-5" />
                    </div>
                  </div>
                  <span className="font-outfit text-2xl font-extrabold block text-foreground">
                    {formatPHP(stats?.totalRevenue ?? 0)}
                  </span>
                  <p className="text-[11px] text-muted-foreground">All-time confirmed bookings</p>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
