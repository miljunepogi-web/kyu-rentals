export interface BookingReceiptLineItem {
  label: string;
  amount: number;
}

export interface BookingConfirmationData {
  bookingId: string;
  bookingPublicId: string;
  packageName: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  eventDate: string;
  startTime: string;
  durationHours: number;
  deliveryAddress: string;
  deliveryZone?: string;
  specialInstructions?: string;
  subtotalAmount: number;
  surchargeAmount: number;
  deliveryFee: number;
  discountAmount: number;
  grandTotal: number;
  depositAmount: number;
  balanceAmount: number;
  paidAmount: number;
  paidAt: string;
  paymentMethod: string;
  gatewayTransactionId: string;
  lineItems: BookingReceiptLineItem[];
}

export interface BookingSnapshot {
  package?: {
    name?: string;
    slug?: string;
    selectedDuration?: number;
    appliedBasePrice?: number;
  };
  pricingBreakdown?: {
    basePackagePrice?: number;
    subtotalBeforeSurcharges?: number;
    totalSurcharges?: number;
    deliveryFee?: number;
    discountAmount?: number;
    grandTotal?: number;
    depositAmount?: number;
    balanceAmount?: number;
  };
  customer?: {
    fullName?: string;
    email?: string;
    phone?: string;
    deliveryAddress?: string;
    deliveryZone?: string;
    specialInstructions?: string;
  };
}
