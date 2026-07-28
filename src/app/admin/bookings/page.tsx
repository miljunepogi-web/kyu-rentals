"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { AdminBookingListItem, getAdminBookings } from "@/queries/admin.queries";
import { AdminBookingDetailSheet } from "@/components/admin/AdminBookingDetailSheet";
import { formatPHP } from "@/utils/currency";
import { formatShortDate } from "@/utils/date";
import { getStatusLabel, getStatusBadgeClass, STATUS_LABELS } from "@/config/booking-status.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Search,
  Filter,
  Eye,
  RefreshCw,
  BookOpen,
  SearchX,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  CalendarDays,
  AlertTriangle,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Status filter options
// ---------------------------------------------------------------------------
const STATUS_FILTER_OPTIONS = [
  { value: "ALL", label: "All Statuses" },
  { value: "DRAFT", label: STATUS_LABELS["DRAFT"] },
  { value: "PENDING_PAYMENT", label: STATUS_LABELS["PENDING_PAYMENT"] },
  { value: "CONFIRMED", label: STATUS_LABELS["CONFIRMED"] },
  { value: "PREPARING", label: STATUS_LABELS["PREPARING"] },
  { value: "DRIVER_ASSIGNED", label: STATUS_LABELS["DRIVER_ASSIGNED"] },
  { value: "OUT_FOR_DELIVERY", label: STATUS_LABELS["OUT_FOR_DELIVERY"] },
  { value: "DELIVERED", label: STATUS_LABELS["DELIVERED"] },
  { value: "RENTAL_ACTIVE", label: STATUS_LABELS["RENTAL_ACTIVE"] },
  { value: "PICKUP_SCHEDULED", label: STATUS_LABELS["PICKUP_SCHEDULED"] },
  { value: "OUT_FOR_PICKUP", label: STATUS_LABELS["OUT_FOR_PICKUP"] },
  { value: "PICKED_UP", label: STATUS_LABELS["PICKED_UP"] },
  { value: "COMPLETED", label: STATUS_LABELS["COMPLETED"] },
  { value: "CANCELLATION_REQUESTED", label: STATUS_LABELS["CANCELLATION_REQUESTED"] },
  { value: "CANCELLED", label: STATUS_LABELS["CANCELLED"] },
  { value: "PAYMENT_FAILED", label: STATUS_LABELS["PAYMENT_FAILED"] },
  { value: "EXPIRED", label: STATUS_LABELS["EXPIRED"] },
];

// ---------------------------------------------------------------------------
// Sort types
// ---------------------------------------------------------------------------
type SortField = "eventDate" | "grandTotal" | "createdAt";
type SortDir = "asc" | "desc";

function SortIcon({ field, active, dir }: { field: string; active: SortField; dir: SortDir }) {
  if (active !== field) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-30 inline-block" />;
  return dir === "asc"
    ? <ChevronUp className="h-3 w-3 ml-1 text-primary inline-block" />
    : <ChevronDown className="h-3 w-3 ml-1 text-primary inline-block" />;
}

// Urgency row highlight by status
function getRowUrgencyClass(status: string): string {
  if (["CANCELLATION_REQUESTED", "PAYMENT_FAILED"].includes(status))
    return "bg-rose-500/5 hover:bg-rose-500/10";
  if (status === "PENDING_PAYMENT")
    return "bg-amber-500/5 hover:bg-amber-500/10";
  return "hover:bg-secondary/30";
}

// Quick-filter pill buttons
const QUICK_FILTERS: { label: string; status: string; icon: React.ReactNode; color: string }[] = [
  { label: "Today's Events", status: "__TODAY__", icon: <CalendarDays className="h-3.5 w-3.5" />, color: "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10" },
  { label: "Awaiting Deposit", status: "PENDING_PAYMENT", icon: <Clock className="h-3.5 w-3.5" />, color: "border-amber-500/40 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10" },
  { label: "Cancellations", status: "CANCELLATION_REQUESTED", icon: <AlertTriangle className="h-3.5 w-3.5" />, color: "border-rose-500/40 text-rose-600 bg-rose-500/5 hover:bg-rose-500/10" },
  { label: "Completed", status: "COMPLETED", icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "border-emerald-500/40 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500/10" },
];

