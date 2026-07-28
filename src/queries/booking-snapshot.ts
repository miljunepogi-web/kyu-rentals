export interface BookingCustomerContact {
  fullName?: string;
  email?: string;
  phone?: string;
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getBookingCustomerContact(snapshot: unknown): BookingCustomerContact {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }

  const customer = (snapshot as Record<string, unknown>).customer;
  if (!customer || typeof customer !== "object" || Array.isArray(customer)) {
    return {};
  }

  const contact = customer as Record<string, unknown>;
  return {
    fullName: nonEmptyString(contact.fullName),
    email: nonEmptyString(contact.email),
    phone: nonEmptyString(contact.phone),
  };
}
