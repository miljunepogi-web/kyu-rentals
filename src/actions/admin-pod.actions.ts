"use server";

import { createClient } from "@/lib/supabase/server";

export interface SubmitPoDPayload {
  bookingId: string;
  signatureUrl?: string;
  photoUrl?: string;
  signerName?: string;
  notes?: string;
}

export interface CreateChecklistPayload {
  bookingId: string;
  checklistType: "PRE_DELIVERY" | "POST_PICKUP";
  microphonesOk: boolean;
  speakersOk: boolean;
  displayScreenOk: boolean;
  cablesRemoteOk: boolean;
  notes?: string;
}

export interface ReportIncidentPayload {
  bookingId: string;
  unitId?: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  incidentType: "DAMAGE" | "MISSING_ITEM" | "EQUIPMENT_FAILURE" | "ACCIDENT";
  description: string;
  estimatedCost?: number;
}

export interface AdminPoDActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const POD_ADMIN_ROLES = ["owner", "super_admin", "admin", "driver", "support_staff", "franchise_owner"];

async function resolveSession(): Promise<
  | { success: true; userId: string; tenantId: string }
  | { success: false; error: string }
> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, error: "Unauthorized: No authenticated session found." };
  }

  type ProfileRow = { tenant_id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profileData, error: profileError } = await (supabase as any)
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .eq("is_deleted", false)
    .maybeSingle() as { data: ProfileRow | null; error: unknown };

  if (profileError || !profileData) {
    return { success: false, error: "Authorization failed: Could not resolve profile." };
  }

  const tenantId = profileData.tenant_id;

  type UserRoleRow = { role_id: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userRoleRows, error: roleError } = await (supabase as any)
    .from("user_roles")
    .select("role_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .limit(10) as { data: UserRoleRow[] | null; error: unknown };

  if (roleError || !userRoleRows || userRoleRows.length === 0) {
    return { success: false, error: "Forbidden: Insufficient delivery privileges." };
  }

  const roleIds = userRoleRows.map((r) => r.role_id);

  type RoleRow = { name: string };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: roleRows, error: roleLookupError } = await (supabase as any)
    .from("roles")
    .select("name")
    .in("id", roleIds)
    .in("name", POD_ADMIN_ROLES)
    .limit(1) as { data: RoleRow[] | null; error: unknown };

  if (roleLookupError || !roleRows || roleRows.length === 0) {
    return { success: false, error: "Forbidden: Insufficient delivery privileges." };
  }

  return { success: true, userId: user.id, tenantId };
}

/**
 * Server Action: Submit Proof of Delivery & Transition Booking to RENTAL_ACTIVE
 */
export async function submitProofOfDeliveryAction(
  payload: SubmitPoDPayload
): Promise<AdminPoDActionResult> {
  try {
    if (!payload.bookingId?.trim()) {
      return { success: false, error: "Booking ID is required." };
    }

    const session = await resolveSession();
    if (!session.success) return { success: false, error: session.error };

    const { tenantId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "submit_proof_of_delivery_admin",
      {
        p_tenant_id: tenantId,
        p_booking_id: payload.bookingId.trim(),
        p_signature_url: payload.signatureUrl?.trim() || null,
        p_photo_url: payload.photoUrl?.trim() || null,
        p_signer_name: payload.signerName?.trim() || null,
        p_notes: payload.notes?.trim() || null,
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message || "Failed to submit Proof of Delivery." };
    }

    return { success: true, data: rpcResult };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Server Action: Create Pre-Delivery / Post-Pickup Inspection Checklist
 */
export async function createDeliveryChecklistAction(
  payload: CreateChecklistPayload
): Promise<AdminPoDActionResult> {
  try {
    if (!payload.bookingId?.trim()) {
      return { success: false, error: "Booking ID is required." };
    }

    const session = await resolveSession();
    if (!session.success) return { success: false, error: session.error };

    const { userId, tenantId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: checklist, error: insertError } = await (supabase as any)
      .from("delivery_checklists")
      .insert({
        tenant_id: tenantId,
        booking_id: payload.bookingId.trim(),
        checklist_type: payload.checklistType,
        microphones_ok: payload.microphonesOk,
        speakers_ok: payload.speakersOk,
        display_screen_ok: payload.displayScreenOk,
        cables_remote_ok: payload.cablesRemoteOk,
        notes: payload.notes?.trim() || null,
        inspected_by: userId,
      })
      .select("id, public_id")
      .single();

    if (insertError) {
      return { success: false, error: insertError.message || "Failed to save inspection checklist." };
    }

    return { success: true, data: checklist };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}

/**
 * Server Action: Report Equipment Incident / Damage
 */
export async function reportIncidentAction(
  payload: ReportIncidentPayload
): Promise<AdminPoDActionResult> {
  try {
    if (!payload.bookingId?.trim() || !payload.description?.trim()) {
      return { success: false, error: "Booking ID and incident description are required." };
    }

    const session = await resolveSession();
    if (!session.success) return { success: false, error: session.error };

    const { tenantId } = session;
    const supabase = await createClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
      "report_incident_admin",
      {
        p_tenant_id: tenantId,
        p_booking_id: payload.bookingId.trim(),
        p_unit_id: payload.unitId?.trim() || null,
        p_severity: payload.severity,
        p_incident_type: payload.incidentType,
        p_description: payload.description.trim(),
        p_estimated_cost: payload.estimatedCost || null,
      }
    );

    if (rpcError) {
      return { success: false, error: rpcError.message || "Failed to submit incident report." };
    }

    return { success: true, data: rpcResult };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred.",
    };
  }
}
