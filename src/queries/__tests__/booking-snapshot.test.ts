import { describe, expect, test } from "vitest";
import { getBookingCustomerContact } from "@/queries/booking-snapshot";

describe("getBookingCustomerContact", () => {
  test("returns the frozen booking contact instead of account profile data", () => {
    expect(
      getBookingCustomerContact({
        customer: {
          fullName: " KYU E2E Test ",
          email: "miljunemilano47@gmail.com",
          phone: "09171234567",
        },
      }),
    ).toEqual({
      fullName: "KYU E2E Test",
      email: "miljunemilano47@gmail.com",
      phone: "09171234567",
    });
  });

  test.each([null, [], {}, { customer: null }, { customer: "invalid" }])(
    "fails safely for malformed snapshots",
    (snapshot) => {
      expect(getBookingCustomerContact(snapshot)).toEqual({});
    },
  );
});
