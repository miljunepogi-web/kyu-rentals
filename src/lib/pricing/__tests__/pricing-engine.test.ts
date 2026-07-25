import { calculateBookingPrice } from "../pricing-engine";

describe("Pricing Engine - calculateBookingPrice()", () => {
  const basePrices = {
    basePrice4Hours: 1800,
    basePrice8Hours: 2500,
    basePriceFullDay: 3000,
  };

  test("calculates standard 4-hour rental pricing correctly", () => {
    const result = calculateBookingPrice({
      ...basePrices,
      durationHours: 4,
      eventDate: "2026-10-21", // Wednesday (Weekday)
      addons: [],
      deliveryZone: "Metro Manila Core",
    });

    expect(result.basePackagePrice).toBe(1800);
    expect(result.isWeekend).toBe(false);
    expect(result.weekendSurchargeAmount).toBe(0);
    expect(result.deliveryFee).toBe(250);
    expect(result.grandTotal).toBe(2050); // 1800 + 250
    expect(result.depositAmount).toBe(615); // 30% of 2050
    expect(result.balanceAmount).toBe(1435); // 2050 - 615
    expect(result.depositAmount + result.balanceAmount).toBe(result.grandTotal);
  });

  test("applies 10% weekend surcharge on Saturday events", () => {
    const result = calculateBookingPrice({
      ...basePrices,
      durationHours: 8,
      eventDate: "2026-10-24", // Saturday (Weekend)
      addons: [],
      deliveryZone: "Metro Manila Core",
    });

    expect(result.basePackagePrice).toBe(2500);
    expect(result.isWeekend).toBe(true);
    expect(result.weekendSurchargePct).toBe(10);
    expect(result.weekendSurchargeAmount).toBe(250); // 10% of 2500
    expect(result.deliveryFee).toBe(250);
    expect(result.grandTotal).toBe(3000); // 2500 + 250 + 250
    expect(result.depositAmount).toBe(900); // 30% of 3000
    expect(result.balanceAmount).toBe(2100);
    expect(result.depositAmount + result.balanceAmount).toBe(result.grandTotal);
  });

  test("calculates extra microphones and light add-ons correctly", () => {
    const result = calculateBookingPrice({
      ...basePrices,
      durationHours: 8,
      eventDate: "2026-10-21", // Weekday
      addons: [
        { id: "mic", name: "Extra Mic", unitPrice: 300, quantity: 2 }, // 600
        { id: "light", name: "Laser Upgrade", unitPrice: 500, quantity: 1 }, // 500
      ],
      deliveryZone: "Outside Metro Manila", // 500
    });

    expect(result.basePackagePrice).toBe(2500);
    expect(result.addonsSubtotal).toBe(1100);
    expect(result.subtotalBeforeSurcharges).toBe(3600); // 2500 + 1100
    expect(result.deliveryFee).toBe(500);
    expect(result.grandTotal).toBe(4100); // 3600 + 500
    expect(result.depositAmount).toBe(1230); // 30% of 4100
    expect(result.balanceAmount).toBe(2870);
  });
});
