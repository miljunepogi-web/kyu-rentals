import { describe, expect, test } from "vitest";
import { buildBookingConfirmationData } from "../booking-confirmation";
import { renderBookingConfirmationEmail } from "../booking-confirmation-email";
import { buildReceiptFileName } from "../booking-receipt-pdf";

const booking = {
  id: "11111111-2222-3333-4444-555555555555",
  public_id: "KYU-2026-0001",
  event_date: "2026-08-15",
  start_time: "18:00",
  duration_hours: 4,
  venue_address: "123 Sample Street, Quezon City",
  delivery_zone: "Metro Manila Core",
  grand_total: 3500,
  deposit_amount: 1050,
  balance_amount: 2450,
  snapshot: {
    package: {
      name: "KYU Party Pro",
    },
    pricingBreakdown: {
      basePackagePrice: 2800,
      subtotalBeforeSurcharges: 2800,
      totalSurcharges: 0,
      deliveryFee: 250,
      discountAmount: 0,
      grandTotal: 3500,
      depositAmount: 1050,
      balanceAmount: 2450,
    },
    customer: {
      fullName: "Juan Dela Cruz",
      email: "juan@example.com",
      phone: "09171234567",
      deliveryAddress: "123 Sample Street, Quezon City",
      deliveryZone: "Metro Manila Core",
    },
  },
};

const payment = {
  amount: 1050,
  payment_method: "PAYMONGO_CHECKOUT",
  gateway_transaction_id: "pay_test_123",
  updated_at: "2026-08-01T12:00:00.000Z",
  created_at: "2026-08-01T12:00:00.000Z",
};

describe("booking confirmation notifications", () => {
  test("builds customer-facing confirmation data from booking snapshot and payment", () => {
    const data = buildBookingConfirmationData(booking, payment);

    expect(data.bookingPublicId).toBe("KYU-2026-0001");
    expect(data.packageName).toBe("KYU Party Pro");
    expect(data.customerEmail).toBe("juan@example.com");
    expect(data.paidAmount).toBe(1050);
    expect(data.lineItems).toContainEqual({ label: "Package base", amount: 2800 });
  });

  test("renders confirmation email with booking reference and receipt copy", async () => {
    const data = buildBookingConfirmationData(booking, payment);
    const html = await renderBookingConfirmationEmail(data);

    expect(html).toContain("Booking confirmed");
    expect(html).toContain("KYU-2026-0001");
    expect(html).toContain("KYU Party Pro");
    expect(html).toContain("PDF receipt is attached");
  });

  test("builds a safe PDF receipt filename", () => {
    expect(buildReceiptFileName("KYU/2026:0001")).toBe("KYU-Rentals-Receipt-KYU20260001.pdf");
  });
});
