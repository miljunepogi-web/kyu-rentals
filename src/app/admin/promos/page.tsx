"use client";

import { useState, useEffect } from "react";
import { AdminPromoCodeItem, getAdminPromoCodes } from "@/queries/admin-financial.queries";
import { createPromoCodeAction } from "@/actions/admin-promo.actions";
import { formatPHP } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Tag, AlertCircle, CheckCircle2, X } from "lucide-react";

export default function AdminPromosPage() {
  const [promos, setPromos] = useState<AdminPromoCodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form Sheet State
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"FIXED" | "PERCENTAGE">("PERCENTAGE");
  const [discountValue, setDiscountValue] = useState("");
  const [minBookingAmount, setMinBookingAmount] = useState("0");
  const [maxDiscountAmount, setMaxDiscountAmount] = useState("");
  const [maxUsageLimit, setMaxUsageLimit] = useState("");
  const [perCustomerLimit, setPerCustomerLimit] = useState("1");
  const [startDate, setStartDate] = useState("2026-07-24");
  const [endDate, setEndDate] = useState("2026-08-24");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getAdminPromoCodes().then((data) => {
      if (isMounted) {
        setPromos(data);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const val = Number(discountValue);
    if (!val || val <= 0) {
      setErrorMsg("Please enter a positive discount value.");
      return;
    }

    setIsSubmitting(true);

    const result = await createPromoCodeAction({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: val,
      minBookingAmount: Number(minBookingAmount) || 0,
      maxDiscountAmount: maxDiscountAmount ? Number(maxDiscountAmount) : undefined,
      maxUsageLimit: maxUsageLimit ? Number(maxUsageLimit) : undefined,
      perCustomerLimit: Number(perCustomerLimit) || 1,
      startDate: String(startDate),
      endDate: String(endDate),
    });

    if (!result.success) {
      setErrorMsg(result.error || "Failed to create promo campaign.");
      setIsSubmitting(false);
      return;
    }

    setSuccessMsg("Promo code campaign created successfully.");
    setIsSubmitting(false);
    setShowCreateSheet(false);

    // Reset Form
    setCode("");
    setDiscountValue("");
    setMinBookingAmount("0");
    setMaxDiscountAmount("");

    // Refresh
    const updated = await getAdminPromoCodes();
    setPromos(updated);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-outfit text-3xl font-bold tracking-tight">
            Promo Code & Voucher Campaigns
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create promotional discount vouchers, set minimum booking thresholds, and monitor redemptions.
          </p>
        </div>
        <Button onClick={() => setShowCreateSheet(true)} className="font-bold text-xs h-10 px-5 gap-2">
          <Plus className="h-4 w-4" /> Create Promo Code
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

      {/* Promo Codes Table */}
      <div className="rounded-3xl border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-secondary/50 font-bold text-muted-foreground uppercase tracking-wider">
                <th className="p-4">Promo Code</th>
                <th className="p-4">Discount</th>
                <th className="p-4">Min Spend</th>
                <th className="p-4">Usage Limit</th>
                <th className="p-4">Campaign Period</th>
                <th className="p-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading promotional campaigns...
                  </td>
                </tr>
              ) : promos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No promo code campaigns created yet.
                  </td>
                </tr>
              ) : (
                promos.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="p-4 font-mono font-extrabold text-primary flex items-center gap-2">
                      <Tag className="h-4 w-4" /> {p.code}
                    </td>
                    <td className="p-4 font-bold text-foreground">
                      {p.discountType === "FIXED" ? formatPHP(p.discountValue) : `${p.discountValue}% OFF`}
                      {p.maxDiscountAmount && (
                        <span className="text-[11px] text-muted-foreground block font-normal">
                          Max cap: {formatPHP(p.maxDiscountAmount)}
                        </span>
                      )}
                    </td>
                    <td className="p-4 font-semibold">{formatPHP(p.minBookingAmount)}</td>
                    <td className="p-4 font-semibold">
                      {p.currentUsageCount} / {p.maxUsageLimit || "∞"} redemptions
                    </td>
                    <td className="p-4 text-[11px] text-muted-foreground">
                      {new Date(p.startDate).toLocaleDateString()} — {new Date(p.endDate).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        p.isActive ? "bg-green-500/10 text-green-600 border-green-500/20" : "bg-secondary text-muted-foreground"
                      }`}>
                        {p.isActive ? "ACTIVE" : "INACTIVE"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Promo Code Slide-over Sheet */}
      {showCreateSheet && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-card border-l h-full p-6 space-y-6 overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <h2 className="font-outfit text-xl font-bold">Create Promo Campaign</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateSheet(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label htmlFor="prm-code" className="text-xs font-bold">Promo Code String</Label>
                <Input
                  id="prm-code"
                  placeholder="e.g. SUMMER2026"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 font-mono text-xs h-10 uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prm-type" className="text-xs font-bold">Discount Type</Label>
                  <select
                    id="prm-type"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as "FIXED" | "PERCENTAGE")}
                    className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                  >
                    <option value="PERCENTAGE">PERCENTAGE (%)</option>
                    <option value="FIXED">FIXED AMOUNT (PHP)</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="prm-val" className="text-xs font-bold">Discount Value</Label>
                  <Input
                    id="prm-val"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 10 or 500"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 text-xs h-10"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prm-min" className="text-xs font-bold">Min Spend (PHP)</Label>
                  <Input
                    id="prm-min"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={minBookingAmount}
                    onChange={(e) => setMinBookingAmount(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 text-xs h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="prm-max-cap" className="text-xs font-bold">Max Discount Cap</Label>
                  <Input
                    id="prm-max-cap"
                    type="number"
                    min="0"
                    placeholder="Optional max cap"
                    value={maxDiscountAmount}
                    onChange={(e) => setMaxDiscountAmount(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 text-xs h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prm-limit" className="text-xs font-bold">Global Usage Limit</Label>
                  <Input
                    id="prm-limit"
                    type="number"
                    min="1"
                    placeholder="Unlimited if empty"
                    value={maxUsageLimit}
                    onChange={(e) => setMaxUsageLimit(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 text-xs h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="prm-per-cust" className="text-xs font-bold">Per Customer Limit</Label>
                  <Input
                    id="prm-per-cust"
                    type="number"
                    min="1"
                    value={perCustomerLimit}
                    onChange={(e) => setPerCustomerLimit(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 text-xs h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="prm-start" className="text-xs font-bold">Start Date</Label>
                  <Input
                    id="prm-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 text-xs h-10"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="prm-end" className="text-xs font-bold">End Date</Label>
                  <Input
                    id="prm-end"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 text-xs h-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full font-bold text-xs h-11 mt-4">
                {isSubmitting ? "Creating Campaign..." : "Confirm & Launch Promo Code"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
