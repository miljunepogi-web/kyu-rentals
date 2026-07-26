import * as React from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { formatPHP } from "@/utils/currency";
import { BookingConfirmationData } from "./booking-confirmation.types";

const styles = StyleSheet.create({
  page: {
    padding: 36,
    color: "#111827",
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 16,
    marginBottom: 18,
  },
  brand: {
    fontSize: 18,
    fontWeight: 700,
  },
  title: {
    marginTop: 8,
    color: "#16a34a",
    fontSize: 12,
    fontWeight: 700,
  },
  muted: {
    color: "#6b7280",
  },
  grid: {
    flexDirection: "row",
    gap: 18,
    marginBottom: 16,
  },
  column: {
    flexGrow: 1,
    flexBasis: 0,
  },
  sectionTitle: {
    marginBottom: 7,
    fontSize: 11,
    fontWeight: 700,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 6,
  },
  label: {
    color: "#6b7280",
    paddingRight: 12,
  },
  value: {
    fontWeight: 700,
    textAlign: "right",
    maxWidth: 250,
  },
  totalBox: {
    marginTop: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#f9fafb",
  },
  footer: {
    marginTop: 24,
    color: "#6b7280",
    fontSize: 9,
  },
});

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

export function buildReceiptFileName(bookingPublicId: string) {
  return `KYU-Rentals-Receipt-${bookingPublicId.replace(/[^a-zA-Z0-9-]/g, "")}.pdf`;
}

export function BookingReceiptPdf({ data }: { data: BookingConfirmationData }) {
  return (
    <Document
      title={`KYU Rentals Receipt ${data.bookingPublicId}`}
      author="KYU Rentals"
      subject="Booking deposit receipt"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>KYU Rentals</Text>
          <Text style={styles.title}>Official Booking Deposit Receipt</Text>
          <Text style={styles.muted}>Reference: {data.bookingPublicId}</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Customer</Text>
            <DetailRow label="Name" value={data.customerName} />
            <DetailRow label="Email" value={data.customerEmail} />
            {data.customerPhone && <DetailRow label="Phone" value={data.customerPhone} />}
          </View>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <DetailRow label="Paid at" value={data.paidAt} />
            <DetailRow label="Method" value={data.paymentMethod} />
            <DetailRow label="Gateway ref" value={data.gatewayTransactionId} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Booking</Text>
        <DetailRow label="Package" value={data.packageName} />
        <DetailRow label="Event date" value={data.eventDate} />
        <DetailRow label="Start time" value={data.startTime} />
        <DetailRow label="Duration" value={`${data.durationHours} hours`} />
        <DetailRow label="Delivery address" value={data.deliveryAddress} />
        {data.deliveryZone && <DetailRow label="Delivery zone" value={data.deliveryZone} />}

        <View style={styles.totalBox}>
          <Text style={styles.sectionTitle}>Charges</Text>
          {data.lineItems.map((item) => (
            <DetailRow key={item.label} label={item.label} value={formatPHP(item.amount)} />
          ))}
          <DetailRow label="Grand total" value={formatPHP(data.grandTotal)} />
          <DetailRow label="Deposit paid" value={formatPHP(data.paidAmount)} />
          <DetailRow label="Balance due on delivery" value={formatPHP(data.balanceAmount)} />
        </View>

        <Text style={styles.footer}>
          This receipt confirms the reservation deposit only. Remaining balance is collected upon
          delivery and setup unless otherwise agreed with KYU Rentals.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderBookingReceiptPdf(data: BookingConfirmationData) {
  return await renderToBuffer(<BookingReceiptPdf data={data} />);
}
