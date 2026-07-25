"use client";

import { useState, useEffect } from "react";
import { PnLMonthlyRow, getAdminPnLReport } from "@/queries/admin-financial.queries";
import { formatPHP } from "@/utils/currency";
import { DollarSign, TrendingUp, TrendingDown, Calendar, FileText } from "lucide-react";

export default function AdminPnLPage() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [pnlMatrix, setPnlMatrix] = useState<PnLMonthlyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    getAdminPnLReport(selectedYear).then((data) => {
      if (isMounted) {
        setPnlMatrix(data);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [selectedYear]);

  const ytdRevenue = pnlMatrix.reduce((sum, m) => sum + m.revenue, 0);
  const ytdExpenses = pnlMatrix.reduce((sum, m) => sum + m.expenses, 0);
  const ytdNetProfit = ytdRevenue - ytdExpenses;

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight">
            Profit & Loss (P&L) Statement
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            PostgreSQL-calculated monthly revenue, operating expenses, and cumulative YTD net profit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-input bg-card px-3 py-2 text-xs font-bold shadow-xs"
          >
            {[2026, 2025, 2024].map((y) => (
              <option key={y} value={y}>Fiscal Year {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* YTD Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-2xl border bg-card p-6 space-y-2 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            YTD Revenue <DollarSign className="h-4 w-4 text-primary" />
          </span>
          <div className="font-outfit text-3xl font-extrabold text-foreground">
            {formatPHP(ytdRevenue)}
          </div>
          <p className="text-[11px] text-muted-foreground">Total collected revenue in {selectedYear}</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-2 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            YTD Expenses <TrendingDown className="h-4 w-4 text-destructive" />
          </span>
          <div className="font-outfit text-3xl font-extrabold text-destructive">
            {formatPHP(ytdExpenses)}
          </div>
          <p className="text-[11px] text-muted-foreground">Total operating costs in {selectedYear}</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 space-y-2 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            YTD Net Profit <TrendingUp className={`h-4 w-4 ${ytdNetProfit >= 0 ? "text-green-600" : "text-destructive"}`} />
          </span>
          <div className={`font-outfit text-3xl font-extrabold ${ytdNetProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
            {formatPHP(ytdNetProfit)}
          </div>
          <p className="text-[11px] text-muted-foreground">Actual net earnings (Revenue - Expenses)</p>
        </div>
      </div>

      {/* Monthly P&L Matrix Table */}
      <div className="rounded-3xl border bg-card overflow-hidden shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-outfit text-xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> Monthly Financial Performance ({selectedYear})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-secondary/50 font-bold text-muted-foreground uppercase tracking-wider">
                <th className="p-4">Month</th>
                <th className="p-4 text-right">Revenue</th>
                <th className="p-4 text-right">Expenses</th>
                <th className="p-4 text-right">Monthly Net Profit</th>
                <th className="p-4 text-right">YTD Cumulative Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Calculating P&L matrix in PostgreSQL...
                  </td>
                </tr>
              ) : pnlMatrix.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No financial data recorded for fiscal year {selectedYear}.
                  </td>
                </tr>
              ) : (
                pnlMatrix.map((m) => (
                  <tr key={m.monthNumber} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 font-bold text-foreground">{m.monthName}</td>
                    <td className="p-4 text-right font-semibold text-foreground">{formatPHP(m.revenue)}</td>
                    <td className="p-4 text-right font-semibold text-destructive">{formatPHP(m.expenses)}</td>
                    <td className={`p-4 text-right font-extrabold ${m.netProfit >= 0 ? "text-green-600" : "text-destructive"}`}>
                      {formatPHP(m.netProfit)}
                    </td>
                    <td className={`p-4 text-right font-extrabold ${m.ytdNetProfit >= 0 ? "text-primary" : "text-destructive"}`}>
                      {formatPHP(m.ytdNetProfit)}
                    </td>
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
