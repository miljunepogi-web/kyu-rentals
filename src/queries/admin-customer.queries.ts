import { createClient } from "@/lib/supabase/client";

export interface AdminCustomerListItem {
  id: string;
  publicId: string;
  fullName: string;
  email: string;
  phone: string | null;
  totalBookings: number;
  totalSpent: number;
  lastBookingDate: string | null;
  favoritePackageName: string | null;
  createdAt: string;
}

export interface AdminCustomerDetail extends AdminCustomerListItem {
  bookings: {
    id: string;
    publicId: string;
    packageName: string;
    eventDate: string;
    status: string;
    grandTotal: number;
    balanceAmount: number;
  }[];
}

export async function getAdminCustomerList(): Promise<AdminCustomerListItem[]> {
  const supabase = createClient();

  // 1. Fetch customer profiles
  type ProfileRow = {
    id: string;
    public_id: string;
    full_name: string;
    email: string;
    phone: string | null;
    created_at: string;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles, error } = await (supabase as any)
    .from("profiles")
    .select("id, public_id, full_name, email, phone, created_at")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false }) as { data: ProfileRow[] | null; error: unknown };

  if (error || !profiles) return [];

  // 2. Fetch all non-deleted bookings to aggregate lifetime metrics
  type BookingRow = {
    id: string;
    customer_id: string;
    grand_total: number;
    event_date: string;
    status: string;
    packages: { name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: bookings } = await (supabase as any)
    .from("bookings")
    .select("id, customer_id, grand_total, event_date, status, packages!package_id (name)")
    .eq("is_deleted", false) as { data: BookingRow[] | null; error: unknown };

  const bookingList = bookings || [];

  // Map metrics per customer
  const customerMap = new Map<string, {
    totalBookings: number;
    totalSpent: number;
    lastBookingDate: string | null;
    pkgCounts: Map<string, number>;
  }>();

  bookingList.forEach((b) => {
    if (!b.customer_id) return;
    const entry = customerMap.get(b.customer_id) || {
      totalBookings: 0,
      totalSpent: 0,
      lastBookingDate: null,
      pkgCounts: new Map<string, number>(),
    };

    entry.totalBookings += 1;
    if (!["CANCELLED", "REJECTED", "EXPIRED", "DRAFT"].includes(b.status)) {
      entry.totalSpent += Number(b.grand_total) || 0;
    }

    if (!entry.lastBookingDate || b.event_date > entry.lastBookingDate) {
      entry.lastBookingDate = b.event_date;
    }

    const pkgName = b.packages?.name || "Karaoke Setup";
    entry.pkgCounts.set(pkgName, (entry.pkgCounts.get(pkgName) || 0) + 1);

    customerMap.set(b.customer_id, entry);
  });

  return profiles.map((p) => {
    const stats = customerMap.get(p.id);
    let favoritePackageName: string | null = null;
    if (stats && stats.pkgCounts.size > 0) {
      let maxCount = 0;
      stats.pkgCounts.forEach((count, name) => {
        if (count > maxCount) {
          maxCount = count;
          favoritePackageName = name;
        }
      });
    }

    return {
      id: p.id,
      publicId: p.public_id,
      fullName: p.full_name || "Guest Customer",
      email: p.email,
      phone: p.phone,
      totalBookings: stats?.totalBookings || 0,
      totalSpent: stats?.totalSpent || 0,
      lastBookingDate: stats?.lastBookingDate || null,
      favoritePackageName,
      createdAt: p.created_at,
    };
  });
}

export async function getAdminCustomerDetail(customerId: string): Promise<AdminCustomerDetail | null> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: p, error } = await (supabase as any)
    .from("profiles")
    .select("id, public_id, full_name, email, phone, created_at")
    .eq("id", customerId)
    .eq("is_deleted", false)
    .single();

  if (error || !p) return null;

  interface RawCustomerBookingRecord {
    id: string;
    public_id: string;
    event_date: string;
    status: string;
    grand_total: number;
    balance_amount: number;
    packages?: { name?: string | null } | null;
  }

  // Fetch customer's bookings
  const { data: customerBookings } = await supabase
    .from("bookings")
    .select("id, public_id, event_date, status, grand_total, balance_amount, packages!package_id (name)")
    .eq("customer_id", customerId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false });

  const bookings = ((customerBookings as unknown as RawCustomerBookingRecord[]) || []).map((b) => ({
    id: b.id,
    publicId: b.public_id,
    packageName: b.packages?.name || "Karaoke Setup",
    eventDate: b.event_date,
    status: b.status,
    grandTotal: Number(b.grand_total) || 0,
    balanceAmount: Number(b.balance_amount) || 0,
  }));

  const validBookings = bookings.filter((b: { status: string }) => !["CANCELLED", "REJECTED", "EXPIRED", "DRAFT"].includes(b.status));
  const totalSpent = validBookings.reduce((sum: number, b: { grandTotal: number }) => sum + b.grandTotal, 0);

  let favoritePackageName: string | null = null;
  const pkgCounts = new Map<string, number>();
  bookings.forEach((b: { packageName: string }) => {
    pkgCounts.set(b.packageName, (pkgCounts.get(b.packageName) || 0) + 1);
  });
  let maxCount = 0;
  pkgCounts.forEach((count, name) => {
    if (count > maxCount) {
      maxCount = count;
      favoritePackageName = name;
    }
  });

  return {
    id: p.id,
    publicId: p.public_id,
    fullName: p.full_name || "Guest Customer",
    email: p.email,
    phone: p.phone,
    totalBookings: bookings.length,
    totalSpent,
    lastBookingDate: bookings[0]?.eventDate || null,
    favoritePackageName,
    createdAt: p.created_at,
    bookings,
  };
}
