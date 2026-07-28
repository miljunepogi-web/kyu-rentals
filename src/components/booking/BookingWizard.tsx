"use client";

import { useState, useMemo, useCallback } from "react";
import { RentalPackage } from "@/queries/packages.queries";
import { createBookingAction } from "@/actions/booking.actions";
import { initializeBookingPaymentAction } from "@/actions/payment.actions";
import { formatPHP } from "@/utils/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Lock,
  ExternalLink,
} from "lucide-react";

interface BookingWizardProps {
  initialPackage: RentalPackage;
}

/**
 * Pure pricing computation helper for BookingWizard.
 * Purely declarative and deterministic; preserves exact pricing rules.
 */
function calculateWizardPricing(
  initialPackage: RentalPackage,
  durationHours: number,
  extraMics: number,
  extraLights: boolean,
  eventDate: string,
  deliveryZone: string
) {
  const basePrice =
    durationHours === 4
      ? initialPackage.price4Hours
      : durationHours === 8
      ? initialPackage.price8Hours
      : initialPackage.priceFullDay;

  const micAddonTotal = extraMics * 300;
  const lightAddonTotal = extraLights ? 500 : 0;
  const addonsTotal = micAddonTotal + lightAddonTotal;

  const isWeekend = eventDate ? [0, 6].includes(new Date(eventDate).getDay()) : false;
  const surchargeAmount = isWeekend ? Math.round((basePrice + addonsTotal) * 0.1) : 0;
  const deliveryFee = deliveryZone.includes("Outside") ? 500 : 250;
  const grandTotal = basePrice + addonsTotal + surchargeAmount + deliveryFee;
  const depositAmount = Math.round(grandTotal * 0.3);
  const balanceAmount = grandTotal - depositAmount;

  return {
    basePrice,
    micAddonTotal,
    lightAddonTotal,
    addonsTotal,
    isWeekend,
    surchargeAmount,
    deliveryFee,
    grandTotal,
    depositAmount,
    balanceAmount,
  };
}

