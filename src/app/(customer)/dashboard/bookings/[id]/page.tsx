"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CustomerBookingDetail, getCustomerBookingDetail } from "@/queries/customer.queries";
import { requestBookingCancellationAction, submitCustomerReviewAction } from "@/actions/customer.actions";
import { formatPHP } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
} from "lucide-react";

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
      <div className="py-20 text-center text-muted-foreground text-sm font-medium">
        Loading booking details...
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="font-outfit text-2xl font-bold text-destructive">Booking Not Found</h2>
        <p className="text-xs text-muted-foreground">
          The requested booking does not exist or you do not have permission to view it.
        </p>
        <Link href="/dashboard">
          <Button variant="outline" className="font-bold text-xs">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
        </Link>
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

  return (
    <div className="space-y-8 max-w-4xl mx-auto px-4 py-8">
      {/* Navigation */}
      <div className="flex items-center justify-between border-b pb-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="font-bold text-xs gap-1.5"
        >
          <Printer className="h-3.5 w-3.5" /> Print Summary Receipt
        </Button>
      </div>

      {/* Header Banner */}
      <div className="rounded-3xl border bg-card p-6 md:p-8 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-mono font-bold text-primary">{detail.publicId}</span>
            <h1 className="font-outfit text-2xl font-bold mt-0.5">{detail.packageName}</h1>
          </div>
          <span className="text-xs px-3 py-1.5 rounded-full font-bold border bg-primary/10 text-primary border-primary/20 self-start sm:self-auto">
            {detail.status === "DRIVER_ASSIGNED" ? "Delivery Assigned" : detail.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* Alerts */}
      {cancelSuccess && (
        <div className="flex items-center gap-3 rounded-xl bg-green-500/10 p-4 text-xs font-semibold text-green-600 border border-green-500/20">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {cancelSuccess}
        </div>
      )}
      {cancelError && (
        <div className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-xs font-semibold text-destructive border border-destructive/20">
          <AlertCircle className="h-4 w-4 shrink-0" /> {cancelError}
        </div>
      )}

      {/* Grid Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Schedule & Venue */}
        <div className="rounded-2xl border bg-card p-6 space-y-4 shadow-xs">
          <h3 className="font-outfit text-base font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Schedule & Venue
          </h3>
          <div className="space-y-3 text-xs">
            <div>
              <span className="text-muted-foreground block">Event Date & Time</span>
              <span className="font-bold text-foreground">{detail.eventDate} ({detail.startTime})</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Rental Duration</span>
              <span className="font-bold text-foreground">{detail.durationHours} Hours</span>
            </div>
            <div>
              <span className="text-muted-foreground block">Delivery Address</span>
              <span className="font-bold text-foreground leading-relaxed">{detail.deliveryAddress}</span>
            </div>
          </div>
        </div>

        {/* Financial Breakdown */}
        <div className="rounded-2xl border bg-card p-6 space-y-4 shadow-xs">
          <h3 className="font-outfit text-base font-bold flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Financial Breakdown
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Package Subtotal:</span>
              <span className="font-bold">{formatPHP(detail.subtotalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery & Setup Fee:</span>
              <span className="font-bold">{formatPHP(detail.deliveryFee)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-extrabold text-sm text-foreground">
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
      <div className="rounded-2xl border bg-card p-6 space-y-4 shadow-xs">
        <h3 className="font-outfit text-base font-bold flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" /> Booking Timeline History
        </h3>
        <div className="space-y-3">
          {detail.timelineEvents.map((evt) => (
            <div key={evt.id} className="border-l-2 border-primary/30 pl-4 space-y-0.5 text-xs">
              <div className="flex justify-between font-bold text-foreground">
                <span>{evt.eventLabel}</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {new Date(evt.createdAt).toLocaleDateString()}
                </span>
              </div>
              {evt.eventDescription && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">{evt.eventDescription}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Review & Rating Form (Completed Bookings) */}
      {detail.status === "COMPLETED" && (
        <form onSubmit={handleReviewSubmit} className="rounded-2xl border bg-card p-6 space-y-4 shadow-xs">
          <h3 className="font-outfit text-base font-bold flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> Rate & Review Your Experience
          </h3>

          {reviewMsg && (
            <div className="p-3 text-xs font-semibold rounded-xl bg-primary/10 text-primary border">
              {reviewMsg}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-bold">Rating (1–5 Stars)</Label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setRating(s)}
                  className={`p-2 rounded-lg border transition-colors ${
                    s <= rating ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Star className={`h-5 w-5 ${s <= rating ? "fill-amber-500" : ""}`} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="review-comment" className="text-xs font-bold">Feedback / Comment</Label>
            <textarea
              id="review-comment"
              rows={3}
              placeholder="Tell us about the equipment, audio quality, or service..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <Button type="submit" disabled={isSubmittingReview} className="font-bold text-xs h-10 px-5">
            {isSubmittingReview ? "Submitting..." : "Submit Verified Review"}
          </Button>
        </form>
      )}

      {/* Cancellation Request Section */}
      {canRequestCancellation && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-outfit text-base font-bold text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" /> Request Booking Cancellation
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Need to cancel? Requests submitted here require administrator approval.
              </p>
            </div>
            {!showCancelForm && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowCancelForm(true)}
                className="font-bold text-xs h-9"
              >
                Request Cancel
              </Button>
            )}
          </div>

          {showCancelForm && (
            <form onSubmit={handleCancelSubmit} className="space-y-4 pt-2 border-t border-destructive/20">
              <div>
                <Label htmlFor="cancellation-reason" className="text-xs font-bold">
                  Cancellation Reason <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="cancellation-reason"
                  placeholder="e.g. Event date changed or emergency"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  disabled={isSubmittingCancel}
                  className="mt-1 text-xs h-10"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isSubmittingCancel}
                  className="font-bold text-xs h-10 px-5"
                >
                  {isSubmittingCancel ? "Submitting..." : "Confirm Cancellation Request"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCancelForm(false)}
                  disabled={isSubmittingCancel}
                  className="font-bold text-xs h-10"
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
