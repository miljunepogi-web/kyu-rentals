export const BOOKING_DURATION_OPTIONS = [4, 8, 24] as const;

export const BOOKING_DELIVERY_ZONES = {
  "Metro Manila Core": {
    label: "Metro Manila Core",
    description: "Standard Delivery",
    fee: 250,
  },
  "Outside Metro Manila": {
    label: "Outside Metro Manila",
    description: "Rizal / Cavite / Laguna",
    fee: 500,
  },
} as const;

export const BOOKING_DELIVERY_ZONE_VALUES = [
  "Metro Manila Core",
  "Outside Metro Manila",
] as const;

export type BookingDeliveryZone = (typeof BOOKING_DELIVERY_ZONE_VALUES)[number];

export const BOOKING_ADDONS = {
  "add-mic": {
    name: "Extra Wireless Mic",
    unitPrice: 300,
    maxQuantity: 4,
  },
  "add-light": {
    name: "Laser Disco Party Bar",
    unitPrice: 500,
    maxQuantity: 1,
  },
} as const;

export const BOOKING_ADDON_IDS = ["add-mic", "add-light"] as const;
export type BookingAddonId = (typeof BOOKING_ADDON_IDS)[number];