export function BookingWizard({ initialPackage }: BookingWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form State
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("14:00");
  const [durationHours, setDurationHours] = useState<number>(4);
  const [extraMics, setExtraMics] = useState<number>(0);
  const [extraLights, setExtraLights] = useState<boolean>(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryZone, setDeliveryZone] = useState("Metro Manila Core (Free)");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [customerFullName, setCustomerFullName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Execution & Output States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [createdBookingId, setCreatedBookingId] = useState<string | null>(null);
  const [createdBookingPublicId, setCreatedBookingPublicId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reusable Centralized Error Handler (Polish Improvement #3)
  const handleError = useCallback((msg: string | null) => {
    setErrorMsg(msg);
  }, []);

  // Extracted Pricing Computation (Polish Improvement #6)
  const pricing = useMemo(
    () =>
      calculateWizardPricing(
        initialPackage,
        durationHours,
        extraMics,
        extraLights,
        eventDate,
        deliveryZone
      ),
    [initialPackage, durationHours, extraMics, extraLights, eventDate, deliveryZone]
  );

  // Extracted Dedicated Step Validation Functions (Polish Improvement #1)
  const validateStep1 = (): boolean => {
    if (!eventDate) {
      handleError("Please select a valid event date.");
      return false;
    }
    if (!startTime) {
      handleError("Please specify an event start time.");
      return false;
    }
    handleError(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    handleError(null);
    return true;
  };

  const validateStep3 = (): boolean => {
    if (!deliveryAddress.trim() || deliveryAddress.trim().length < 5) {
      handleError("Please enter a valid venue delivery address (minimum 5 characters).");
      return false;
    }
    handleError(null);
    return true;
  };

  const validateStep4 = (): boolean => {
    if (!customerFullName.trim() || customerFullName.trim().length < 2) {
      handleError("Please enter your full name.");
      return false;
    }
    if (!customerEmail.trim() || !customerEmail.includes("@")) {
      handleError("Please enter a valid email address.");
      return false;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 10) {
      handleError("Please enter a valid mobile phone number (at least 10 digits).");
      return false;
    }
    if (!termsAccepted) {
      handleError("Please accept the rental terms and conditions to proceed.");
      return false;
    }
    handleError(null);
    return true;
  };

  // Step Navigation Handlers
  const handleNextFromStep1 = () => {
    if (validateStep1()) setStep(2);
  };

  const handleNextFromStep2 = () => {
    if (validateStep2()) setStep(3);
  };

  const handleNextFromStep3 = () => {
    if (validateStep3()) setStep(4);
  };

  // Step 4 -> 5: Atomic Booking Creation
  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep4()) return;

    setIsSubmitting(true);

    try {
      const addonsPayload = [];
      if (extraMics > 0) {
        addonsPayload.push({ id: "add-mic", name: "Extra Wireless Mic", unitPrice: 300, quantity: extraMics });
      }
      if (extraLights) {
        addonsPayload.push({ id: "add-light", name: "Laser Disco Party Bar", unitPrice: 500, quantity: 1 });
      }

      // Secure Cryptographic UUID for Idempotency Key (Polish Improvement #2)
      const idempotencyKey = crypto.randomUUID();

      const result = await createBookingAction(
        {
          packageSlug: initialPackage.slug,
          eventDate,
          startTime,
          durationHours,
          deliveryAddress,
          deliveryZone,
          customerFullName,
          customerEmail,
          customerPhone,
          specialInstructions,
          addons: addonsPayload,
        },
        idempotencyKey
      );

      if (!result.success || !result.data) {
        handleError(result.error || "Failed to reserve booking. Please try again.");
        setIsSubmitting(false);
        return;
      }

      setCreatedBookingId(result.data.bookingId);
      setCreatedBookingPublicId(result.data.bookingPublicId);
      setStep(5);
      setIsSubmitting(false);
    } catch {
      handleError("An unexpected connection error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Step 5: PayMongo Gateway Redirect Handler
  const handlePayMongoRedirect = async () => {
    if (!createdBookingId) {
      handleError("Booking session expired. Please restart reservation.");
      return;
    }

    setIsRedirecting(true);
    handleError(null);

    try {
      const paymentResult = await initializeBookingPaymentAction({
        bookingId: createdBookingId,
      });

      if (!paymentResult.success || !paymentResult.data) {
        handleError(paymentResult.error || "Failed to initialize payment gateway session.");
        setIsRedirecting(false);
        return;
      }

      // Redirect browser to PayMongo Hosted Gateway URL
      window.location.href = paymentResult.data.checkoutUrl;
    } catch {
      handleError("Failed to redirect to PayMongo checkout. Please try again.");
      setIsRedirecting(false);
    }
  };

  const isBusy = isSubmitting || isRedirecting;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Wizard Progress Bar */}
      <div className="mb-8" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={5}>
        <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-3">
          <span className={step >= 1 ? "text-primary font-bold" : ""}>1. Schedule</span>
          <span className={step >= 2 ? "text-primary font-bold" : ""}>2. Add-ons</span>
          <span className={step >= 3 ? "text-primary font-bold" : ""}>3. Location</span>
          <span className={step >= 4 ? "text-primary font-bold" : ""}>4. Contact</span>
          <span className={step >= 5 ? "text-primary font-bold" : ""}>5. Payment</span>
        </div>
        <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interactive Form Steps */}
        <div className="lg:col-span-7 space-y-6">
          {errorMsg && (
            <div
              role="alert"
              className="flex items-center gap-3 rounded-xl bg-destructive/10 p-4 text-sm font-medium text-destructive border border-destructive/20"
            >
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: Date & Rental Schedule */}
          {step === 1 && (
            <div className="rounded-3xl border bg-card p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-outfit text-xl font-bold">Step 1: Select Event Schedule</h2>
                  <p className="text-xs text-muted-foreground">Pick your event date and desired rental duration.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="event-date" className="text-sm font-semibold">Event Date</Label>
                  <Input
                    id="event-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="mt-1.5 h-11"
                    required
                    disabled={isBusy}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="start-time" className="text-sm font-semibold">Start Time</Label>
                    <Input
                      id="start-time"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-1.5 h-11"
                      required
                      disabled={isBusy}
                    />
                  </div>
                  <div>
                    <Label htmlFor="duration-hours" className="text-sm font-semibold">Rental Duration</Label>
                    <select
                      id="duration-hours"
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      disabled={isBusy}
                      className="mt-1.5 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value={4}>4 Hours ({formatPHP(initialPackage.price4Hours)})</option>
                      <option value={8}>8 Hours ({formatPHP(initialPackage.price8Hours)})</option>
                      <option value={24}>Full Day ({formatPHP(initialPackage.priceFullDay)})</option>
                    </select>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleNextFromStep1}
                disabled={isBusy}
                className="w-full h-11 font-semibold text-base mt-4"
              >
                Continue to Add-ons <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* STEP 2: Add-ons & Microphones */}
          {step === 2 && (
            <div className="rounded-3xl border bg-card p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-outfit text-xl font-bold">Step 2: Equipment Add-ons</h2>
                  <p className="text-xs text-muted-foreground">Enhance your rental with extra microphones and lighting.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <p className="font-semibold text-sm">Extra Wireless Microphones</p>
                    <p className="text-xs text-muted-foreground">₱300 per additional mic (+batteries)</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExtraMics(Math.max(0, extraMics - 1))}
                      disabled={isBusy || extraMics === 0}
                      aria-label="Decrease extra microphones"
                    >
                      -
                    </Button>
                    <span className="font-bold text-sm w-4 text-center">{extraMics}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setExtraMics(Math.min(4, extraMics + 1))}
                      disabled={isBusy || extraMics === 4}
                      aria-label="Increase extra microphones"
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <label htmlFor="extra-lights-checkbox" className="font-semibold text-sm cursor-pointer">
                      Laser Disco Party Bar Upgrade
                    </label>
                    <p className="text-xs text-muted-foreground">₱500 / RGB sound-activated lasers</p>
                  </div>
                  <input
                    id="extra-lights-checkbox"
                    type="checkbox"
                    checked={extraLights}
                    onChange={(e) => setExtraLights(e.target.checked)}
                    disabled={isBusy}
                    className="h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(1)} disabled={isBusy} className="h-11">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleNextFromStep2} disabled={isBusy} className="flex-1 h-11 font-semibold text-base">
                  Continue to Delivery Location <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Delivery Location */}
          {step === 3 && (
            <div className="rounded-3xl border bg-card p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-outfit text-xl font-bold">Step 3: Delivery Venue Details</h2>
                  <p className="text-xs text-muted-foreground">Enter your event venue address for setup delivery.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="delivery-zone" className="text-sm font-semibold">Delivery Zone</Label>
                  <select
                    id="delivery-zone"
                    value={deliveryZone}
                    onChange={(e) => setDeliveryZone(e.target.value)}
                    disabled={isBusy}
                    className="mt-1.5 flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="Metro Manila Core (Free)">Metro Manila Core (Standard Delivery - ₱250)</option>
                    <option value="Outside Metro Manila">Outside Metro Manila (Rizal / Cavite / Laguna - ₱500)</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="address" className="text-sm font-semibold">Full Event Address</Label>
                  <Input
                    id="address"
                    placeholder="House/Unit #, Street, Barangay, City"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    disabled={isBusy}
                    className="mt-1.5 h-11"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="instructions" className="text-sm font-semibold">Special Setup Instructions (Optional)</Label>
                  <Input
                    id="instructions"
                    placeholder="Gate code, condo loading bay rules, floor #"
                    value={specialInstructions}
                    onChange={(e) => setSpecialInstructions(e.target.value)}
                    disabled={isBusy}
                    className="mt-1.5 h-11"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setStep(2)} disabled={isBusy} className="h-11">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={handleNextFromStep3} disabled={isBusy} className="flex-1 h-11 font-semibold text-base">
                  Continue to Contact Details <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: Customer Details & Terms */}
          {step === 4 && (
            <form onSubmit={handleProceedToPayment} className="rounded-3xl border bg-card p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-outfit text-xl font-bold">Step 4: Contact Information</h2>
                  <p className="text-xs text-muted-foreground">Where should we send your booking confirmation & receipt?</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName" className="text-sm font-semibold">Full Name</Label>
                  <Input
                    id="fullName"
                    placeholder="Juan Dela Cruz"
                    value={customerFullName}
                    onChange={(e) => setCustomerFullName(e.target.value)}
                    disabled={isBusy}
                    className="mt-1.5 h-11"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="juan@example.com"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      disabled={isBusy}
                      className="mt-1.5 h-11"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone" className="text-sm font-semibold">Mobile Phone (GCash/SMS)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="09171234567"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      disabled={isBusy}
                      className="mt-1.5 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl bg-secondary/40 p-4 border text-xs">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    disabled={isBusy}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                  <label htmlFor="terms" className="cursor-pointer text-muted-foreground leading-relaxed">
                    I agree to the KYU Rentals{" "}
                    <a href="/policies/cancellation" target="_blank" rel="noreferrer" className="font-semibold text-foreground underline underline-offset-2">
                      cancellation and refund policy
                    </a>
                    . I understand that the <strong>30% reservation deposit is non-refundable for customer-initiated cancellations</strong>, while all booking payments are refunded if KYU Rentals cannot fulfill the confirmed booking. The remaining 70% balance is collected upon delivery.
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(3)} className="h-11" disabled={isBusy}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button type="submit" className="flex-1 h-12 font-bold text-base" disabled={isBusy}>
                  {isSubmitting ? (
                    "Reserving Inventory..."
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" /> Reserve Date & Pay {formatPHP(pricing.depositAmount)}
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* STEP 5: Payment Summary */}
          {step === 5 && (
            <div className="rounded-3xl border bg-card p-6 md:p-8 shadow-xs space-y-6">
              <div className="flex items-center gap-3 pb-4 border-b">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10 text-green-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-outfit text-xl font-bold">Step 5: Reservation Soft-Locked</h2>
                  <p className="text-xs text-muted-foreground">
                    Booking Reference: <strong className="text-foreground">{createdBookingPublicId}</strong>
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-secondary/50 p-5 border space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Package:</span>
                  <span className="font-bold">{initialPackage.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Event Date:</span>
                  <span className="font-bold">{eventDate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deposit Due Now (30%):</span>
                  <span className="font-extrabold text-primary text-base">{formatPHP(pricing.depositAmount)}</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Your inventory is locked for 15 minutes. Click below to open PayMongo secure gateway (GCash, Maya, Cards).
              </p>

              <Button
                onClick={handlePayMongoRedirect}
                disabled={isRedirecting}
                className="w-full h-12 text-base font-bold"
              >
                {isRedirecting ? (
                  "Connecting to PayMongo Gateway..."
                ) : (
                  <>
                    Proceed to PayMongo Checkout <ExternalLink className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Right Column: Live Order Summary Sidebar */}
        <div className="lg:col-span-5">
          <div className="sticky top-24 rounded-3xl border bg-card p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="font-outfit text-lg font-bold">Reservation Summary</h3>
              <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                {initialPackage.name}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Package Base ({durationHours} Hours):</span>
                <span className="font-bold text-foreground">{formatPHP(pricing.basePrice)}</span>
              </div>

              {extraMics > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Extra Microphones ({extraMics}x):</span>
                  <span className="font-semibold text-foreground">{formatPHP(pricing.micAddonTotal)}</span>
                </div>
              )}

              {extraLights && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Laser Lights Upgrade:</span>
                  <span className="font-semibold text-foreground">{formatPHP(pricing.lightAddonTotal)}</span>
                </div>
              )}

              {pricing.isWeekend && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                  <span>Weekend Peak Surcharge (10%):</span>
                  <span className="font-bold">{formatPHP(pricing.surchargeAmount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-muted-foreground">Delivery & Setup Fee:</span>
                <span className="font-bold text-foreground">{formatPHP(pricing.deliveryFee)}</span>
              </div>
            </div>

            {/* Total Highlight */}
            <div className="rounded-2xl bg-secondary/50 p-4 border space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Grand Total</span>
                <span className="font-outfit text-2xl font-extrabold text-foreground">{formatPHP(pricing.grandTotal)}</span>
              </div>
              <div className="pt-2 border-t flex justify-between text-xs font-bold text-primary">
                <span>30% Deposit Due Now:</span>
                <span>{formatPHP(pricing.depositAmount)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>70% Balance Due on Delivery:</span>
                <span>{formatPHP(pricing.balanceAmount)}</span>
              </div>
            </div>

            {/* Trust Footer */}
            <div className="space-y-2 text-[11px] text-muted-foreground pt-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                <span>256-bit SSL Encrypted Payment via PayMongo</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary shrink-0" />
                <span>15-Minute Inventory Lock upon checkout</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
