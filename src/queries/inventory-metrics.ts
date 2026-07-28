export interface InventoryStatusRow {
  status: string;
}

export function calculateInventoryAvailability(units: InventoryStatusRow[]) {
  const totalUnits = units.length;
  const availableUnits = units.filter((unit) => unit.status === "READY_TO_DEPLOY").length;
  const reservedUnits = units.filter((unit) => unit.status === "IN_USE").length;
  const maintenanceUnits = units.filter((unit) => unit.status === "UNDER_REPAIR").length;

  return {
    totalUnits,
    availableUnits,
    reservedUnits,
    maintenanceUnits,
    utilizationPct: totalUnits === 0 ? 0 : Math.round((reservedUnits / totalUnits) * 100),
    availablePct: totalUnits === 0 ? 0 : Math.round((availableUnits / totalUnits) * 100),
  };
}
