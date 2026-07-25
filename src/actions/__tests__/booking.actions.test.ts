import { createBookingInputSchema } from "../booking.actions";

describe("Milestone 3.3 - Booking Creation Input Validation", () => {
  const validPayload = {
    packageSlug: "kyu-party-pro",
    eventDate: "2026-10-25",
    startTime: "14:00",
    durationHours: 8,
    deliveryAddress: "123 Mabini St, Quezon City",
    customerFullName: "Juan Dela Cruz",
    customerEmail: "juan@example.com",
    customerPhone: "09171234567",
    addons: [],
  };

  test("validates a correct booking creation payload", () => {
    const result = createBookingInputSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  test("rejects invalid date format", () => {
    const result = createBookingInputSchema.safeParse({
      ...validPayload,
      eventDate: "25/10/2026", // Invalid format
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid start time format", () => {
    const result = createBookingInputSchema.safeParse({
      ...validPayload,
      startTime: "2pm", // Invalid format
    });
    expect(result.success).toBe(false);
  });

  test("rejects rental duration under 4 hours", () => {
    const result = createBookingInputSchema.safeParse({
      ...validPayload,
      durationHours: 2, // Under 4 hours
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid email address", () => {
    const result = createBookingInputSchema.safeParse({
      ...validPayload,
      customerEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });
});
