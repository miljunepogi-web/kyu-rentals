import { createClient } from "@/lib/supabase/client";

export interface BookingTimelineEvent {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  eventLabel: string;
  eventDescription: string | null;
  performedByRole: string | null;
  isSystemEvent: boolean;
  createdAt: string;
}

export async function getBookingTimelineEvents(bookingId: string): Promise<BookingTimelineEvent[]> {
  const supabase = createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("booking_timeline_events") as any)
    .select("id, from_status, to_status, event_label, event_description, performed_by_role, is_system_event, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [
      {
        id: "evt-1",
        fromStatus: null,
        toStatus: "DRAFT",
        eventLabel: "Booking Draft Initialized",
        eventDescription: "Customer selected package and event timing",
        performedByRole: "customer",
        isSystemEvent: false,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  interface EventRecord {
    id: string;
    from_status: string | null;
    to_status: string;
    event_label: string;
    event_description: string | null;
    performed_by_role: string | null;
    is_system_event: boolean;
    created_at: string;
  }

  return (data as EventRecord[]).map((item) => ({
    id: item.id,
    fromStatus: item.from_status,
    toStatus: item.to_status,
    eventLabel: item.event_label,
    eventDescription: item.event_description,
    performedByRole: item.performed_by_role,
    isSystemEvent: item.is_system_event,
    createdAt: item.created_at,
  }));
}
