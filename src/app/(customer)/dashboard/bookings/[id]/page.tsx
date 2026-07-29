"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CustomerBookingDetail, getCustomerBookingDetail } from "@/queries/customer.queries";
import { requestBookingCancellationAction, submitCustomerReviewAction } from "@/actions/customer.actions";
import { formatPHP } from "@/utils/currency";
import { getStatusLabel, getStatusBadgeClass } from "@/config/booking-status.config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CANCELLATION_POLICY,
  CUSTOMER_CANCELLATION_SUMMARY,
} from "@/config/cancellation-policy.config";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Clock,
  Printer,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Star,
  Loader2,
  PackageCheck,
} from "lucide-react";

/**
 * Pure presentational progress step mapping for Customer Booking Tracking.
 * Does NOT alter any database statuses, transitions, or backend logic.
 */
function getCustomerProgressStep(status: string): number {
  switch (status) {
    case "DRAFT":
    case "PENDING_PAYMENT":
    case "CONFIRMED":
    case "DRIVER_ASSIGNED":
      return 1;
    case "PREPARING":
      return 2;
    case "OUT_FOR_DELIVERY":
    case "DELIVERED":
      return 3;
    case "RENTAL_ACTIVE":
    case "PICKUP_SCHEDULED":
    case "OUT_FOR_PICKUP":
    case "PICKED_UP":
      return 4;
    case "COMPLETED":
      return 5;
    default:
      return 0; // Terminal / Exception status (Cancelled, Expired, Payment Failed)
  }
}

