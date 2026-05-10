// tests/imp03-guard-components.test.ts
// BLOQUE 4 — GuardDashboard y GuardPackagesList: splitTowerUnit aplicado a unitLabel (C3/C4)
// src/components/securityGuard/GuardDashboard.tsx
// src/components/securityGuard/GuardPackagesList.tsx

import { describe, expect, it } from "vitest";
import { splitTowerUnit } from "../src/lib/utils/unit-display";

// GuardDashboard usa: splitTowerUnit(visitor.unitLabel ?? "").formatted
function guardDashboardVisitorDisplay(unitLabel: string | undefined): string {
  return splitTowerUnit(unitLabel ?? "").formatted;
}

// GuardDashboard usa: splitTowerUnit(reservation.unitLabel ?? "").formatted
function guardDashboardReservationDisplay(unitLabel: string | undefined): string {
  return splitTowerUnit(unitLabel ?? "").formatted;
}

// GuardPackagesList usa: item.unitLabel ? splitTowerUnit(item.unitLabel).formatted : "Sin unidad"
function guardPackagesListDisplay(unitLabel: string | undefined | null): string {
  return unitLabel ? splitTowerUnit(unitLabel).formatted : "Sin unidad";
}

describe("GuardDashboard — unitLabel display (C3)", () => {
  it("visitor.unitLabel 'Torre 1-t2-503' → 'Torre 1 / t2-503'", () => {
    expect(guardDashboardVisitorDisplay("Torre 1-t2-503")).toBe("Torre 1 / t2-503");
  });

  it("reservation.unitLabel 'Torre 2-apt-202' → 'Torre 2 / apt-202'", () => {
    expect(guardDashboardReservationDisplay("Torre 2-apt-202")).toBe("Torre 2 / apt-202");
  });

  it("visitor.unitLabel undefined → no crash, retorna cadena vacía o '-'", () => {
    const r = guardDashboardVisitorDisplay(undefined);
    expect(typeof r).toBe("string");
  });

  it("no muestra el unitLabel crudo con guión técnico", () => {
    const raw = "Torre 1-t2-503";
    expect(guardDashboardVisitorDisplay(raw)).not.toBe(raw);
    expect(guardDashboardVisitorDisplay(raw)).toContain(" / ");
  });
});

describe("GuardPackagesList — unitLabel display (C4)", () => {
  it("item.unitLabel 'Torre 1-t2-503' → 'Torre 1 / t2-503'", () => {
    expect(guardPackagesListDisplay("Torre 1-t2-503")).toBe("Torre 1 / t2-503");
  });

  it("item.unitLabel undefined → 'Sin unidad'", () => {
    expect(guardPackagesListDisplay(undefined)).toBe("Sin unidad");
  });

  it("item.unitLabel '' → 'Sin unidad' (falsy fallback)", () => {
    expect(guardPackagesListDisplay("")).toBe("Sin unidad");
  });

  it("item.unitLabel null → 'Sin unidad'", () => {
    expect(guardPackagesListDisplay(null)).toBe("Sin unidad");
  });

  it("no muestra unitLabel crudo cuando tiene torre", () => {
    const raw = "Torre 2-apt-202";
    expect(guardPackagesListDisplay(raw)).not.toBe(raw);
    expect(guardPackagesListDisplay(raw)).toBe("Torre 2 / apt-202");
  });
});
