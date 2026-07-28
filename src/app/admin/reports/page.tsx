"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AdminFinancialReport,
  OperationalFunnelMetric,
  PackageUtilizationMetric,
  getAdminFinancialReport,
  getAdminOperationalFunnel,
  getAdminPackageUtilization,
} from "@/queries/admin-reports.queries";
import { formatPHP } from "@/utils/currency";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Layers,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminReportsPage() {
  const [financial, setFinancial] = useState<AdminFinancialReport>({
    grossRevenue: 0,
    collectedRevenue: 0,
    outstandingBalance: 0,
    refundedAmount: 0,
    reservationDeposits: 0,
    remainingBalances: 0,
    bookingCount: 0,
    averageBookingValue: 0,
  });

  const [funnel, setFunnel] = useState<OperationalFunnelMetric>({
    confirmed: 0,
    preparing: 0,
    deliveryAssigned: 0,
    outForDelivery: 0,
    rentalActive: 0,
    completed: 0,
    cancelled: 0,
  });

  const [utilization, setUtilization] = useState<PackageUtilizationMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [finData, funnelData, utilData] = await Promise.all([
        getAdminFinancialReport(),
        getAdminOperationalFunnel(),
        getAdminPackageUtilization(),
      ]);
      setFinancial(finData);
      setFunnel(funnelData);
      setUtilization(utilData);
    } catch {
      setErrorMessage("Could not load analytics. Try refreshing.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getAdminFinancialReport(),
      getAdminOperationalFunnel(),
      getAdminPackageUtilization(),
    ])
      .then(([finData, funnelData, utilData]) => {
        if (isMounted) {
          setFinancial(finData);
          setFunnel(funnelData);
          setUtilization(utilData);
          setErrorMessage(null);
        }
      })
      .catch(() => {
        if (isMounted) setErrorMessage("Could not load analytics. Try refreshing.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-outfit text-3xl font-bold tracking-tight">
          Financial & Operational Analytics
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          PostgreSQL-aggregated financial metrics, operational funnel status, and package utilization insights.
        </p>
      </div>

      {errorMessage && (
        <div role="alert" className="flex flex-col gap-3 border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadReports} disabled={isLoading}>
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
      )}

      {/* Financial KPIs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="rounded-2xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Revenue</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className="font-outfit text-2xl font-extrabold text-foreground">
            {formatPHP(financial.grossRevenue)}
          </div>
          <p className="text-[11px] text-muted-foreground">{financial.bookingCount} Valid Bookings</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Collected Revenue</span>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <div className="font-outfit text-2xl font-extrabold text-green-600">
            {formatPHP(financial.collectedRevenue)}
          </div>
          <p className="text-[11px] text-muted-foreground">PayMongo & Cash Payments</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Outstanding Balance</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="font-outfit text-2xl font-extrabold text-amber-600">
            {formatPHP(financial.outstandingBalance)}
          </div>
          <p className="text-[11px] text-muted-foreground">Awaiting delivery settlement</p>
        </div>

        <div className="rounded-2xl border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Average Booking</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <div className="font-outfit text-2xl font-extrabold text-foreground">
            {formatPHP(financial.averageBookingValue)}
          </div>
          <p className="text-[11px] text-muted-foreground">Per confirmed rental</p>
        </div>
      </div>

      {/* Secondary Financial Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="rounded-2xl border bg-card p-4 space-y-1 text-xs shadow-xs">
          <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-primary" /> Reservation Deposits (30%)
          </span>
          <span className="font-extrabold text-base block text-foreground">
            {formatPHP(financial.reservationDeposits)}
          </span>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-1 text-xs shadow-xs">
          <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-primary" /> Remaining Balances (70%)
          </span>
          <span className="font-extrabold text-base block text-foreground">
            {formatPHP(financial.remainingBalances)}
          </span>
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-1 text-xs shadow-xs">
          <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5 text-destructive" /> Refunded Amount
          </span>
          <span className="font-extrabold text-base block text-destructive">
            {formatPHP(financial.refundedAmount)}
          </span>
        </div>
      </div>

      {/* Operational Funnel Metrics */}
      <div className="rounded-3xl border bg-card p-6 md:p-8 space-y-4 shadow-xs">
        <h2 className="font-outfit text-xl font-bold flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" /> Operational Booking Funnel Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
          <div className="p-3 rounded-xl border bg-secondary/30 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Confirmed</span>
            <span className="font-outfit text-xl font-extrabold block text-foreground">{funnel.confirmed}</span>
          </div>

          <div className="p-3 rounded-xl border bg-secondary/30 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Preparing</span>
            <span className="font-outfit text-xl font-extrabold block text-foreground">{funnel.preparing}</span>
          </div>

          <div className="p-3 rounded-xl border bg-secondary/30 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deliv Assigned</span>
            <span className="font-outfit text-xl font-extrabold block text-primary">{funnel.deliveryAssigned}</span>
          </div>

          <div className="p-3 rounded-xl border bg-secondary/30 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">In Transit</span>
            <span className="font-outfit text-xl font-extrabold block text-blue-500">{funnel.outForDelivery}</span>
          </div>

          <div className="p-3 rounded-xl border bg-secondary/30 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Rental</span>
            <span className="font-outfit text-xl font-extrabold block text-green-600">{funnel.rentalActive}</span>
          </div>

          <div className="p-3 rounded-xl border bg-secondary/30 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Completed</span>
            <span className="font-outfit text-xl font-extrabold block text-foreground">{funnel.completed}</span>
          </div>

          <div className="p-3 rounded-xl border bg-secondary/30 space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Cancelled</span>
            <span className="font-outfit text-xl font-extrabold block text-destructive">{funnel.cancelled}</span>
          </div>
        </div>
      </div>

      {/* Package Utilization Table */}
      <div className="rounded-3xl border bg-card overflow-hidden shadow-xs space-y-4 p-6">
        <h2 className="font-outfit text-xl font-bold">Package Utilization & Performance</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-secondary/50 font-bold text-muted-foreground uppercase tracking-wider">
                <th className="p-4">Package</th>
                <th className="p-4">Total Bookings</th>
                <th className="p-4">Rental Days</th>
                <th className="p-4">Utilization %</th>
                <th className="p-4 text-right">Revenue Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">Loading utilization data...</td>
                </tr>
              ) : utilization.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">No package utilization records available.</td>
                </tr>
              ) : (
                utilization.map((u) => (
                  <tr key={u.packageId} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 font-bold text-foreground">{u.packageName}</td>
                    <td className="p-4 font-semibold">{u.totalBookings}</td>
                    <td className="p-4 font-semibold">{u.totalRentalDays} Days</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-primary min-w-[36px]">{u.utilizationPercentage}%</span>
                        <div className="h-2 w-24 rounded-full bg-secondary overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, u.utilizationPercentage)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-extrabold text-right text-foreground">{formatPHP(u.revenueGenerated)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
