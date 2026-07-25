import { z } from "zod";

export const pricingInputSchema = z.object({
  basePrice4Hours: z.number().min(0),
  basePrice8Hours: z.number().min(0),
  basePriceFullDay: z.number().min(0),
  durationHours: z.number().min(4),
  eventDate: z.string().min(1),
  addons: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        unitPrice: z.number().min(0),
        quantity: z.number().min(1),
      })
    )
    .default([]),
  deliveryZone: z.string().optional(),
  promoDiscount: z.number().min(0).default(0),
  isHoliday: z.boolean().default(false),
});

export type PricingInput = z.input<typeof pricingInputSchema>;

export interface AddonLineItem {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

export interface PricingBreakdown {
  selectedDuration: number;
  basePackagePrice: number;
  addons: AddonLineItem[];
  addonsSubtotal: number;
  subtotalBeforeSurcharges: number;
  isWeekend: boolean;
  weekendSurchargePct: number;
  weekendSurchargeAmount: number;
  isHoliday: boolean;
  holidaySurchargePct: number;
  holidaySurchargeAmount: number;
  totalSurcharges: number;
  deliveryFee: number;
  discountAmount: number;
  grandTotal: number;
  reservationPct: number;
  depositAmount: number;
  balanceAmount: number;
}

/**
 * Pure, deterministic server-side pricing engine for KYU Rentals.
 * ALL price calculations across the application MUST originate from this function.
 * Client-submitted price totals are completely ignored.
 */
export function calculateBookingPrice(input: PricingInput): PricingBreakdown {
  const parsed = pricingInputSchema.parse(input);

  // 1. Determine Base Package Price by duration
  const basePackagePrice =
    parsed.durationHours === 4
      ? parsed.basePrice4Hours
      : parsed.durationHours === 8
      ? parsed.basePrice8Hours
      : parsed.basePriceFullDay;

  // 2. Calculate Add-ons Line Items
  const addons: AddonLineItem[] = parsed.addons.map((item) => ({
    id: item.id,
    name: item.name,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
    totalPrice: item.unitPrice * item.quantity,
  }));

  const addonsSubtotal = addons.reduce((sum, item) => sum + item.totalPrice, 0);
  const subtotalBeforeSurcharges = basePackagePrice + addonsSubtotal;

  // 3. Surcharge Engine (Weekend & Holiday)
  const eventDt = new Date(parsed.eventDate);
  const isWeekend = [0, 6].includes(eventDt.getDay());
  const weekendSurchargePct = isWeekend ? 0.1 : 0;
  const weekendSurchargeAmount = Math.round(subtotalBeforeSurcharges * weekendSurchargePct);

  const isHoliday = parsed.isHoliday;
  const holidaySurchargePct = isHoliday ? 0.15 : 0;
  const holidaySurchargeAmount = Math.round(subtotalBeforeSurcharges * holidaySurchargePct);

  const totalSurcharges = weekendSurchargeAmount + holidaySurchargeAmount;

  // 4. Delivery Fee Engine
  const isOutsideCore = parsed.deliveryZone?.toLowerCase().includes("outside");
  const deliveryFee = isOutsideCore ? 500 : 250;

  // 5. Discount Engine
  const discountAmount = Math.min(parsed.promoDiscount, subtotalBeforeSurcharges);

  // 6. Financial Totals & 30% Deposit Reconciliation
  const grandTotal = Math.max(0, subtotalBeforeSurcharges + totalSurcharges + deliveryFee - discountAmount);
  const reservationPct = 30; // 30% Non-refundable reservation deposit
  const depositAmount = Math.round(grandTotal * (reservationPct / 100));
  const balanceAmount = grandTotal - depositAmount;

  return {
    selectedDuration: parsed.durationHours,
    basePackagePrice,
    addons,
    addonsSubtotal,
    subtotalBeforeSurcharges,
    isWeekend,
    weekendSurchargePct: weekendSurchargePct * 100,
    weekendSurchargeAmount,
    isHoliday,
    holidaySurchargePct: holidaySurchargePct * 100,
    holidaySurchargeAmount,
    totalSurcharges,
    deliveryFee,
    discountAmount,
    grandTotal,
    reservationPct,
    depositAmount,
    balanceAmount,
  };
}
