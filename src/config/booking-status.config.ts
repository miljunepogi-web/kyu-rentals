/**
 * Centralized booking status configuration.
 * Use this everywhere a status is displayed — never render raw DB enum strings to users.
 */

export type BookingStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "PREPARING"
  | "DRIVER_ASSIGNED"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "RENTAL_ACTIVE"
  | "PICKUP_SCHEDULED"
  | "OUT_FOR_PICKUP"
  | "PICKED_UP"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLATION_REQUESTED"
  | "PAYMENT_FAILED";

/** Human-readable labels for all booking statuses. */
export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_PAYMENT: "Awaiting Deposit",
  CONFIRMED: "Confirmed",
  PREPARING: "Equipment Prep",
  DRIVER_ASSIGNED: "Driver Assigned",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED: "Delivered",
  RENTAL_ACTIVE: "Setup Active",
  PICKUP_SCHEDULED: "Pickup Scheduled",
  OUT_FOR_PICKUP: "Driver En Route (Pickup)",
  PICKED_UP: "Equipment Retrieved",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CANCELLATION_REQUESTED: "Cancellation Requested",
  PAYMENT_FAILED: "Payment Failed",
};

/** Tailwind badge class string per status for consistent coloring. */
export const STATUS_BADGE_CLASS: Record<string, string> = {
  DRAFT: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  PENDING_PAYMENT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  CONFIRMED: "bg-primary/10 text-primary border-primary/20",
  PREPARING: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  DRIVER_ASSIGNED: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  OUT_FOR_DELIVERY: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  DELIVERED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  RENTAL_ACTIVE: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  PICKUP_SCHEDULED: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  OUT_FOR_PICKUP: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  PICKED_UP: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  COMPLETED: "bg-green-500/10 text-green-700 border-green-500/20",
  CANCELLED: "bg-red-500/10 text-red-600 border-red-500/20",
  REJECTED: "bg-red-600/10 text-red-700 border-red-600/20",
  EXPIRED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
  CANCELLATION_REQUESTED: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  PAYMENT_FAILED: "bg-destructive/10 text-destructive border-destructive/20",
};

/** Short icon prefix string for color-blind accessible status rendering. */
export const STATUS_ICON_PREFIX: Record<string, string> = {
  DRAFT: "◦",
  PENDING_PAYMENT: "⏳",
  CONFIRMED: "✓",
  PREPARING: "⚙",
  DRIVER_ASSIGNED: "🚗",
  OUT_FOR_DELIVERY: "📦",
  DELIVERED: "✅",
  RENTAL_ACTIVE: "🎤",
  PICKUP_SCHEDULED: "📅",
  OUT_FOR_PICKUP: "🔄",
  PICKED_UP: "📬",
  COMPLETED: "🏁",
  CANCELLED: "✕",
  REJECTED: "✕",
  EXPIRED: "⌛",
  CANCELLATION_REQUESTED: "⚠",
  PAYMENT_FAILED: "⚠",
};

/** Returns the human-readable label for a status, falling back to a title-cased version. */
export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

/** Returns the badge class string for a status. */
export function getStatusBadgeClass(status: string): string {
  return STATUS_BADGE_CLASS[status] ?? "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
}

/**
 * Statuses that require a mandatory admin reason before executing a transition.
 * For purely operational progress transitions, the reason field is optional.
 */
export const REASON_REQUIRED_STATUSES = new Set([
  "CANCELLED",
  "REJECTED",
  "EXPIRED",
  "CANCELLATION_REQUESTED",
  "PAYMENT_FAILED",
]);
