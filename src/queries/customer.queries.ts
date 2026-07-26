import { createClient } from "@/lib/supabase/client";

export interface CustomerBookingListItem {
  id: string;
  publicId: string;
  packageName: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  deliveryAddress: string;
  status: string;
  grandTotal: number;
  depositAmount: number;
  balanceAmount: number;
  createdAt: string;
}

export interface CustomerBookingDetail extends CustomerBookingListItem {
  deliveryZone: string | null;
  specialInstructions: string | null;
  subtotalAmount: number;
  surchargeAmount: number;
  deliveryFee: number;
  discountAmount: number;
  assignedUnitSerial: string | null;
  assignedPersonnelName: string | null;
  vehicleInfo: string | null;
  payments: {
    id: string;
    publicId: string;
    amount: number;
    status: string;
    paymentType: string;
    paymentMethod: string;
    createdAt: string;
  }[];
  timelineEvents: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    eventLabel: string;
    eventDescription: string | null;
    createdAt: string;
  }[];
}

export interface CustomerProfile {
  id: string;
  publicId: string;
  fullName: string;
  email: string;
  phone: string | null;
}

export async function getCustomerBookings(customerId: string): Promise<CustomerBookingListItem[]> {
  const supabase = createClient();

  type BookingRow = {
    id: string;
    public_id: string;
    event_date: string;
    start_time: string;
    duration_hours: number;
    delivery_address: string;
    status: string;
    grand_total: number;
    deposit_amount: number;
    balance_amount: number;
    created_at: string;
    packages: { name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("bookings")
    .select(`
      id, public_id, event_date, start_time, duration_hours, delivery_address, status,
      grand_total, deposit_amount, balance_amount, created_at,
      packages!package_id (name)
    `)
    .eq("customer_id", customerId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false }) as { data: BookingRow[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((b) => ({
    id: b.id,
    publicId: b.public_id,
    packageName: b.packages?.name || "Karaoke Package",
    eventDate: b.event_date,
    startTime: b.start_time,
    durationHours: b.duration_hours,
    deliveryAddress: b.delivery_address,
    status: b.status,
    grandTotal: Number(b.grand_total) || 0,
    depositAmount: Number(b.deposit_amount) || 0,
    balanceAmount: Number(b.balance_amount) || 0,
    createdAt: b.created_at,
  }));
}

export async function getCustomerBookingDetail(
  bookingId: string,
  customerId: string
): Promise<CustomerBookingDetail | null> {
  const supabase = createClient();

  type DetailRow = {
    id: string;
    public_id: string;
    event_date: string;
    start_time: string;
    duration_hours: number;
    delivery_address: string;
    delivery_zone: string | null;
    special_instructions: string | null;
    status: string;
    subtotal_amount: number;
    surcharge_amount: number;
    delivery_fee: number;
    discount_amount: number;
    grand_total: number;
    deposit_amount: number;
    balance_amount: number;
    vehicle_info: string | null;
    created_at: string;
    packages: { name: string } | null;
    inventory_units?: { serial_number: string } | null;
    assigned_personnel?: { full_name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: b, error } = await (supabase as any)
    .from("bookings")
    .select(`
      id, public_id, event_date, start_time, duration_hours, delivery_address, delivery_zone,
      special_instructions, status, subtotal_amount, surcharge_amount, delivery_fee,
      discount_amount, grand_total, deposit_amount, balance_amount, vehicle_info, created_at,
      packages!package_id (name),
      inventory_units!assigned_unit_id (serial_number),
      assigned_personnel:profiles!assigned_delivery_personnel_id (full_name)
    `)
    .eq("id", bookingId)
    .eq("customer_id", customerId)
    .eq("is_deleted", false)
    .maybeSingle() as { data: DetailRow | null; error: unknown };

  if (error || !b) return null;

  // Fetch payments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: payments } = await (supabase as any)
    .from("payments")
    .select("id, public_id, amount, status, payment_type, payment_method, created_at")
    .eq("booking_id", bookingId);

  // Fetch timeline
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: timeline } = await (supabase as any)
    .from("booking_timeline_events")
    .select("id, from_status, to_status, event_label, event_description, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  return {
    id: b.id,
    publicId: b.public_id,
    packageName: b.packages?.name || "Karaoke Package",
    eventDate: b.event_date,
    startTime: b.start_time,
    durationHours: b.duration_hours,
    deliveryAddress: b.delivery_address,
    deliveryZone: b.delivery_zone,
    specialInstructions: b.special_instructions,
    status: b.status,
    subtotalAmount: Number(b.subtotal_amount) || 0,
    surchargeAmount: Number(b.surcharge_amount) || 0,
    deliveryFee: Number(b.delivery_fee) || 0,
    discountAmount: Number(b.discount_amount) || 0,
    grandTotal: Number(b.grand_total) || 0,
    depositAmount: Number(b.deposit_amount) || 0,
    balanceAmount: Number(b.balance_amount) || 0,
    assignedUnitSerial: b.inventory_units?.serial_number || null,
    assignedPersonnelName: b.assigned_personnel?.full_name || null,
    vehicleInfo: b.vehicle_info || null,
    createdAt: b.created_at,
    payments: ((payments as Array<{ id: string; public_id: string; amount: number; status: string; payment_type: string; payment_method: string; created_at: string }>) || []).map((p) => ({
      id: p.id,
      publicId: p.public_id,
      amount: Number(p.amount) || 0,
      status: p.status,
      paymentType: p.payment_type,
      paymentMethod: p.payment_method,
      createdAt: p.created_at,
    })),
    timelineEvents: ((timeline as Array<{ id: string; from_status: string | null; to_status: string; event_label: string; event_description: string | null; created_at: string }>) || []).map((t) => ({
      id: t.id,
      fromStatus: t.from_status,
      toStatus: t.to_status,
      eventLabel: t.event_label,
      eventDescription: t.event_description,
      createdAt: t.created_at,
    })),
  };
}

export async function getCustomerProfile(userId: string): Promise<CustomerProfile | null> {
  const supabase = createClient();

  type ProfileRow = {
    id: string;
    public_id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, public_id, full_name, email, phone")
    .eq("id", userId)
    .eq("is_deleted", false)
    .maybeSingle() as { data: ProfileRow | null; error: unknown };

  if (error || !data) return null;

  return {
    id: data.id,
    publicId: data.public_id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
  };
}
