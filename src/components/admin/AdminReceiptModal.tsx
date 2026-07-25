"use client";

import { useRef } from "react";
import { AdminBookingDetail } from "@/queries/admin.queries";
import { formatPHP } from "@/utils/currency";
import { formatEventDate, formatShortDate } from "@/utils/date";
import { Button } from "@/components/ui/button";
import { X, Printer, Receipt, CheckCircle2 } from "lucide-react";

interface AdminReceiptModalProps {
  detail: AdminBookingDetail;
  onClose: () => void;
}

export function AdminReceiptModal({ detail, onClose }: AdminReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const latestPayment = detail.payments[0] || null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Official Receipt"
    >
      <div className="w-full max-w-lg bg-card border rounded-3xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            <h3 className="font-outfit font-bold text-lg">Official Payment Receipt</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handlePrint} className="h-8 gap-1 text-xs font-bold">
              <Printer className="h-3.5 w-3.5" /> Print
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Printable Voucher Surface */}
        <div ref={printRef} className="space-y-6 text-xs bg-background p-6 rounded-2xl border">
          {/* Brand Header */}
          <div className="text-center space-y-1 border-b pb-4">
            <div className="font-outfit font-extrabold text-2xl tracking-tight text-primary">
              KYU RENTALS
            </div>
            <p className="text-[11px] text-muted-foreground font-semibold">
              Premium Karaoke Setup & Sound System Equipment Rentals
            </p>
            <p className="text-[10px] text-muted-foreground">Metro Manila & Calabarzon Service Areas</p>
          </div>

          {/* Receipt Meta */}
          <div className="grid grid-cols-2 gap-4 border-b pb-4 text-[11px]">
            <div>
              <span className="text-muted-foreground block">Receipt No:</span>
              <span className="font-mono font-bold text-foreground">{latestPayment?.publicId || `REC-${detail.publicId}`}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground block">Date & Time:</span>
              <span className="font-bold text-foreground">
                {latestPayment ? formatShortDate(latestPayment.createdAt) : formatShortDate(new Date().toISOString())}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block">Booking Reference:</span>
              <span className="font-mono font-bold text-primary">{detail.publicId}</span>
            </div>
            <div className="text-right">
              <span className="text-muted-foreground block">Event Date:</span>
              <span className="font-bold text-foreground">{formatEventDate(detail.eventDate)}</span>
            </div>
          </div>

          {/* Customer & Location */}
          <div className="space-y-1 border-b pb-4 text-[11px]">
            <span className="text-muted-foreground block font-bold uppercase tracking-wider text-[10px]">Bill To:</span>
            <p className="font-bold text-foreground text-xs">{detail.customerName}</p>
            <p className="text-muted-foreground">{detail.customerPhone} • {detail.customerEmail}</p>
            <p className="text-muted-foreground">{detail.deliveryAddress} ({detail.deliveryZone || "Metro Manila"})</p>
          </div>

          {/* Itemized Table */}
          <div className="space-y-2">
            <div className="flex justify-between font-bold text-[10px] uppercase text-muted-foreground border-b pb-1">
              <span>Item Description</span>
              <span>Amount</span>
            </div>

            <div className="flex justify-between py-1 border-b border-dashed">
              <span>{detail.packageName} (Base Rental)</span>
              <span className="font-bold">{formatPHP(detail.subtotalAmount)}</span>
            </div>

            {detail.deliveryFee > 0 && (
              <div className="flex justify-between py-1 border-b border-dashed">
                <span>Delivery & Setup Fee</span>
                <span className="font-bold">{formatPHP(detail.deliveryFee)}</span>
              </div>
            )}

            {detail.surchargeAmount > 0 && (
              <div className="flex justify-between py-1 border-b border-dashed text-amber-600">
                <span>Peak Surcharge</span>
                <span className="font-bold">{formatPHP(detail.surchargeAmount)}</span>
              </div>
            )}

            {detail.discountAmount > 0 && (
              <div className="flex justify-between py-1 border-b border-dashed text-emerald-600">
                <span>Promo Discount</span>
                <span className="font-bold">-{formatPHP(detail.discountAmount)}</span>
              </div>
            )}

            {/* Totals */}
            <div className="space-y-1.5 pt-2 font-semibold">
              <div className="flex justify-between text-foreground">
                <span>Grand Total:</span>
                <span className="font-bold">{formatPHP(detail.grandTotal)}</span>
              </div>

              <div className="flex justify-between text-primary font-bold">
                <span>Deposit Paid:</span>
                <span>{formatPHP(detail.depositAmount)}</span>
              </div>

              <div className="flex justify-between text-foreground font-extrabold border-t pt-2 text-sm">
                <span>Remaining Balance Due:</span>
                <span className={detail.balanceAmount > 0 ? "text-amber-600" : "text-emerald-600"}>
                  {formatPHP(detail.balanceAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method Badge */}
          {latestPayment && (
            <div className="rounded-xl bg-secondary/50 p-3 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-muted-foreground block text-[10px]">Payment Method:</span>
                <span className="font-bold text-foreground">{latestPayment.paymentMethod}</span>
                {latestPayment.gatewayTransactionId && (
                  <span className="text-[10px] font-mono text-muted-foreground block">
                    Ref: {latestPayment.gatewayTransactionId}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-emerald-600 font-extrabold">
                <CheckCircle2 className="h-4 w-4" />
                <span>{latestPayment.status}</span>
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="text-center text-[10px] text-muted-foreground pt-4 border-t space-y-1">
            <p>Thank you for choosing KYU Rentals!</p>
            <p>For support or changes, contact info@kyurentals.ph</p>
          </div>
        </div>
      </div>
    </div>
  );
}
