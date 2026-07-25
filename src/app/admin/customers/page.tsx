"use client";

import { useState, useEffect } from "react";
import { AdminCustomerListItem, getAdminCustomerList } from "@/queries/admin-customer.queries";
import { AdminCustomerDetailSheet } from "@/components/admin/AdminCustomerDetailSheet";
import { formatPHP } from "@/utils/currency";
import { formatShortDate } from "@/utils/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  RefreshCw,
  Eye,
} from "lucide-react";

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<AdminCustomerListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const loadCustomers = () => {
    setIsLoading(true);
    getAdminCustomerList().then((data) => {
      setCustomers(data);
      setIsLoading(false);
    });
  };

  useEffect(() => {
    let isMounted = true;
    getAdminCustomerList().then((data) => {
      if (isMounted) {
        setCustomers(data);
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.fullName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      c.publicId.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5">
        <div>
          <span className="text-xs font-bold text-primary uppercase tracking-widest">
            CRM & Customer Management
          </span>
          <h1 className="font-outfit text-3xl font-extrabold mt-1 text-foreground">
            Customer Directory
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track lifetime rental value, preferred packages, and contact communication history.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadCustomers}
          disabled={isLoading}
          className="h-9 gap-1.5 font-semibold text-xs rounded-xl"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Directory
        </Button>
      </div>

      {/* Search Bar */}
      <div className="bg-card border rounded-2xl p-4 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer name, email, phone, or customer ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10 text-xs font-medium"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b bg-secondary/50 font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                <th className="p-4">Customer</th>
                <th className="p-4 hidden sm:table-cell">Contact</th>
                <th className="p-4 text-center">Rentals</th>
                <th className="p-4 hidden md:table-cell">Lifetime Value</th>
                <th className="p-4 hidden lg:table-cell">Favorite Package</th>
                <th className="p-4 hidden xl:table-cell">Last Booking</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground font-medium">
                    Loading customer directory...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-muted-foreground font-medium">
                    No customer records found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className="hover:bg-secondary/30 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <span className="font-bold block text-foreground">{c.fullName}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">{c.publicId}</span>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <span className="block text-foreground font-medium">{c.email}</span>
                      <span className="text-[11px] text-muted-foreground">{c.phone || "—"}</span>
                    </td>
                    <td className="p-4 text-center font-extrabold text-foreground">
                      {c.totalBookings}
                    </td>
                    <td className="p-4 hidden md:table-cell font-extrabold text-emerald-600">
                      {formatPHP(c.totalSpent)}
                    </td>
                    <td className="p-4 hidden lg:table-cell font-semibold text-foreground max-w-[160px] truncate">
                      {c.favoritePackageName || "—"}
                    </td>
                    <td className="p-4 hidden xl:table-cell text-muted-foreground font-medium whitespace-nowrap">
                      {c.lastBookingDate ? formatShortDate(c.lastBookingDate) : "—"}
                    </td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedCustomerId(c.id)}
                        className="h-8 font-semibold text-xs gap-1.5 rounded-xl"
                      >
                        <Eye className="h-3.5 w-3.5" /> View CRM
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Sheet Integration */}
      {selectedCustomerId && (
        <AdminCustomerDetailSheet
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}
    </div>
  );
}
