import * as React from "react";
import { render } from "@react-email/render";
import { formatPHP } from "@/utils/currency";
import { BookingConfirmationData } from "./booking-confirmation.types";

const styles = {
  body: {
    margin: 0,
    backgroundColor: "#f6f7fb",
    color: "#171717",
    fontFamily: "Arial, Helvetica, sans-serif",
  },
  container: {
    width: "100%",
    maxWidth: "640px",
    margin: "0 auto",
    padding: "28px 16px",
  },
  panel: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    padding: "28px",
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#16a34a",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
  },
  h1: {
    margin: "0 0 12px",
    fontSize: "26px",
    lineHeight: "32px",
  },
  text: {
    margin: "0 0 16px",
    color: "#525252",
    fontSize: "14px",
    lineHeight: "22px",
  },
  sectionTitle: {
    margin: "24px 0 10px",
    fontSize: "15px",
    fontWeight: 700,
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    gap: "16px",
    borderBottom: "1px solid #f1f5f9",
    padding: "9px 0",
    fontSize: "13px",
  },
  label: {
    color: "#64748b",
  },
  value: {
    color: "#171717",
    fontWeight: 700,
    textAlign: "right" as const,
  },
  totalBox: {
    marginTop: "18px",
    borderRadius: "8px",
    backgroundColor: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "16px",
  },
  footer: {
    margin: "18px 0 0",
    color: "#64748b",
    fontSize: "12px",
    lineHeight: "18px",
  },
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={styles.row}>
      <span style={styles.label}>{label}</span>
      <span style={styles.value}>{value}</span>
    </div>
  );
}

export function BookingConfirmationEmail({ data }: { data: BookingConfirmationData }) {
  return (
    <html>
      <body style={styles.body}>
        <div style={styles.container}>
          <div style={styles.panel}>
            <p style={styles.eyebrow}>Booking confirmed</p>
            <h1 style={styles.h1}>Your KYU Rentals reservation is locked in.</h1>
            <p style={styles.text}>
              Hi {data.customerName}, we received your deposit for booking{" "}
              <strong>{data.bookingPublicId}</strong>. Your PDF receipt is attached to this email.
            </p>

            <p style={styles.sectionTitle}>Event Details</p>
            <DetailRow label="Package" value={data.packageName} />
            <DetailRow label="Event date" value={data.eventDate} />
            <DetailRow label="Start time" value={data.startTime} />
            <DetailRow label="Duration" value={`${data.durationHours} hours`} />
            <DetailRow label="Delivery address" value={data.deliveryAddress} />
            {data.deliveryZone && <DetailRow label="Delivery zone" value={data.deliveryZone} />}

            <div style={styles.totalBox}>
              <DetailRow label="Grand total" value={formatPHP(data.grandTotal)} />
              <DetailRow label="Deposit paid" value={formatPHP(data.paidAmount)} />
              <DetailRow label="Balance due on delivery" value={formatPHP(data.balanceAmount)} />
            </div>

            <p style={styles.footer}>
              Please keep this email for your records. Reply to this message if your venue, timing,
              or contact details need to change.
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}

export async function renderBookingConfirmationEmail(data: BookingConfirmationData) {
  return await render(<BookingConfirmationEmail data={data} />);
}
