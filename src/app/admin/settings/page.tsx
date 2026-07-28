"use client";

import { useState } from "react";
import Link from "next/link";
import { updateTenantSettingsAction } from "@/actions/admin-settings.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building,
  DollarSign,
  ShieldAlert,
  Save,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { CUSTOMER_CANCELLATION_SUMMARY } from "@/config/cancellation-policy.config";

type SettingsTab = "BUSINESS" | "PRICING" | "POLICIES";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("BUSINESS");

  // Form State
  const [businessName, setBusinessName] = useState("KYU Rentals");
  const [tagline, setTagline] = useState("Premium Karaoke Equipment Rental");
  const [contactEmail, setContactEmail] = useState("info@kyurentals.ph");
  const [contactPhone, setContactPhone] = useState("+639170000000");

  const [reservationPct, setReservationPct] = useState(30);
  const [overtimeRate, setOvertimeRate] = useState(300);

  const [expiryHours, setExpiryHours] = useState(2);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    const result = await updateTenantSettingsAction({
      businessName: businessName.trim(),
      tagline: tagline.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      currency: "PHP",
      currencySymbol: "₱",
      reservationPct,
      overtimeRatePerHour: overtimeRate,
      bookingExpiryHours: expiryHours,
    });

    if (!result.success) {
      setErrorMsg(result.error || "Failed to update tenant settings.");
      setIsSubmitting(false);
      return;
    }

    setSuccessMsg("Tenant configuration settings updated and verified.");
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="font-outfit text-3xl font-bold tracking-tight">
          Business & Tenant Configuration
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure business identity, deposit pricing, booking expiry, and the published cancellation policy.
        </p>
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

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b pb-3">
        <button
          onClick={() => setActiveTab("BUSINESS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "BUSINESS"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
          }`}
        >
          <Building className="h-4 w-4" /> Business Identity
        </button>

        <button
          onClick={() => setActiveTab("PRICING")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "PRICING"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
          }`}
        >
          <DollarSign className="h-4 w-4" /> Pricing & Deposit Rules
        </button>

        <button
          onClick={() => setActiveTab("POLICIES")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
            activeTab === "POLICIES"
              ? "bg-primary text-primary-foreground"
              : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
          }`}
        >
          <ShieldAlert className="h-4 w-4" /> Cancellation & Policy
        </button>
      </div>

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="rounded-3xl border bg-card p-6 md:p-8 space-y-6 shadow-xs">
        {activeTab === "BUSINESS" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="biz-name" className="text-xs font-bold">Business Name</Label>
              <Input
                id="biz-name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 text-xs h-10"
                required
              />
            </div>
            <div>
              <Label htmlFor="biz-tagline" className="text-xs font-bold">Tagline</Label>
              <Input
                id="biz-tagline"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                disabled={isSubmitting}
                className="mt-1 text-xs h-10"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="biz-email" className="text-xs font-bold">Contact Email</Label>
                <Input
                  id="biz-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 text-xs h-10"
                  required
                />
              </div>
              <div>
                <Label htmlFor="biz-phone" className="text-xs font-bold">Contact Phone</Label>
                <Input
                  id="biz-phone"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  disabled={isSubmitting}
                  className="mt-1 text-xs h-10"
                  required
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "PRICING" && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="res-pct" className="text-xs font-bold">
                Reservation Fee Percentage (0–100%)
              </Label>
              <Input
                id="res-pct"
                type="number"
                min={0}
                max={100}
                value={reservationPct}
                onChange={(e) => setReservationPct(Number(e.target.value))}
                disabled={isSubmitting}
                className="mt-1 text-xs h-10"
                required
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Percentage of grand total collected upfront as initial deposit.
              </p>
            </div>

            <div>
              <Label htmlFor="overtime-rate" className="text-xs font-bold">
                Overtime Rate per Hour (PHP)
              </Label>
              <Input
                id="overtime-rate"
                type="number"
                min={0}
                value={overtimeRate}
                onChange={(e) => setOvertimeRate(Number(e.target.value))}
                disabled={isSubmitting}
                className="mt-1 text-xs h-10"
                required
              />
            </div>
          </div>
        )}

        {activeTab === "POLICIES" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-bold">Published Customer Policy</h2>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-muted-foreground">
                {CUSTOMER_CANCELLATION_SUMMARY.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              <Link href="/policies/cancellation" target="_blank" className="mt-3 inline-block text-xs font-semibold text-primary underline underline-offset-2">
                Open published policy
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expiry-hours" className="text-xs font-bold">
                  Unpaid Booking Expiry (Hours)
                </Label>
                <Input
                  id="expiry-hours"
                  type="number"
                  min={1}
                  value={expiryHours}
                  onChange={(e) => setExpiryHours(Number(e.target.value))}
                  disabled={isSubmitting}
                  className="mt-1 text-xs h-10"
                  required
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Paid cancellation requests require admin review.
                </p>
              </div>
            </div>
          </div>
        )}

        <Button type="submit" disabled={isSubmitting} className="w-full h-11 font-bold text-sm gap-2">
          <Save className="h-4 w-4" /> {isSubmitting ? "Persisting Settings..." : "Save Verified Configuration"}
        </Button>
      </form>
    </div>
  );
}
