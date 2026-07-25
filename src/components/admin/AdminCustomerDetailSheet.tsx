"use client";

import { useState, useEffect } from "react";
import { AdminCustomerDetail, getAdminCustomerDetail } from "@/queries/admin-customer.queries";
import { formatPHP } from "@/utils/currency";
import { formatShortDate, formatEventDate } from "@/utils/date";
import { getStatusLabel, getStatusBadgeClass } from "@/config/booking-status.config";
import { Button } from "@/components/ui/button";
import {
  X,
  User,
  Phone,
  Mail,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";

interface AdminCustomerDetailSheetProps {
  customerId: string | null;
  onClose: () => void;
}

export function AdminCustomerDetailSheet({ customerId, onClose }: AdminCustomerDetailSheetProps) {
  const [detail, setDetail] = useState<AdminCustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!customerId) return;
    let isMounted = true;
    getAdminCustomerDetail(customerId).then((data) => {
      if (isMounted) {
        setDetail(data);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, [customerId]);

  if (!customerId) return null;

  const handleWhatsApp = (phone: string | null) => {
    if (!phone) {
      toast.error("No phone number recorded for customer.");
      return;
    }
    const cleanPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${cleanPhone}`, "_blank");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Customer Profile Details"
    >
      <div className="w-full max-w-xl bg-card border-l h-full overflow-y-auto p-6 md:p-8 space-y-6 shadow-2xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <div>
              <span className="text-xs font-bold text-primary tracking-wider uppercase">
                Customer CRM Profile
              </span>
              <h2 className="font-outfit text-2xl font-bold mt-0.5">
                {detail ? detail.fullName : "Loading Customer..."}
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full shrink-0">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {isLoading ? (
            <div className="py-20 text-center text-muted-foreground text-sm font-medium">
              Loading customer profile...
            </div>
          ) : !detail ? (
            <div className="py-20 text-center text-destructive text-sm font-medium">
              Customer profile not found.
            </div>
          ) : (
            <div className="space-y-6 text-xs">
              {/* Quick Communication Actions Bar */}
              <div className="rounded-2xl border bg-primary/5 p-4 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary block">
                  Quick Communication Options
                </span>
                <div className="flex flex-wrap gap-2">
                  {detail.phone && (
                    <a
                      href={`tel:${detail.phone}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border font-bold text-foreground hover:border-primary transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5 text-primary" /> Call Phone
                    </a>
                  )}
                  {detail.email && (
                    <a
                      href={`mailto:${detail.email}?subject=KYU Rentals Booking Inquiry`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-background border font-bold text-foreground hover:border-primary transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5 text-primary" /> Email
                    </a>
                  )}
                  {detail.phone && (
                    <button
                      onClick={() => handleWhatsApp(detail.phone)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 font-bold text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                    </button>
                  )}
                </div>
              </div>

              {/* Lifetime Overview KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border bg-secondary/30 p-3 space-y-1">
                  <span className="text-[10px] text-muted-foreground font-semibold block">Total Rentals</span>
                  <span className="font-extrabold text-base block text-foreground">{detail.totalBookings}</span>
                </div>
                <div className="rounded-2xl border bg-secondary/30 p-3 space-y-1">
                  <span className="text-[10px] text-muted-foreground font-semibold block">Lifetime Value</span>
                  <span className="font-extrabold text-base block text-emerald-600">{formatPHP(detail.totalSpent)}</span>
                </div>
                <div className="rounded-2xl border bg-secondary/30 p-3 space-y-1 col-span-2">
                  <span className="text-[10px] text-muted-foreground font-semibold block">Favorite Package</span>
                  <span className="font-extrabold text-xs block text-foreground truncate">
                    {detail.favoritePackageName || "None"}
                  </span>
                </div>
              </div>

              {/* Contact Profile Summary */}
              <div className="rounded-2xl border bg-secondary/30 p-4 space-y-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Contact Identity
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Email</span>
                    <span className="font-bold text-foreground">{detail.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Phone</span>
                    <span className="font-bold text-foreground">{detail.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Customer Since</span>
                    <span className="font-bold text-foreground">{formatShortDate(detail.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Customer Ref</span>
                    <span className="font-mono font-bold text-foreground">{detail.publicId}</span>
                  </div>
                </div>
              </div>

              {/* Rental History Log */}
              <div className="rounded-2xl border bg-secondary/30 p-5 space-y-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" /> Booking History ({detail.bookings.length})
                </h3>
                {detail.bookings.length === 0 ? (
                  <div className="text-muted-foreground italic py-2">No bookings recorded yet.</div>
                ) : (
                  <div className="space-y-2.5">
                    {detail.bookings.map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border text-xs"
                      >
                        <div>
                          <div className="font-bold flex items-center gap-2">
                            <span>{b.packageName}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">({b.publicId})</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {formatEventDate(b.eventDate)} • {formatPHP(b.grandTotal)}
                          </div>
                        </div>
                        <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${getStatusBadgeClass(b.status)}`}>
                          {getStatusLabel(b.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
