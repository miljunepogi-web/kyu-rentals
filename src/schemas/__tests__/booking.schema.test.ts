import { createBookingInputSchema } from "../booking.schema";

const validBooking = {
  packageSlug: "kyu-mini",
  eventDate: "2099-08-15",
  startTime: "14:00",
  durationHours: 4,
  deliveryAddress: "123 QA Street, Quezon City",
  deliveryZone: "Metro Manila Core",
  customerFullName: "KYU Validation Test",
  customerEmail: "validation@example.com",
  customerPhone: "09171234567",
  termsAccepted: true,
  addons: [],
} as const;

describe("createBookingInputSchema", () => {
  test("accepts the production booking option contract", () => {
    expect(createBookingInputSchema.safeParse(validBooking).success).toBe(true);
  });

  test.each([
    ["unsupported duration", { durationHours: 5 }],
    ["unknown delivery zone", { deliveryZone: "FREE_DELIVERY" }],
    ["invalid phone number", { customerPhone: "1234567890" }],
    ["past event date", { eventDate: "2000-01-01" }],
    ["missing consent", { termsAccepted: false }],
    [
      "excessive add-on quantity",
      { addons: [{ id: "add-mic", quantity: 5 }] },
    ],
    [
      "duplicate add-on",
      {
        addons: [
          { id: "add-light", quantity: 1 },
          { id: "add-light", quantity: 1 },
        ],
      },
    ],
  ])("rejects %s", (_label, override) => {
    expect(
      createBookingInputSchema.safeParse({
        ...validBooking,
        ...override,
      }).success,
    ).toBe(false);
  });

  test("strips browser-supplied add-on names and prices", () => {
    const result = createBookingInputSchema.parse({
      ...validBooking,
      addons: [
        {
          id: "add-mic",
          quantity: 2,
          name: "Free microphones",
          unitPrice: 0,
        },
      ],
    });

    expect(result.addons).toEqual([{ id: "add-mic", quantity: 2 }]);
  });
});
