import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CalendarClock, CircleDollarSign, ShieldCheck } from "lucide-react";
import {
  CANCELLATION_POLICY,
  CUSTOMER_CANCELLATION_SUMMARY,
} from "@/config/cancellation-policy.config";

export const metadata: Metadata = {
  title: "Cancellation and Refund Policy",
  description: "KYU Rentals cancellation, refund, and rescheduling terms.",
};

export default function CancellationPolicyPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 md:py-14">
      <Link
        href="/packages"
        className="text-muted-foreground hover:text-foreground mb-8 inline-flex items-center gap-2 text-sm font-semibold transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to packages
      </Link>

      <header className="border-b pb-8">
        <p className="text-primary text-sm font-semibold">KYU Rentals</p>
        <h1 className="font-outfit mt-2 text-3xl font-bold md:text-4xl">
          Cancellation and Refund Policy
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
          These terms apply to customer reservations made through the KYU Rentals website. They form
          part of the rental agreement accepted before deposit payment.
        </p>
      </header>

      <div className="divide-y">
        <section className="grid gap-4 py-8 md:grid-cols-[180px_1fr]">
          <h2 className="font-outfit flex items-center gap-2 text-lg font-bold">
            <CircleDollarSign className="text-primary h-5 w-5" />
            Deposit
          </h2>
          <div className="text-muted-foreground space-y-3 text-sm leading-6">
            <p>{CANCELLATION_POLICY.customerCancellation}</p>
            <p>
              The deposit reserves the selected event date and equipment. The remaining 70% balance
              is due under the payment terms shown during checkout.
            </p>
          </div>
        </section>

        <section className="grid gap-4 py-8 md:grid-cols-[180px_1fr]">
          <h2 className="font-outfit flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="text-primary h-5 w-5" />
            KYU cancellation
          </h2>
          <p className="text-muted-foreground text-sm leading-6">
            {CANCELLATION_POLICY.merchantCancellation}
          </p>
        </section>

        <section className="grid gap-4 py-8 md:grid-cols-[180px_1fr]">
          <h2 className="font-outfit flex items-center gap-2 text-lg font-bold">
            <CalendarClock className="text-primary h-5 w-5" />
            Rescheduling
          </h2>
          <div className="text-muted-foreground space-y-3 text-sm leading-6">
            <p>{CANCELLATION_POLICY.exceptionalRescheduling}</p>
            <p>
              A requested date change is not effective until KYU Rentals confirms the new schedule.
              Additional charges may apply when the package, location, or rental duration changes.
            </p>
          </div>
        </section>

        <section className="py-8">
          <h2 className="font-outfit text-lg font-bold">How cancellation requests work</h2>
          <ol className="text-muted-foreground mt-4 grid gap-3 text-sm leading-6 md:grid-cols-3">
            <li>
              <strong className="text-foreground block">1. Submit a reason</strong>
              Open the confirmed booking in your customer dashboard and request cancellation.
            </li>
            <li>
              <strong className="text-foreground block">2. Admin review</strong>
              The reservation remains held while KYU Rentals reviews the request.
            </li>
            <li>
              <strong className="text-foreground block">3. Written decision</strong>
              The booking is cancelled only after approval; otherwise it remains confirmed.
            </li>
          </ol>
        </section>
      </div>

      <div className="text-muted-foreground border-t pt-6 text-xs leading-5">
        {CUSTOMER_CANCELLATION_SUMMARY.join(" ")}
      </div>
    </div>
  );
}
