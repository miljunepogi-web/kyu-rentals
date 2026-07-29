import { describe, expect, test } from "vitest";
import {
  getBookingCustomerContact,
  getBookingPackageSnapshot,
} from "@/queries/booking-snapshot";

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

describe("getBookingPackageSnapshot", () => {
  test("returns the frozen package identity", () => {
    expect(
      getBookingPackageSnapshot({
        package: {
          name: "Original Package Name",
          slug: "original-package",
          version: 4,
        },
      }),
    ).toEqual({
      name: "Original Package Name",
      slug: "original-package",
      version: 4,
    });
  });

  test.each([null, [], "bad", { package: [] }, { package: { version: -1 } }])(
    "fails safely for malformed package snapshots",
    (snapshot) => {
      expect(getBookingPackageSnapshot(snapshot)).toEqual({});
    },
  );
});
