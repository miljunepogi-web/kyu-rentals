export const CANCELLATION_POLICY = {
  depositPercent: 30,
  customerCancellation:
    "The 30% reservation deposit is non-refundable for customer-initiated cancellations.",
  merchantCancellation:
    "If KYU Rentals cannot fulfill a confirmed booking, all payments for that booking will be refunded.",
  exceptionalRescheduling:
    "Approved rescheduling for emergencies or force majeure is subject to availability and written confirmation from KYU Rentals.",
  adminReview:
    "Submitting a request does not immediately cancel the booking. KYU Rentals will review and confirm the decision.",
} as const;

export const CUSTOMER_CANCELLATION_SUMMARY = [
  CANCELLATION_POLICY.customerCancellation,
  CANCELLATION_POLICY.merchantCancellation,
  CANCELLATION_POLICY.exceptionalRescheduling,
] as const;