const todayStr = new Date().toISOString().split("T")[0] ?? "";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminBookingsPage() {
  const searchParams = useSearchParams();

  // ── State ──────────────────────────────────────────────────────────────
  const [bookings, setBookings] = useState<AdminBookingListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const s = searchParams.get("status");
    return s && s !== "ALL" ? s : "ALL";
  });
  const [dateFilter, setDateFilter] = useState<string>(() => {
    const d = searchParams.get("date");
    return d === "today" ? (todayStr) : (d ?? "");
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(() => {
    if (searchParams.get("date") === "today") return "__TODAY__";
    const s = searchParams.get("status");
    return s ?? null;
  });

  // Sort state
  const [sortField, setSortField] = useState<SortField>("eventDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Search debounce ────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 150);
  };

  // ── Data fetch ─────────────────────────────────────────────────────────
  const fetchBookings = useCallback(
    async (showToast = false) => {
      const resolvedDate = dateFilter || undefined;
      const resolvedStatus = statusFilter !== "ALL" ? statusFilter : undefined;
      const data = await getAdminBookings(resolvedStatus, resolvedDate);
      setBookings(data);
      setIsLoading(false);
      if (showToast) {
        toast.success(`Ledger refreshed — ${data.length} record${data.length !== 1 ? "s" : ""} loaded`);
      }
    },
    [statusFilter, dateFilter]
  );

  useEffect(() => {
    let isCancelled = false;
    const resolvedDate = dateFilter || undefined;
    const resolvedStatus = statusFilter !== "ALL" ? statusFilter : undefined;
    getAdminBookings(resolvedStatus, resolvedDate).then((data) => {
      if (!isCancelled) {
        setBookings(data);
        setIsLoading(false);
      }
    });
    return () => { isCancelled = true; };
  }, [statusFilter, dateFilter]);

  // ── Quick filter handler ───────────────────────────────────────────────
  const applyQuickFilter = (qf: string) => {
    if (activeQuickFilter === qf) {
      // Toggle off
      setActiveQuickFilter(null);
      setStatusFilter("ALL");
      setDateFilter("");
      return;
    }
    setActiveQuickFilter(qf);
    if (qf === "__TODAY__") {
      setDateFilter(todayStr);
      setStatusFilter("ALL");
    } else {
      setStatusFilter(qf);
      setDateFilter("");
    }
  };

  // ── Client-side filtering & sorting ────────────────────────────────────
  const filteredBookings = bookings.filter((b) => {
    if (!debouncedSearch.trim()) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      b.publicId.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      b.customerPhone.toLowerCase().includes(q) ||
      b.packageName.toLowerCase().includes(q) ||
      (b.deliveryZone ?? "").toLowerCase().includes(q)
    );
  });

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    let cmp = 0;
    if (sortField === "eventDate") cmp = a.eventDate.localeCompare(b.eventDate);
    else if (sortField === "grandTotal") cmp = a.grandTotal - b.grandTotal;
    else if (sortField === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const hasActiveFilter = statusFilter !== "ALL" || debouncedSearch.trim() !== "" || dateFilter !== "";
  const totalCount = bookings.length;
  const shownCount = sortedBookings.length;

  // ── Clear all filters ──────────────────────────────────────────────────
  const clearAll = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setStatusFilter("ALL");
    setDateFilter("");
    setActiveQuickFilter(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">Admin Operations</span>
          <h1 className="font-outfit text-3xl font-extrabold mt-1">Booking Ledger</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage all bookings from deposit to completion.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasActiveFilter && (
            <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs font-semibold text-muted-foreground h-9">
              Clear all filters ✕
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => fetchBookings(true)}
            disabled={isLoading}
            className="h-9 font-semibold text-xs gap-2"
            aria-label="Refresh bookings"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* ── Quick-Filter Pills ── */}
      <div className="flex flex-wrap gap-2">
        {QUICK_FILTERS.map((qf) => (
          <button
            key={qf.status}
            onClick={() => applyQuickFilter(qf.status)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-colors ${
              activeQuickFilter === qf.status
                ? qf.color + " shadow-xs"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {qf.icon}
            {qf.label}
          </button>
        ))}
      </div>

      {/* ── Filter & Search Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-card border rounded-2xl p-4 shadow-xs">
        {/* Search */}
        <div className="sm:col-span-5">
          <Label htmlFor="search-input" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Search
          </Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search-input"
              placeholder="Ref, name, phone, zone..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 h-10 text-xs"
            />
          </div>
        </div>

        {/* Status filter */}
        <div className="sm:col-span-4">
          <Label htmlFor="status-filter" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Filter className="h-3 w-3" /> Status
          </Label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setActiveQuickFilter(e.target.value !== "ALL" ? e.target.value : null);
              setDateFilter("");
            }}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Date filter */}
        <div className="sm:col-span-3">
          <Label htmlFor="date-filter" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> Event Date
          </Label>
          <input
            id="date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setActiveQuickFilter(null);
              setStatusFilter("ALL");
            }}
            className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* ── Result count ── */}
      {!isLoading && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-medium px-1">
          <span>
            Showing <strong className="text-foreground">{shownCount}</strong>
            {shownCount !== totalCount && (
              <> of <strong className="text-foreground">{totalCount}</strong></>
            )} booking{totalCount !== 1 ? "s" : ""}
          </span>
          {dateFilter === todayStr && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
              Today
            </span>
          )}
          {statusFilter !== "ALL" && (
            <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[10px] font-bold border">
              {STATUS_LABELS[statusFilter] ?? statusFilter}
            </span>
          )}
        </div>
      )}

      {/* ── Bookings Table ── */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse" role="grid">
            <thead>
              <tr className="border-b bg-secondary/50 text-muted-foreground uppercase tracking-wider text-[10px] font-bold">
                <th className="px-4 py-3 whitespace-nowrap">Reference</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 hidden sm:table-cell">Package</th>
                <th
                  className="px-4 py-3 whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("eventDate")}
                  aria-sort={sortField === "eventDate" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  Event Date
                  <SortIcon field="eventDate" active={sortField} dir={sortDir} />
                </th>
                <th className="px-4 py-3">Status</th>
                <th
                  className="px-4 py-3 whitespace-nowrap hidden md:table-cell cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("grandTotal")}
                  aria-sort={sortField === "grandTotal" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  Total
                  <SortIcon field="grandTotal" active={sortField} dir={sortDir} />
                </th>
                <th className="px-4 py-3 whitespace-nowrap hidden lg:table-cell">Balance Due</th>
                <th className="px-4 py-3 whitespace-nowrap hidden xl:table-cell">Zone</th>
                <th
                  className="px-4 py-3 whitespace-nowrap hidden xl:table-cell cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => toggleSort("createdAt")}
                  aria-sort={sortField === "createdAt" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
                >
                  Booked On
                  <SortIcon field="createdAt" active={sortField} dir={sortDir} />
                </th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                // Skeleton rows
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b animate-pulse">
                    <td className="px-4 py-4"><div className="h-3 w-20 bg-secondary rounded-full" /></td>
                    <td className="px-4 py-4">
                      <div className="h-3 w-28 bg-secondary rounded-full mb-1.5" />
                      <div className="h-2.5 w-20 bg-secondary rounded-full opacity-60" />
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell"><div className="h-3 w-24 bg-secondary rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-3 w-20 bg-secondary rounded-full" /></td>
                    <td className="px-4 py-4"><div className="h-5 w-24 bg-secondary rounded-full" /></td>
                    <td className="px-4 py-4 hidden md:table-cell"><div className="h-3 w-16 bg-secondary rounded-full" /></td>
                    <td className="px-4 py-4 hidden lg:table-cell"><div className="h-3 w-16 bg-secondary rounded-full" /></td>
                    <td className="px-4 py-4 hidden xl:table-cell"><div className="h-3 w-20 bg-secondary rounded-full" /></td>
                    <td className="px-4 py-4 hidden xl:table-cell"><div className="h-3 w-20 bg-secondary rounded-full" /></td>
                    <td className="px-4 py-4 text-right"><div className="h-8 w-16 bg-secondary rounded-xl ml-auto" /></td>
                  </tr>
                ))
              ) : sortedBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    {hasActiveFilter ? (
                      <div className="space-y-2">
                        <SearchX className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                        <p className="font-bold text-sm text-foreground">No bookings match your filter</p>
                        <p className="text-xs text-muted-foreground">
                          Try clearing the search, changing the date, or selecting a different status.
                        </p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={clearAll}>
                          Clear All Filters
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <BookOpen className="h-8 w-8 text-muted-foreground mx-auto opacity-40" />
                        <p className="font-bold text-sm text-foreground">No bookings yet</p>
                        <p className="text-xs text-muted-foreground">
                          When customers complete their booking, they&apos;ll appear here.
                        </p>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                sortedBookings.map((b) => (
                  <tr
                    key={b.id}
                    tabIndex={0}
                    role="row"
                    aria-label={`Booking ${b.publicId} — ${b.customerName}`}
                    onClick={() => setSelectedBookingId(b.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedBookingId(b.id);
                      }
                    }}
                    className={`border-b last:border-b-0 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset ${getRowUrgencyClass(b.status)}`}
                  >
                    {/* Reference */}
                    <td className="px-4 py-3.5 font-extrabold text-foreground whitespace-nowrap font-mono text-[11px]">
                      {b.publicId}
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3.5">
                      <span className="font-bold block text-foreground leading-tight">{b.customerName}</span>
                      <a
                        href={`tel:${b.customerPhone}`}
                        className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {b.customerPhone}
                      </a>
                    </td>

                    {/* Package */}
                    <td className="px-4 py-3.5 font-semibold text-foreground hidden sm:table-cell max-w-[140px] truncate">
                      {b.packageName}
                    </td>

                    {/* Event Date */}
                    <td className="px-4 py-3.5 font-semibold whitespace-nowrap">
                      {formatShortDate(b.eventDate)}
                      {b.eventDate === todayStr && (
                        <span className="ml-1.5 text-[9px] font-extrabold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">TODAY</span>
                      )}
                    </td>

                    {/* Status badge */}
                    <td className="px-4 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border whitespace-nowrap inline-block ${getStatusBadgeClass(b.status)}`}>
                        {getStatusLabel(b.status)}
                      </span>
                    </td>

                    {/* Grand Total */}
                    <td className="px-4 py-3.5 font-extrabold text-foreground hidden md:table-cell whitespace-nowrap">
                      {formatPHP(b.grandTotal)}
                    </td>

                    {/* Balance Due */}
                    <td className="px-4 py-3.5 hidden lg:table-cell whitespace-nowrap">
                      <span className={`font-bold ${b.balanceAmount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {b.balanceAmount > 0 ? formatPHP(b.balanceAmount) : "—"}
                      </span>
                    </td>

                    {/* Zone */}
                    <td className="px-4 py-3.5 text-muted-foreground font-medium hidden xl:table-cell whitespace-nowrap text-[11px]">
                      {b.deliveryZone ?? "—"}
                    </td>

                    {/* Booked On */}
                    <td className="px-4 py-3.5 text-muted-foreground hidden xl:table-cell whitespace-nowrap text-[11px]">
                      {formatShortDate(b.createdAt)}
                    </td>

                    {/* Open button */}
                    <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedBookingId(b.id)}
                        className="h-8 font-semibold text-xs gap-1.5 rounded-xl"
                      >
                        <Eye className="h-3.5 w-3.5" /> Open
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Booking Detail Sheet ── */}
      {selectedBookingId && (
        <AdminBookingDetailSheet
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
          onRefresh={() => fetchBookings(false)}
        />
      )}
    </div>
  );
}
