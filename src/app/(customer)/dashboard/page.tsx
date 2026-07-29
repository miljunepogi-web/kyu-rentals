"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CustomerBookingListItem, getCustomerBookings } from "@/queries/customer.queries";
import { formatPHP } from "@/utils/currency";
import { getStatusLabel, getStatusBadgeClass } from "@/config/booking-status.config";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Eye, Plus, Box, LogOut, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CustomerDashboardPage() {
  const [bookings, setBookings] = useState<CustomerBookingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && isMounted) {
        getCustomerBookings(user.id).then((data) => {
          if (isMounted) {
            setBookings(data);
            setIsLoading(false);
          }
        });
      } else if (isMounted) {
        setIsLoading(false);
      }
    });

    return () => { isMounted = false; };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/admin");
    router.refresh();
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto px-4 py-6 sm:py-8">
      {/* Responsive Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">
            Customer Dashboard
          </span>
          <h1 className="font-outfit text-2xl sm:text-3xl font-extrabold mt-1">My Rentals & Bookings</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild className="font-bold text-xs sm:text-sm h-11 min-h-[44px] px-5 gap-2 flex-1 sm:flex-none">
            <Link href="/packages">
              <Plus className="h-4 w-4 shrink-0" /> Book New Package
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="font-bold text-xs sm:text-sm h-11 min-h-[44px] px-4 gap-2 text-destructive hover:bg-destructive/10"
            aria-label="Sign out of customer account"
          >
            <LogOut className="h-4 w-4 shrink-0" /> Sign Out
          </Button>
        </div>
      </div>

      {/* Bookings Ledger */}
      <div className="space-y-4">
        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="py-16 text-center text-muted-foreground text-sm font-medium space-y-3"
          >
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" aria-hidden="true" />
            <span>Loading your bookings...</span>
          </div>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl border bg-card p-8 sm:p-12 text-center space-y-4 shadow-xs">
            <Box className="h-10 w-10 text-muted-foreground mx-auto opacity-40" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="font-outfit text-lg font-bold">No Bookings Found</h3>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                You haven&apos;t placed any karaoke package rentals yet. Explore our packages and book your next event!
              </p>
            </div>
            <Button asChild className="font-bold text-xs sm:text-sm h-11 min-h-[44px] px-6 mt-2">
              <Link href="/packages">Explore Packages</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="rounded-2xl border bg-card p-5 sm:p-6 shadow-xs hover:border-primary/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-5 sm:gap-6"
              >
                <div className="space-y-3 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-primary">{b.publicId}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-extrabold border whitespace-nowrap inline-block ${getStatusBadgeClass(b.status)}`}>
                      {getStatusLabel(b.status)}
                    </span>
                  </div>

                  <h3 className="font-outfit text-lg sm:text-xl font-bold text-foreground">
                    {b.packageName}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                      {b.eventDate} ({b.startTime}) — {b.durationHours} Hours
                    </span>
                    <span className="flex items-center gap-1.5 font-medium truncate">
                      <MapPin className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
                      {b.deliveryAddress}
                    </span>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-4 md:pt-0 gap-3 border-border">
                  <div className="text-left md:text-right">
                    <span className="text-[11px] text-muted-foreground block font-medium">Total Amount</span>
                    <span className="font-outfit text-base sm:text-lg font-extrabold text-foreground">
                      {formatPHP(b.grandTotal)}
                    </span>
                  </div>

                  <Button asChild variant="outline" size="sm" className="font-bold text-xs sm:text-sm h-11 min-h-[44px] px-4 gap-1.5">
                    <Link href={`/dashboard/bookings/${b.id}`}>
                      <Eye className="h-3.5 w-3.5 shrink-0" /> View Details
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
