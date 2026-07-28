import { createClient } from "@/lib/supabase/client";
import { getBookingCustomerContact } from "@/queries/booking-snapshot";
import { throwQueryError } from "@/queries/query-error";

export interface AdminCalendarEvent {
  id: string;
  publicId: string;
  customerName: string;
  customerPhone: string;
  packageName: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  endTime: string;
  status: string;
  eventType: "DELIVERY" | "PICKUP" | "ACTIVE_RENTAL";
  deliveryAddress: string;
  deliveryZone: string | null;
  assignedUnitId: string | null;
  assignedUnitSerial: string | null;
  assignedDriverId: string | null;
  assignedDriverName: string | null;
  hasConflict: boolean;
  conflictReason?: string;
}

export async function getAdminCalendarEvents(
  year: number,
  month: number // 1-indexed (1 = Jan, 12 = Dec)
): Promise<AdminCalendarEvent[]> {
  const supabase = createClient();

  // Form start & end date strings for the target month window (with 7-day padding for week/month edges)
  const startDate = new Date(year, month - 1, -7).toISOString().split("T")[0];
  const endDate = new Date(year, month, 14).toISOString().split("T")[0];

  const { data: rawBookings, error } = await supabase
    .from("bookings")
    .select(`
      id, public_id, status, event_date, start_time, duration_hours, event_end_time,
      delivery_address, delivery_zone, assigned_unit_id, assigned_delivery_personnel_id, snapshot,
      profiles!customer_id (full_name, phone),
      packages!package_id (name),
      inventory_units!assigned_unit_id (serial_number),
      assigned_personnel:profiles!assigned_delivery_personnel_id (full_name)
    `)
    .eq("is_deleted", false)
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .not("status", "in", '("CANCELLED","REJECTED","EXPIRED","DRAFT")');

  if (error) {
    throwQueryError("admin.calendar.list", error);
  }
  if (!rawBookings) {
    throwQueryError("admin.calendar.list", new Error("Calendar query returned no data"));
  }

  interface RawBookingRecord {
    id: string;
    public_id: string;
    status: string;
    event_date: string;
    start_time: string;
    duration_hours: number;
    venue_address: string;
    delivery_zone: string | null;
    balance_amount: number;
    event_end_time?: string | null;
    delivery_address?: string | null;
    assigned_unit_id?: string | null;
    inventory_units?: { serial_number?: string | null } | null;
    assigned_delivery_personnel_id?: string | null;
    snapshot?: unknown;
    assigned_personnel?: { full_name?: string | null } | null;
    profiles?: { full_name?: string | null; phone?: string | null } | null;
    packages?: { name?: string | null } | null;
  }

  const events: AdminCalendarEvent[] = (rawBookings as unknown as RawBookingRecord[]).map((b) => {
    const customer = getBookingCustomerContact(b.snapshot);
    const isPickup = ["COMPLETED", "RETRIEVED", "PICKUP_SCHEDULED", "OUT_FOR_PICKUP", "PICKED_UP"].includes(b.status);
    const isActive = ["RENTAL_ACTIVE", "DELIVERED"].includes(b.status);
    const eventType = isPickup ? "PICKUP" : isActive ? "ACTIVE_RENTAL" : "DELIVERY";

    return {
      id: b.id,
      publicId: b.public_id,
      customerName: customer.fullName || b.profiles?.full_name || "Customer",
      customerPhone: customer.phone || b.profiles?.phone || "N/A",
      packageName: b.packages?.name || "Karaoke Package",
      eventDate: b.event_date,
      startTime: b.start_time || "09:00",
      durationHours: b.duration_hours || 4,
      endTime: b.event_end_time || b.start_time || "13:00",
      status: b.status,
      eventType,
      deliveryAddress: b.delivery_address || "",
      deliveryZone: b.delivery_zone || null,
      assignedUnitId: b.assigned_unit_id || null,
      assignedUnitSerial: b.inventory_units?.serial_number || null,
      assignedDriverId: b.assigned_delivery_personnel_id || null,
      assignedDriverName: b.assigned_personnel?.full_name || null,
      hasConflict: false,
    };
  });

  // Conflict Detection Algorithm:
  // 1. Same inventory unit assigned to 2 events on the same date
  // 2. Same driver assigned to 2 events on the same date with overlapping hours
  const unitMap = new Map<string, AdminCalendarEvent[]>();
  const driverMap = new Map<string, AdminCalendarEvent[]>();

  events.forEach((ev) => {
    if (ev.assignedUnitId) {
      const key = `${ev.assignedUnitId}_${ev.eventDate}`;
      const list = unitMap.get(key) || [];
      list.push(ev);
      unitMap.set(key, list);
    }
    if (ev.assignedDriverId) {
      const key = `${ev.assignedDriverId}_${ev.eventDate}`;
      const list = driverMap.get(key) || [];
      list.push(ev);
      driverMap.set(key, list);
    }
  });

  unitMap.forEach((list) => {
    if (list.length > 1) {
      list.forEach((ev) => {
        ev.hasConflict = true;
        ev.conflictReason = `Unit double-booked: Serial ${ev.assignedUnitSerial} assigned to ${list.length} jobs today.`;
      });
    }
  });

  driverMap.forEach((list) => {
    if (list.length > 1) {
      list.forEach((ev) => {
        ev.hasConflict = true;
        ev.conflictReason = `Driver overlap: ${ev.assignedDriverName} assigned to ${list.length} dispatch jobs today.`;
      });
    }
  });

  return events;
}