export default function CustomerBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: bookingId } = use(params);
  const [detail, setDetail] = useState<CustomerBookingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cancellation State
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState<string | null>(null);

  // Review State
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && isMounted) {
        getCustomerBookingDetail(bookingId, user.id).then((data) => {
          if (isMounted) {
            setDetail(data);
            setIsLoading(false);
          }
        });
      } else if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, [bookingId]);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="py-20 text-center text-muted-foreground text-sm font-medium space-y-3"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" aria-hidden="true" />
        <span>Loading booking details...</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="font-outfit text-2xl font-bold text-destructive">Booking Not Found</h2>
        <p className="text-xs sm:text-sm text-muted-foreground">
          The requested booking does not exist or you do not have permission to view it.
        </p>
        <Button asChild variant="outline" className="font-bold text-xs sm:text-sm h-11 min-h-[44px] px-5">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4 mr-2 shrink-0" /> Back to Dashboard
          </Link>
        </Button>
      </div>
    );
  }

  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCancelError(null);
    setCancelSuccess(null);

    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      setCancelError("Please provide a valid cancellation reason.");
      return;
    }

    setIsSubmittingCancel(true);

    const result = await requestBookingCancellationAction({
      bookingId: detail.id,
      currentStatus: detail.status,
      reason: cancelReason.trim(),
    });

    if (!result.success) {
      setCancelError(result.error || "Failed to submit cancellation request.");
      setIsSubmittingCancel(false);
      return;
    }

    setCancelSuccess("Cancellation request submitted. Awaiting admin review.");
    setIsSubmittingCancel(false);
    setShowCancelForm(false);

    // Refresh detail
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const updated = await getCustomerBookingDetail(detail.id, user.id);
      if (updated) setDetail(updated);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingReview(true);
    setReviewMsg(null);

    const result = await submitCustomerReviewAction({
      bookingId: detail.id,
      rating,
      comment: comment.trim() || undefined,
    });

    if (!result.success) {
      setReviewMsg(result.error || "Failed to submit review.");
      setIsSubmittingReview(false);
      return;
    }

    setReviewMsg("Thank you for your rating & feedback!");
    setIsSubmittingReview(false);
  };

  const canRequestCancellation = ["CONFIRMED", "PREPARING"].includes(detail.status);
  const isCancellationPending = detail.status === "CANCELLATION_REQUESTED";
  const activeStepIndex = getCustomerProgressStep(detail.status);

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Navigation */}
      <div className="flex items-center justify-between border-b pb-4 gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-muted-foreground hover:text-primary min-h-[44px] px-1 rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" /> Back to Dashboard
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="font-bold text-xs sm:text-sm h-11 min-h-[44px] px-4 gap-1.5"
          aria-label="Print summary receipt"
        >
          <Printer className="h-4 w-4 shrink-0" /> Print Summary Receipt
        </Button>
      </div>

      {/* Header Banner */}
      <div className="rounded-2xl sm:rounded-3xl border bg-card p-5 sm:p-6 md:p-8 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary">{detail.publicId}</span>
            <h1 className="font-outfit text-xl sm:text-2xl font-bold mt-0.5">{detail.packageName}</h1>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-extrabold border whitespace-nowrap inline-block self-start sm:self-auto ${getStatusBadgeClass(detail.status)}`}>
            {getStatusLabel(detail.status)}
          </span>
        </div>
      </div>

      {/* Presentational Customer Booking Progress Timeline */}
      {activeStepIndex > 0 && (
        <div className="rounded-2xl sm:rounded-3xl border bg-card p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <h3 className="font-outfit text-sm sm:text-base font-bold flex items-center gap-2">
              <PackageCheck className="h-4 w-4 text-primary shrink-0" aria-hidden="true" /> Rental Lifecycle Progress
            </h3>
            <span className="text-xs font-bold text-muted-foreground">
              Stage {activeStepIndex} of 5
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {[
              { step: 1, label: "1. Reserved", sub: "Deposit Locked" },
              { step: 2, label: "2. Preparing", sub: "Units Packed" },
              { step: 3, label: "3. Delivery", sub: "Dispatched" },
              { step: 4, label: "4. Active", sub: "Event Ongoing" },
              { step: 5, label: "5. Completed", sub: "Finished" },
            ].map((st) => {
              const isDone = activeStepIndex > st.step;
              const isCurrent = activeStepIndex === st.step;
              return (
                <div
                  key={st.step}
                  className={`rounded-xl p-2.5 sm:p-3 border transition-all ${
                    isCurrent
                      ? "bg-primary/10 border-primary text-primary shadow-xs font-bold"
                      : isDone
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-green-400 font-semibold"
                      : "bg-secondary/40 border-border text-muted-foreground opacity-60"
                  }`}
                >
                  <div className="text-xs font-extrabold">{st.label}</div>
                  <div className="text-[10px] opacity-80 mt-0.5">{st.sub}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Alerts */}
      {cancelSuccess && (
        <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-xl bg-green-500/10 p-4 text-xs sm:text-sm font-semibold text-green-600 border border-green-500/20">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {cancelSuccess}
        </div>
      )}
      {cancelError && (
        <div role="alert" aria-live="assertive" className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-xs sm:text-sm font-semibold text-destructive border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" /> {cancelError}
        </div>
      )}

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Schedule & Venue */}
        <div className="rounded-2xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
          <h3 className="font-outfit text-base font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary shrink-0" aria-hidden="true" /> Schedule & Venue
          </h3>
          <div className="space-y-3 text-xs sm:text-sm">
            <div>
              <span className="text-muted-foreground block text-[11px]">Event Date & Time</span>
              <span className="font-bold text-foreground">{detail.eventDate} ({detail.startTime})</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Rental Duration</span>
              <span className="font-bold text-foreground">{detail.durationHours} Hours</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Delivery Address</span>
              <span className="font-bold text-foreground leading-relaxed">{detail.deliveryAddress}</span>
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="rounded-2xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
          <h3 className="font-outfit text-base font-bold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary shrink-0" aria-hidden="true" /> Financial Breakdown
          </h3>
          <div className="space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Package Subtotal:</span>
              <span className="font-bold">{formatPHP(detail.subtotalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery & Setup Fee:</span>
              <span className="font-bold">{formatPHP(detail.deliveryFee)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-extrabold text-sm sm:text-base text-foreground">
              <span>Grand Total:</span>
              <span>{formatPHP(detail.grandTotal)}</span>
            </div>
            <div className="flex justify-between text-primary font-bold">
              <span>Reservation Deposit (30%):</span>
              <span>{formatPHP(detail.depositAmount)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground font-semibold">
              <span>Remaining Balance (70%):</span>
              <span>{formatPHP(detail.balanceAmount)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline Audit History */}
      <div className="rounded-2xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
        <h3 className="font-outfit text-base font-bold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary shrink-0" aria-hidden="true" /> Booking Timeline History
        </h3>
        <div className="space-y-3">
          {detail.timelineEvents.map((evt) => (
            <div key={evt.id} className="border-l-2 border-primary/30 pl-4 space-y-0.5 text-xs sm:text-sm">
              <div className="flex justify-between font-bold text-foreground">
                <span>{evt.eventLabel}</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {new Date(evt.createdAt).toLocaleDateString()}
                </span>
              </div>
              {evt.eventDescription && (
                <p className="text-[11px] sm:text-xs text-muted-foreground leading-relaxed">{evt.eventDescription}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Review & Rating Form (Completed Bookings) */}
      {detail.status === "COMPLETED" && (
        <form onSubmit={handleReviewSubmit} className="rounded-2xl border bg-card p-5 sm:p-6 space-y-4 shadow-xs">
          <h3 className="font-outfit text-base font-bold flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" aria-hidden="true" /> Rate & Review Your Experience
          </h3>

          {reviewMsg && (
            <div role="status" aria-live="polite" className="p-3.5 text-xs sm:text-sm font-semibold rounded-xl bg-primary/10 text-primary border">
              {reviewMsg}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs sm:text-sm font-bold">Rating (1–5 Stars)</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setRating(s)}
                  aria-label={`Rate ${s} out of 5 stars`}
                  className={`p-2.5 rounded-xl border transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center ${
                    s <= rating ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Star className={`h-5 w-5 ${s <= rating ? "fill-amber-500" : ""}`} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="review-comment" className="text-xs sm:text-sm font-bold">Feedback / Comment</Label>
            <textarea
              id="review-comment"
              rows={3}
              placeholder="Tell us about the equipment, audio quality, or service..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm min-h-[80px] resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmittingReview}
            className="font-bold text-xs sm:text-sm h-11 sm:h-12 min-h-[44px] px-6"
          >
            {isSubmittingReview ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
              </>
            ) : (
              "Submit Verified Review"
            )}
          </Button>
        </form>
      )}

      {/* Cancellation Request Section */}
      {isCancellationPending && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-xs space-y-2">
          <h3 className="flex items-center gap-2 font-outfit text-base font-bold text-amber-600">
            <Clock className="h-4 w-4 shrink-0" />
            Cancellation request under review
          </h3>
          <p className="text-xs sm:text-sm leading-relaxed text-muted-foreground">
            {CANCELLATION_POLICY.adminReview} Your event date and equipment remain reserved
            until the decision is recorded.
          </p>
        </div>
      )}

      {canRequestCancellation && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-outfit text-base font-bold text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4 shrink-0" /> Request Booking Cancellation
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Need to cancel? Requests submitted here require administrator approval.
              </p>
            </div>
            {!showCancelForm && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelForm(true)}
                className="font-bold text-xs sm:text-sm h-11 min-h-[44px] px-4 self-start sm:self-auto"
              >
                Request Cancel
              </Button>
            )}
          </div>

          {showCancelForm && (
            <form onSubmit={handleCancelSubmit} className="space-y-4 pt-3 border-t border-destructive/20">
              <ul className="space-y-1.5 text-xs sm:text-sm leading-relaxed text-muted-foreground">
                {CUSTOMER_CANCELLATION_SUMMARY.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
              <Link
                href="/policies/cancellation"
                target="_blank"
                className="inline-block text-xs font-semibold underline underline-offset-2 hover:text-primary"
              >
                Read the complete cancellation and refund policy
              </Link>
              <div className="space-y-1.5">
                <Label htmlFor="cancellation-reason" className="text-xs sm:text-sm font-bold">
                  Cancellation Reason <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cancellation-reason"
                  placeholder="e.g. Event date changed or emergency"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={isSubmittingCancel}
                  className="h-11 sm:h-12 min-h-[44px] text-xs sm:text-sm"
                  required
                  aria-required="true"
                  aria-invalid={cancelError ? true : false}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isSubmittingCancel}
                  className="font-bold text-xs sm:text-sm h-11 sm:h-12 min-h-[44px] px-5"
                >
                  {isSubmittingCancel ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
                    </>
                  ) : (
                    "Confirm Cancellation Request"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCancelForm(false)}
                  disabled={isSubmittingCancel}
                  className="font-bold text-xs sm:text-sm h-11 sm:h-12 min-h-[44px] px-4"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
