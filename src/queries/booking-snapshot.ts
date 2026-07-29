export interface BookingCustomerContact {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface BookingPackageSnapshot {
  name?: string;
  slug?: string;
  version?: number;
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

export function getBookingPackageSnapshot(snapshot: unknown): BookingPackageSnapshot {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return {};
  }

  const packageData = (snapshot as Record<string, unknown>).package;
  if (!packageData || typeof packageData !== "object" || Array.isArray(packageData)) {
    return {};
  }

  const frozenPackage = packageData as Record<string, unknown>;
  return {
    name: nonEmptyString(frozenPackage.name),
    slug: nonEmptyString(frozenPackage.slug),
    version:
      typeof frozenPackage.version === "number" &&
      Number.isInteger(frozenPackage.version) &&
      frozenPackage.version > 0
        ? frozenPackage.version
        : undefined,
  };
}
