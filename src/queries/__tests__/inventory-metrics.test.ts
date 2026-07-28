import { describe, expect, test } from "vitest";
import { calculateInventoryAvailability } from "@/queries/inventory-metrics";

describe("calculateInventoryAvailability", () => {
  test("does not invent inventory when the fleet is empty", () => {
    expect(calculateInventoryAvailability([])).toEqual({
      totalUnits: 0,
      availableUnits: 0,
      reservedUnits: 0,
      maintenanceUnits: 0,
      utilizationPct: 0,
      availablePct: 0,
    });
  });

  test("calculates fleet counts and percentages from real rows", () => {
    expect(
      calculateInventoryAvailability([
        { status: "READY_TO_DEPLOY" },
        { status: "READY_TO_DEPLOY" },
        { status: "IN_USE" },
        { status: "UNDER_REPAIR" },
      ]),
    ).toEqual({
      totalUnits: 4,
      availableUnits: 2,
      reservedUnits: 1,
      maintenanceUnits: 1,
      utilizationPct: 25,
      availablePct: 50,
    });
  });
});
