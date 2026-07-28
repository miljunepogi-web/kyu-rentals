"use client";

import { useState, useEffect, useRef } from "react";
import { AdminBookingDetail, getAdminBookingDetail } from "@/queries/admin.queries";
import { getAdminInventoryUnits, AdminInventoryUnit } from "@/queries/admin-inventory.queries";
import { getAdminDeliveryTeam, DeliveryTeamMember } from "@/queries/admin-logistics.queries";
import { updateBookingStatusAdminAction } from "@/actions/admin-booking.actions";
import { assignInventoryUnitAction } from "@/actions/admin-inventory-assign.actions";
import { assignDeliveryPersonnelAction } from "@/actions/admin-logistics.actions";
import { formatPHP } from "@/utils/currency";
import { formatEventDate, formatShortDate } from "@/utils/date";
import {
  getStatusLabel,
  getStatusBadgeClass,
  REASON_REQUIRED_STATUSES,
  STATUS_LABELS,
} from "@/config/booking-status.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  X,
  ShieldCheck,
  User,
  MapPin,
  CreditCard,
  Clock,
  Box,
  Truck,
  AlertCircle,
  CheckCircle2,
  Lock,
  CalendarDays,
  Copy,
  Check,
  RefreshCw,
  Receipt,
  Phone,
  Mail,
  Calendar,
  Info,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

import { recordAdminPaymentAction } from "@/actions/admin-payment.actions";
import { addBookingInternalNoteAction } from "@/actions/admin-note.actions";
import { AdminReceiptModal } from "@/components/admin/AdminReceiptModal";

interface AdminBookingDetailSheetProps {
  bookingId: string | null;
  onClose: () => void;
  onRefresh: () => void;
}

// Legal State Transition Matrix for Admin Select Dropdown
const LEGAL_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["PENDING_PAYMENT", "CANCELLED"],
  PENDING_PAYMENT: ["CONFIRMED", "CANCELLED", "EXPIRED", "REJECTED"],
  CONFIRMED: ["PREPARING", "CANCELLED", "REJECTED"],
  PREPARING: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["OUT_FOR_DELIVERY", "CANCELLED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: ["RENTAL_ACTIVE"],
  RENTAL_ACTIVE: ["PICKUP_SCHEDULED"],
  PICKUP_SCHEDULED: ["OUT_FOR_PICKUP"],
  OUT_FOR_PICKUP: ["PICKED_UP"],
  PICKED_UP: ["COMPLETED"],
  CANCELLATION_REQUESTED: ["CANCELLED", "CONFIRMED"],
};

