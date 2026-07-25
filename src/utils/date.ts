import { format, parseISO, isValid } from "date-fns";

export const DATE_FORMATS = {
  DISPLAY_DATE: "MMM dd, yyyy",
  DISPLAY_DATETIME: "MMM dd, yyyy h:mm a",
  DISPLAY_TIME: "h:mm a",
  ISO_DATE: "yyyy-MM-dd",
} as const;

export function formatDate(date: Date | string | number, formatStr: string = DATE_FORMATS.DISPLAY_DATE): string {
  const d = typeof date === "string" ? parseISO(date) : new Date(date);
  if (!isValid(d)) return "Invalid date";
  return format(d, formatStr);
}

export function formatDateTime(date: Date | string | number): string {
  return formatDate(date, DATE_FORMATS.DISPLAY_DATETIME);
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a human-readable event date
 * with day name, e.g. "July 25, 2025 • Friday"
 */
export function formatEventDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (!isValid(d)) return dateStr;
  return format(d, "MMMM d, yyyy") + " • " + format(d, "EEEE");
}

/**
 * Formats an ISO date string into a compact readable form, e.g. "Jul 25, 2025"
 */
export function formatShortDate(dateStr: string): string {
  const d = parseISO(dateStr);
  if (!isValid(d)) return dateStr;
  return format(d, "MMM d, yyyy");
}
