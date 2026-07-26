import { createClient } from "@/lib/supabase/client";

export interface DeliveryChecklistListItem {
  id: string;
  publicId: string;
  checklistType: "PRE_DELIVERY" | "POST_PICKUP";
  microphonesOk: boolean;
  speakersOk: boolean;
  displayScreenOk: boolean;
  cablesRemoteOk: boolean;
  notes: string | null;
  inspectedByName: string | null;
  inspectedAt: string;
}

export interface ProofOfDeliveryDetail {
  id: string;
  publicId: string;
  customerSignatureUrl: string | null;
  signedAt: string | null;
  signerName: string | null;
  signerContact: string | null;
  deviceType: string | null;
  signatureVersion: string | null;
  notes: string | null;
  deliveredByName: string | null;
  deliveredAt: string;
  photos: {
    id: string;
    photoUrl: string;
    photoType: string;
    caption: string | null;
  }[];
}

export interface IncidentListItem {
  id: string;
  publicId: string;
  bookingId: string;
  bookingPublicId: string;
  unitSerial: string | null;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  incidentType: "DAMAGE" | "MISSING_ITEM" | "EQUIPMENT_FAILURE" | "ACCIDENT";
  description: string;
  estimatedCost: number | null;
  status: "REPORTED" | "UNDER_REVIEW" | "RESOLVED";
  reportedByName: string | null;
  createdAt: string;
}

export async function getAdminDeliveryChecklists(
  bookingId: string
): Promise<DeliveryChecklistListItem[]> {
  const supabase = createClient();

  type ChecklistRow = {
    id: string;
    public_id: string;
    checklist_type: "PRE_DELIVERY" | "POST_PICKUP";
    microphones_ok: boolean;
    speakers_ok: boolean;
    display_screen_ok: boolean;
    cables_remote_ok: boolean;
    notes: string | null;
    inspected_at: string;
    profiles: { full_name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("delivery_checklists")
    .select(`
      id, public_id, checklist_type, microphones_ok, speakers_ok, display_screen_ok,
      cables_remote_ok, notes, inspected_at,
      profiles!inspected_by (full_name)
    `)
    .eq("booking_id", bookingId)
    .order("inspected_at", { ascending: true }) as { data: ChecklistRow[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((c) => ({
    id: c.id,
    publicId: c.public_id,
    checklistType: c.checklist_type,
    microphonesOk: c.microphones_ok,
    speakersOk: c.speakers_ok,
    displayScreenOk: c.display_screen_ok,
    cablesRemoteOk: c.cables_remote_ok,
    notes: c.notes,
    inspectedByName: c.profiles?.full_name || null,
    inspectedAt: c.inspected_at,
  }));
}

export async function getAdminProofOfDelivery(
  bookingId: string
): Promise<ProofOfDeliveryDetail | null> {
  const supabase = createClient();

  type PodRow = {
    id: string;
    public_id: string;
    customer_signature_url: string | null;
    signed_at: string | null;
    signer_name: string | null;
    signer_contact: string | null;
    device_type: string | null;
    signature_version: string | null;
    notes: string | null;
    delivered_at: string;
    profiles: { full_name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pod, error } = await (supabase as any)
    .from("proof_of_deliveries")
    .select(`
      id, public_id, customer_signature_url, signed_at, signer_name, signer_contact,
      device_type, signature_version, notes, delivered_at,
      profiles!delivered_by (full_name)
    `)
    .eq("booking_id", bookingId)
    .maybeSingle() as { data: PodRow | null; error: unknown };

  if (error || !pod) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: photos } = await (supabase as any)
    .from("proof_of_delivery_photos")
    .select("id, photo_url, photo_type, caption")
    .eq("pod_id", pod.id);

  return {
    id: pod.id,
    publicId: pod.public_id,
    customerSignatureUrl: pod.customer_signature_url,
    signedAt: pod.signed_at,
    signerName: pod.signer_name,
    signerContact: pod.signer_contact,
    deviceType: pod.device_type,
    signatureVersion: pod.signature_version,
    notes: pod.notes,
    deliveredByName: pod.profiles?.full_name || null,
    deliveredAt: pod.delivered_at,
    photos: ((photos as Array<{ id: string; photo_url: string; photo_type: string; caption?: string | null }>) || []).map((p) => ({
      id: p.id,
      photoUrl: p.photo_url,
      photoType: p.photo_type,
      caption: p.caption || null,
    })),
  };
}

export async function getAdminIncidents(): Promise<IncidentListItem[]> {
  const supabase = createClient();

  type IncidentRow = {
    id: string;
    public_id: string;
    booking_id: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    incident_type: "DAMAGE" | "MISSING_ITEM" | "EQUIPMENT_FAILURE" | "ACCIDENT";
    description: string;
    estimated_cost: number | null;
    status: "REPORTED" | "UNDER_REVIEW" | "RESOLVED";
    created_at: string;
    bookings: { public_id: string } | null;
    inventory_units: { serial_number: string } | null;
    profiles: { full_name: string } | null;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("incidents")
    .select(`
      id, public_id, booking_id, severity, incident_type, description, estimated_cost,
      status, created_at,
      bookings!booking_id (public_id),
      inventory_units!unit_id (serial_number),
      profiles!reported_by (full_name)
    `)
    .order("created_at", { ascending: false }) as { data: IncidentRow[] | null; error: unknown };

  if (error || !data) return [];

  return data.map((i) => ({
    id: i.id,
    publicId: i.public_id,
    bookingId: i.booking_id,
    bookingPublicId: i.bookings?.public_id || "BK-0000",
    unitSerial: i.inventory_units?.serial_number || null,
    severity: i.severity,
    incidentType: i.incident_type,
    description: i.description,
    estimatedCost: i.estimated_cost ? Number(i.estimated_cost) : null,
    status: i.status,
    reportedByName: i.profiles?.full_name || null,
    createdAt: i.created_at,
  }));
}