export function AdminBookingDetailSheet({
  bookingId,
  onClose,
  onRefresh,
}: AdminBookingDetailSheetProps) {
  const [detail, setDetail] = useState<AdminBookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [transitionReason, setTransitionReason] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConcurrencyError, setIsConcurrencyError] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Allocation State
  const [availableUnits, setAvailableUnits] = useState<AdminInventoryUnit[]>([]);
  const [deliveryTeam, setDeliveryTeam] = useState<DeliveryTeamMember[]>([]);
  const [selectedUnitToAssign, setSelectedUnitToAssign] = useState<string>("");
  const [selectedDriverToAssign, setSelectedDriverToAssign] = useState<string>("");
  const [isFetchingUnits, setIsFetchingUnits] = useState<boolean>(false);
  const [isAssigningUnit, setIsAssigningUnit] = useState<boolean>(false);
  const [isAssigningDriver, setIsAssigningDriver] = useState<boolean>(false);

  // Financial Collection & Receipt State
  const [showPaymentForm, setShowPaymentForm] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [collectAmount, setCollectAmount] = useState<string>("");
  const [collectMethod, setCollectMethod] = useState<"CASH" | "GCASH" | "MAYA" | "BANK_TRANSFER" | "OTHER">("CASH");
  const [collectRef, setCollectRef] = useState<string>("");
  const [collectNotes, setCollectNotes] = useState<string>("");
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Internal Note State
  const [showNoteForm, setShowNoteForm] = useState<boolean>(false);
  const [internalNoteInput, setInternalNoteInput] = useState<string>("");
  const [isSubmittingNote, setIsSubmittingNote] = useState<boolean>(false);

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getAdminDeliveryTeam().then(setDeliveryTeam);
  }, []);

  useEffect(() => {
    if (detail && !detail.assignedUnitId) {
      getAdminInventoryUnits("READY_TO_DEPLOY").then((units) => {
        setAvailableUnits(units);
        setIsFetchingUnits(false);
      });
    }
  }, [detail]);

  const fetchDetail = async (id: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    setIsConcurrencyError(false);
    const data = await getAdminBookingDetail(id);
    setDetail(data);
    setIsLoading(false);
    if (data) {
      const allowed = LEGAL_TRANSITIONS[data.status] || [];
      setTargetStatus(allowed[0] || "");
    }
  };

  useEffect(() => {
    if (!bookingId) return;
    let isMounted = true;
    getAdminBookingDetail(bookingId).then((data) => {
      if (isMounted) {
        setDetail(data);
        setIsLoading(false);
        if (data) {
          const allowed = LEGAL_TRANSITIONS[data.status] || [];
          setTargetStatus(allowed[0] || "");
        }
      }
    });
    return () => { isMounted = false; };
  }, [bookingId]);

  // Escape key closes the sheet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Auto-dismiss success message after 3 seconds
  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    successTimerRef.current = setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied ${fieldName} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (!bookingId) return null;

  const handleExecuteTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;

    if (!targetStatus) {
      setErrorMsg("Please select a target status");
      return;
    }

    const reasonRequired = REASON_REQUIRED_STATUSES.has(targetStatus);
    if (reasonRequired && (!transitionReason.trim() || transitionReason.trim().length < 3)) {
      setErrorMsg("An administrative reason is required for this status change (at least 3 characters)");
      return;
    }

    setIsUpdating(true);
    setErrorMsg(null);
    setIsConcurrencyError(false);
    setSuccessMsg(null);

    try {
      const result = await updateBookingStatusAdminAction({
        bookingId: detail.id,
        currentStatus: detail.status,
        targetStatus,
        reason: transitionReason || `Status updated to ${getStatusLabel(targetStatus)}`,
      });

      if (!result.success) {
        setErrorMsg(result.error || "Status transition rejected by server");
        if (result.error?.includes("concurrently")) {
          setIsConcurrencyError(true);
        }
        setIsUpdating(false);
        return;
      }

      showSuccess(`Status updated to "${getStatusLabel(targetStatus)}"`);
      setTransitionReason("");
      setIsUpdating(false);

      const updated = await getAdminBookingDetail(detail.id);
      if (updated) {
        setDetail(updated);
        const allowed = LEGAL_TRANSITIONS[updated.status] || [];
        setTargetStatus(allowed[0] || "");
      }

      onRefresh();
    } catch {
      setErrorMsg("Failed to execute status change");
      setIsUpdating(false);
    }
  };

  const allowedNextStates = detail ? LEGAL_TRANSITIONS[detail.status] || [] : [];
  const isReasonRequired = REASON_REQUIRED_STATUSES.has(targetStatus);
  const isTerminalState = detail && allowedNextStates.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Booking Details"
    >
      <div className="w-full max-w-2xl bg-card border-l h-full overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary tracking-wider uppercase">
                  Booking Details
                </span>
                {detail?.createdAt && (
                  <span className="text-[10px] text-muted-foreground">
                    • Placed on {formatShortDate(detail.createdAt)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <h2 className="font-outfit text-2xl font-bold flex items-center gap-2">
                  <span>{detail ? detail.publicId : "Loading..."}</span>
                  {detail && (
                    <button
                      onClick={() => handleCopy(detail.publicId, "Booking Reference")}
                      className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                      title="Copy Reference"
                    >
                      {copiedField === "Booking Reference" ? (
                        <Check className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </h2>
                {detail && (
                  <span className={`text-xs px-3 py-1 rounded-full font-bold border ${getStatusBadgeClass(detail.status)}`}>
                    {getStatusLabel(detail.status)}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full shrink-0"
              aria-label="Close booking details"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {isLoading ? (
            /* Skeleton Loading View */
            <div className="space-y-6 animate-pulse">
              <div className="h-28 rounded-2xl bg-secondary/50" />
              <div className="h-36 rounded-2xl bg-secondary/50" />
              <div className="h-40 rounded-2xl bg-secondary/50" />
              <div className="h-20 rounded-2xl bg-secondary/50" />
            </div>
          ) : !detail ? (
            <div className="py-20 text-center text-destructive text-sm font-medium">
              Failed to load booking details.
            </div>
          ) : (
            <div className="space-y-6 text-sm">
              {/* Alert Feedback */}
              {errorMsg && (
                <div className="rounded-xl bg-destructive/10 p-4 text-xs font-semibold text-destructive border border-destructive/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                  {isConcurrencyError && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchDetail(detail.id)}
                      className="h-7 text-[11px] gap-1.5 border-destructive/30 hover:bg-destructive/10 text-destructive mt-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Reload Booking Data
                    </Button>
                  )}
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-3 rounded-xl bg-green-500/10 p-4 text-xs font-semibold text-green-600 border border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* 1. Customer Profile */}
              <div className="rounded-2xl border bg-secondary/30 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Customer Profile
                  </h3>
                  {detail.customerPhone && (
                    <button
                      onClick={() => {
                        const cleanPhone = detail.customerPhone.replace(/\D/g, "");
                        window.open(`https://wa.me/${cleanPhone}`, "_blank");
                      }}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
                    >
                      <MessageSquare className="h-3 w-3" /> WhatsApp
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Name</span>
                    <span className="font-bold text-foreground">{detail.customerName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Phone</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <a href={`tel:${detail.customerPhone}`} className="hover:underline flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {detail.customerPhone}
                      </a>
                      <button
                        onClick={() => handleCopy(detail.customerPhone, "Phone Number")}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Copy Phone"
                      >
                        {copiedField === "Phone Number" ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Email</span>
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span>{detail.customerEmail}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Venue & Schedule */}
              <div className="rounded-2xl border bg-secondary/30 p-5 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Delivery Venue & Schedule
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Event Date</span>
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      {formatEventDate(detail.eventDate)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Start Time / Duration</span>
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {detail.startTime} ({detail.durationHours} hrs)
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Delivery Address & Zone</span>
                    <span className="font-bold text-foreground block">
                      {detail.deliveryAddress}
                      {detail.deliveryZone ? (
                        <span className="text-muted-foreground font-normal ml-1">({detail.deliveryZone})</span>
                      ) : (
                        <span className="text-muted-foreground font-normal italic ml-1">(No zone specified)</span>
                      )}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground block text-[11px]">Special Instructions</span>
                    <span className={`font-medium block ${detail.specialInstructions ? "text-foreground" : "text-muted-foreground italic"}`}>
                      {detail.specialInstructions || "None provided by customer."}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Financial Ledger */}
              <div className="rounded-2xl border bg-secondary/30 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" /> Financial Breakdown
                  </h3>
                  {detail.canViewPayments && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowReceiptModal(true)}
                      className="h-7 text-[11px] font-bold gap-1 rounded-lg"
                    >
                      <Receipt className="h-3 w-3" /> Official Receipt
                    </Button>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Package Base ({detail.packageName}):</span>
                    <span className="font-bold">{formatPHP(detail.subtotalAmount)}</span>
                  </div>
                  {detail.surchargeAmount > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Peak Surcharge:</span>
                      <span className="font-bold">{formatPHP(detail.surchargeAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery & Setup Fee:</span>
                    <span className="font-bold">{formatPHP(detail.deliveryFee)}</span>
                  </div>
                  {detail.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span className="font-bold">-{formatPHP(detail.discountAmount)}</span>
                    </div>
                  )}
                  <div className="border-t pt-2 flex justify-between font-extrabold text-sm text-foreground">
                    <span>Grand Total:</span>
                    <span>{formatPHP(detail.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between text-primary font-bold">
                    <span>Deposit Paid (30%):</span>
                    <span>{formatPHP(detail.depositAmount)}</span>
                  </div>
                  <div className={`flex justify-between font-semibold ${detail.balanceAmount > 0 ? "text-amber-600 font-bold" : "text-muted-foreground"}`}>
                    <span>Remaining Balance Due:</span>
                    <span>{formatPHP(detail.balanceAmount)}</span>
                  </div>
                </div>
              </div>

              {/* 4. Payment Records & Balance Collection Form */}
              <div className="rounded-2xl border bg-secondary/30 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-primary" /> Payment Records & Collection
                  </h3>
                  {detail.canManagePayments && detail.balanceAmount > 0 && !showPaymentForm && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setCollectAmount(detail.balanceAmount.toString());
                        setShowPaymentForm(true);
                      }}
                      className="h-7 text-[11px] font-bold px-3 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
                    >
                      + Collect Payment
                    </Button>
                  )}
                </div>

                {/* Inline Collect Payment Form */}
                {showPaymentForm && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setIsSubmittingPayment(true);
                      setErrorMsg(null);
                      const res = await recordAdminPaymentAction({
                        bookingId: detail.id,
                        paymentType: "BALANCE_SETTLEMENT",
                        paymentMethod: collectMethod,
                        amount: Number(collectAmount),
                        referenceNumber: collectRef,
                        notes: collectNotes,
                      });
                      setIsSubmittingPayment(false);
                      if (res.success) {
                        showSuccess(`Payment of ₱${Number(collectAmount).toLocaleString()} recorded!`);
                        setShowPaymentForm(false);
                        setCollectRef("");
                        setCollectNotes("");
                        fetchDetail(detail.id);
                        onRefresh();
                      } else {
                        setErrorMsg(res.error || "Failed to record payment.");
                      }
                    }}
                    className="rounded-xl border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between font-bold text-xs border-b pb-2">
                      <span className="text-primary">Collect Payment / Balance Settlement</span>
                      <button
                        type="button"
                        onClick={() => setShowPaymentForm(false)}
                        className="text-muted-foreground hover:text-foreground text-[11px]"
                      >
                        Cancel ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <Label htmlFor="collect-method" className="text-[11px] font-bold">Method</Label>
                        <select
                          id="collect-method"
                          value={collectMethod}
                          onChange={(e) => setCollectMethod(e.target.value as "CASH" | "GCASH" | "MAYA" | "BANK_TRANSFER" | "OTHER")}
                          className="mt-1 flex h-9 w-full rounded-md border bg-background px-3 py-1 text-xs font-bold"
                        >
                          <option value="CASH">Cash</option>
                          <option value="GCASH">GCash</option>
                          <option value="MAYA">Maya</option>
                          <option value="BANK_TRANSFER">Bank Transfer</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div>
                        <Label htmlFor="collect-amount" className="text-[11px] font-bold">Amount (₱)</Label>
                        <Input
                          id="collect-amount"
                          type="number"
                          value={collectAmount}
                          onChange={(e) => setCollectAmount(e.target.value)}
                          className="mt-1 h-9 text-xs font-bold"
                          min={1}
                          max={detail.balanceAmount}
                          required
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <Label htmlFor="collect-ref" className="text-[11px] font-bold">Ref No. / Transaction ID (Optional)</Label>
                        <Input
                          id="collect-ref"
                          placeholder="e.g. GCash Ref # 123456789"
                          value={collectRef}
                          onChange={(e) => setCollectRef(e.target.value)}
                          className="mt-1 h-9 text-xs"
                        />
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmittingPayment}
                      className="w-full h-9 font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {isSubmittingPayment ? "Recording Payment..." : `Save Payment (₱${Number(collectAmount || 0).toLocaleString()})`}
                    </Button>
                  </form>
                )}
                {!detail.canViewPayments ? (
                  <div className="text-xs text-muted-foreground italic py-1">
                    Financial transaction access required.
                  </div>
                ) : detail.payments.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic py-1">
                    No recorded payments for this booking.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detail.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border text-xs"
                      >
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            <span>{formatPHP(p.amount)}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase font-mono">
                              {p.paymentMethod}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Ref: {p.publicId} • {formatShortDate(p.createdAt)}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                            ["PAID", "SUCCESSFUL", "COMPLETED"].includes(p.status)
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : p.status === "FAILED"
                              ? "bg-destructive/10 text-destructive border-destructive/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Equipment & Driver Allocation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Unit Allocation */}
                <div className="rounded-2xl border bg-secondary/30 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-bold flex items-center gap-1.5">
                      <Box className="h-3.5 w-3.5 text-primary" /> Assigned Unit
                    </span>
                    {detail.assignedUnitId && (
                      <button
                        onClick={async () => {
                          const res = await assignInventoryUnitAction({ bookingId: detail.id, unitId: null });
                          if (res.success) {
                            showSuccess("Inventory unit unassigned");
                            fetchDetail(detail.id);
                            onRefresh();
                          } else {
                            setErrorMsg(res.error || "Failed to unassign unit");
                          }
                        }}
                        className="text-[10px] text-destructive hover:underline font-bold"
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                  <span className={`font-extrabold block text-sm ${detail.assignedUnitSerial ? "text-foreground font-mono" : "text-amber-600"}`}>
                    {detail.assignedUnitSerial ? `Serial: ${detail.assignedUnitSerial}` : "⚠ Unassigned"}
                  </span>

                  {/* Inline Assign Unit Selection */}
                  {!detail.assignedUnitId && (
                    <div className="pt-1">
                      {isFetchingUnits ? (
                        <span className="text-[11px] text-muted-foreground">Loading units...</span>
                      ) : availableUnits.length === 0 ? (
                        <span className="text-[11px] text-amber-600 font-semibold block">No READY_TO_DEPLOY units available for this package.</span>
                      ) : (
                        <div className="flex gap-2">
                          <select
                            value={selectedUnitToAssign}
                            onChange={(e) => setSelectedUnitToAssign(e.target.value)}
                            className="h-8 text-[11px] font-bold rounded-lg border bg-background px-2 flex-1"
                          >
                            <option value="">Select Unit Serial...</option>
                            {availableUnits.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.serialNumber} ({u.packageName})
                              </option>
                            ))}
                          </select>
                          <Button
                            size="sm"
                            disabled={!selectedUnitToAssign || isAssigningUnit}
                            onClick={async () => {
                              if (!selectedUnitToAssign) return;
                              setIsAssigningUnit(true);
                              const res = await assignInventoryUnitAction({ bookingId: detail.id, unitId: selectedUnitToAssign });
                              setIsAssigningUnit(false);
                              if (res.success) {
                                showSuccess(`Unit ${res.unitSerial} assigned!`);
                                setSelectedUnitToAssign("");
                                fetchDetail(detail.id);
                                onRefresh();
                              } else {
                                setErrorMsg(res.error || "Failed to assign unit");
                              }
                            }}
                            className="h-8 text-[11px] font-bold px-3"
                          >
                            Assign
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Driver Allocation */}
                <div className="rounded-2xl border bg-secondary/30 p-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-bold flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-primary" /> Assigned Driver
                    </span>
                  </div>
                  <span className={`font-extrabold block text-sm ${detail.assignedDriverName ? "text-foreground" : "text-amber-600"}`}>
                    {detail.assignedDriverName || "⚠ Unassigned"}
                  </span>
                  {detail.vehicleInfo && (
                    <span className="text-[11px] font-mono text-muted-foreground block">
                      🚗 {detail.vehicleInfo}
                    </span>
                  )}

                  {/* Inline Driver Selection */}
                  <div className="pt-1">
                    <div className="flex gap-2">
                      <select
                        value={selectedDriverToAssign}
                        onChange={(e) => setSelectedDriverToAssign(e.target.value)}
                        className="h-8 text-[11px] font-bold rounded-lg border bg-background px-2 flex-1"
                      >
                        <option value="">Select Driver...</option>
                        {deliveryTeam.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.fullName} ({m.roleName})
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        disabled={!selectedDriverToAssign || isAssigningDriver}
                        onClick={async () => {
                          if (!selectedDriverToAssign) return;
                          setIsAssigningDriver(true);
                          const res = await assignDeliveryPersonnelAction({
                            bookingId: detail.id,
                            assigneeId: selectedDriverToAssign,
                          });
                          setIsAssigningDriver(false);
                          if (res.success) {
                            showSuccess(`Driver ${res.data?.assigneeName} assigned!`);
                            setSelectedDriverToAssign("");
                            fetchDetail(detail.id);
                            onRefresh();
                          } else {
                            setErrorMsg(res.error || "Failed to assign driver");
                          }
                        }}
                        className="h-8 text-[11px] font-bold px-3"
                      >
                        Set
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Inventory Lock Status */}
              <div className="rounded-2xl border bg-secondary/30 p-4 flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" /> Inventory Soft Lock:
                </span>
                <span className={detail.lockStatus.isLocked ? "font-bold text-green-600" : "text-muted-foreground"}>
                  {detail.lockStatus.isLocked ? "Active (15 min)" : "Released / Expired"}
                </span>
              </div>

              {/* 7. Timeline Audit Log & Internal Notes */}
              <div className="rounded-2xl border bg-secondary/30 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Status History & Internal Staff Notes
                  </h3>
                  {!showNoteForm && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowNoteForm(true)}
                      className="h-7 text-[11px] font-bold px-2.5 rounded-lg"
                    >
                      + Add Internal Note
                    </Button>
                  )}
                </div>

                {/* Internal Note Form */}
                {showNoteForm && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!internalNoteInput.trim()) return;
                      setIsSubmittingNote(true);
                      const res = await addBookingInternalNoteAction({
                        bookingId: detail.id,
                        noteText: internalNoteInput,
                      });
                      setIsSubmittingNote(false);
                      if (res.success) {
                        showSuccess("Internal note added to timeline!");
                        setInternalNoteInput("");
                        setShowNoteForm(false);
                        fetchDetail(detail.id);
                        onRefresh();
                      } else {
                        setErrorMsg(res.error || "Failed to add internal note.");
                      }
                    }}
                    className="rounded-xl border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between font-bold text-[11px]">
                      <span className="text-primary">New Internal Operational Note</span>
                      <button
                        type="button"
                        onClick={() => setShowNoteForm(false)}
                        className="text-muted-foreground hover:text-foreground text-[10px]"
                      >
                        Cancel ✕
                      </button>
                    </div>
                    <Input
                      placeholder="e.g. Guard requires advance ID pass. Call 30 mins before arrival..."
                      value={internalNoteInput}
                      onChange={(e) => setInternalNoteInput(e.target.value)}
                      className="h-9 text-xs"
                      required
                    />
                    <Button
                      type="submit"
                      disabled={isSubmittingNote || !internalNoteInput.trim()}
                      className="w-full h-8 font-bold text-xs"
                    >
                      {isSubmittingNote ? "Saving Note..." : "Save Internal Note"}
                    </Button>
                  </form>
                )}

                {detail.timelineEvents.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <CalendarDays className="h-4 w-4 opacity-40" />
                    <span>No status history recorded yet for this booking.</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {detail.timelineEvents.map((evt) => (
                      <div
                        key={evt.id}
                        className={`border-l-2 pl-3 space-y-0.5 text-xs ${
                          evt.eventLabel === "Internal Staff Note"
                            ? "border-amber-500 bg-amber-500/5 p-2 rounded-r-xl"
                            : "border-primary/30"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <div className="flex items-center gap-2">
                            <span>{evt.eventLabel}</span>
                            {evt.performedByRole && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">
                                {evt.performedByRole}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(evt.createdAt).toLocaleString("en-PH", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {evt.eventDescription && (
                          <p className="text-[11px] text-muted-foreground leading-snug">{evt.eventDescription}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions / State Transitions */}
        {detail && (
          <div className="border-t pt-4 mt-6">
            {isTerminalState ? (
              <div className="rounded-xl bg-secondary/50 p-4 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-muted-foreground">
                  <Info className="h-4 w-4" /> Booking Lifecycle Completed
                </div>
                <p className="text-[11px] text-muted-foreground">
                  This booking is in a terminal state ({getStatusLabel(detail.status)}). No further state transitions are permitted.
                </p>
              </div>
            ) : allowedNextStates.length > 0 ? (
              <form onSubmit={handleExecuteTransition} className="space-y-4">
                <h4 className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Change Booking Status
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="target-status" className="text-xs font-bold">Target Status</Label>
                    <select
                      id="target-status"
                      value={targetStatus}
                      onChange={(e) => {
                        setTargetStatus(e.target.value);
                        setErrorMsg(null);
                      }}
                      disabled={isUpdating}
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {allowedNextStates.map((st) => (
                        <option key={st} value={st}>
                          {STATUS_LABELS[st] ?? st.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="reason" className="text-xs font-bold">
                      Admin Reason {isReasonRequired ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(optional)</span>}
                    </Label>
                    <Input
                      id="reason"
                      placeholder={
                        isReasonRequired
                          ? "Required — explain this change..."
                          : "Optional — e.g. Equipment ready, dispatched"
                      }
                      value={transitionReason}
                      onChange={(e) => setTransitionReason(e.target.value)}
                      disabled={isUpdating}
                      className="mt-1 h-10 text-xs"
                      required={isReasonRequired}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isUpdating || !targetStatus}
                  className="w-full h-11 font-bold text-sm"
                >
                  {isUpdating
                    ? "Updating status..."
                    : `Change to "${STATUS_LABELS[targetStatus] ?? targetStatus}"`}
                </Button>
              </form>
            ) : null}
          </div>
        )}
      </div>

      {/* Official Receipt Modal Render */}
      {showReceiptModal && detail && (
        <AdminReceiptModal
          detail={detail}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </div>
  );
}
