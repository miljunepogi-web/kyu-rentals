"use server";

import { createClient } from "@/lib/supabase/server";

export interface AddBookingInternalNotePayload {
  bookingId: string;
  noteText: string;
}

export interface AddBookingInternalNoteResult {
  success: boolean;
  error?: string;
}

export async function addBookingInternalNoteAction(
  payload: AddBookingInternalNotePayload
): Promise<AddBookingInternalNoteResult> {
  try {
    if (!payload.bookingId?.trim()) {
      return { success: false, error: "Booking ID is required." };
    }
    if (!payload.noteText?.trim() || payload.noteText.trim().length < 3) {
      return { success: false, error: "Internal note text must be at least 3 characters." };
    }
    if (payload.noteText.trim().length > 1000) {
      return { success: false, error: "Internal note text cannot exceed 1,000 characters." };
    }

    const supabase = await createClient();

    // 1. Session check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "Unauthorized session." };
    }

    // 2. Profile & Tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("tenant_id, full_name")
      .eq("id", user.id)
      .eq("is_deleted", false)
      .maybeSingle();

    if (!profile?.tenant_id) {
      return { success: false, error: "Could not resolve tenant profile." };
    }

    const tenantId = profile.tenant_id;
    const operatorName = profile.full_name || "Staff Admin";

    // 3. Fetch Booking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: booking, error: bErr } = await (supabase.from("bookings") as any)
      .select("id, status")
      .eq("id", payload.bookingId)
      .eq("tenant_id", tenantId)
      .single();

    if (bErr || !booking) {
      return { success: false, error: "Booking record not found." };
    }

    // 4. Insert Internal Staff Note Event
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (supabase.from("booking_timeline_events") as any).insert({
      tenant_id: tenantId,
      booking_id: booking.id,
      from_status: booking.status,
      to_status: booking.status,
      event_label: "Internal Staff Note",
      event_description: `[Note by ${operatorName}]: ${payload.noteText.trim()}`,
      performed_by_role: "admin",
      is_system_event: false,
      visibility: "INTERNAL",
    });

    if (insertErr) {
      return { success: false, error: "Failed to record internal note." };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected server error occurred.",
    };
  }
}
