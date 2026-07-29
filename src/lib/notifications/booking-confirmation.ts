import { sendEmailNotification } from "@/lib/api/resend";
import { logger } from "@/utils/logger";
import {
  BookingConfirmationData,
  BookingSnapshot,
} from "./booking-confirmation.types";
import { renderBookingConfirmationEmail } from "./booking-confirmation-email";
import {
  buildReceiptFileName,
  renderBookingReceiptPdf,
} from "./booking-receipt-pdf";

interface BookingRecordForConfirmation {
  id: string;
  public_id: string;
  event_date: string;
  start_time: string;
  duration_hours: number;
  venue_address: string | null;
  delivery_zone: string | null;
  grand_total: number;
  deposit_amount: number;
  balance_amount: number;
  snapshot: BookingSnapshot | null;
}

interface PaymentRecordForConfirmation {
  amount: number;
  payment_method: string | null;
  gateway_transaction_id: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export function buildBookingConfirmationData(
  booking: BookingRecordForConfirmation,
  payment: PaymentRecordForConfirmation
): BookingConfirmationData {
  const snapshot = booking.snapshot || {};
  const pricing = snapshot.pricingBreakdown || {};
  const customer = snapshot.customer || {};
  const packageSnapshot = snapshot.package || {};

  const lineItems = [
    {
      label: "Package base",
      amount: pricing.basePackagePrice ?? booking.grand_total,
    },
    {
      label: "Weekend or peak surcharge",
      amount: pricing.totalSurcharges ?? 0,
    },
    {
      label: "Delivery and setup",
      amount: pricing.deliveryFee ?? 0,
    },
    {
      label: "Discount",
      amount: -(pricing.discountAmount ?? 0),
    },
  ].filter((item) => item.amount !== 0);

  return {
    bookingId: booking.id,
    bookingPublicId: booking.public_id,
    packageName: packageSnapshot.name || "KYU Rental Setup",
    customerName: customer.fullName || "Valued Customer",
    customerEmail: customer.email || "customer@example.com",
    customerPhone: customer.phone,
    eventDate: booking.event_date,
    startTime: booking.start_time,
    durationHours: booking.duration_hours,
    deliveryAddress: customer.deliveryAddress || booking.venue_address || "Venue address on file",
    deliveryZone: customer.deliveryZone || booking.delivery_zone || undefined,
    specialInstructions: customer.specialInstructions,
    subtotalAmount: pricing.subtotalBeforeSurcharges ?? booking.grand_total,
    surchargeAmount: pricing.totalSurcharges ?? 0,
    deliveryFee: pricing.deliveryFee ?? 0,
    discountAmount: pricing.discountAmount ?? 0,
    grandTotal: pricing.grandTotal ?? booking.grand_total,
    depositAmount: pricing.depositAmount ?? booking.deposit_amount,
    balanceAmount: pricing.balanceAmount ?? booking.balance_amount,
    paidAmount: payment.amount,
    paidAt: payment.updated_at || payment.created_at || new Date().toISOString(),
    paymentMethod: payment.payment_method || "PayMongo",
    gatewayTransactionId: payment.gateway_transaction_id || "PayMongo checkout",
    lineItems,
  };
}

export async function sendBookingConfirmationEmail(data: BookingConfirmationData) {
  const [html, pdfBuffer] = await Promise.all([
    renderBookingConfirmationEmail(data),
    renderBookingReceiptPdf(data),
  ]);

  const result = await sendEmailNotification({
    to: data.customerEmail,
    subject: `KYU Rentals booking confirmed: ${data.bookingPublicId}`,
    html,
    idempotencyKey: `booking-confirmed/${data.bookingId}`,
    attachments: [
      {
        filename: buildReceiptFileName(data.bookingPublicId),
        content: pdfBuffer.toString("base64"),
      },
    ],
  });

  if (!result.success) {
    logger.error("Booking confirmation email failed", {
      bookingId: data.bookingId,
      recipient: data.customerEmail,
      error: result.error,
    });
  }

  return result;
}
