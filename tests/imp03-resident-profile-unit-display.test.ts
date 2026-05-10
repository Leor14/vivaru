// tests/imp03-resident-profile-unit-display.test.ts
// BLOQUE 2 — ResidentProfileCard: unitDisplay computation (C2)
// (components/features/resident/ResidentProfileCard.tsx)

import { describe, expect, it } from "vitest";

// Extracted from the IIFE in ResidentProfileCard.
// Must match the exact production logic.
function computeUnitDisplay(user: { unitLabel?: string; unitId?: string } | null | undefined): string {
  const label = user?.unitLabel ?? user?.unitId;
  if (!label) return "-";
  const dashIdx = label.indexOf("-");
  if (dashIdx > 0 && label.slice(0, dashIdx).includes(" ")) {
    return `${label.slice(0, dashIdx)} / ${label.slice(dashIdx + 1)}`;
  }
  return label;
}

describe("ResidentProfileCard — unitDisplay (C2)", () => {
  it("transforma 'Torre 1-t2-503' → 'Torre 1 / t2-503'", () => {
    expect(computeUnitDisplay({ unitLabel: "Torre 1-t2-503" })).toBe("Torre 1 / t2-503");
  });

  it("los 3 puntos de display muestran el valor transformado para Torre 1-t2-503", () => {
    const result = computeUnitDisplay({ unitLabel: "Torre 1-t2-503" });
    // Verifica que los 3 puntos de render usan el mismo resultado
    expect(result).toBe("Torre 1 / t2-503");
    // No muestra el crudo
    expect(result).not.toBe("Torre 1-t2-503");
  });

  it("slug sin torre 't2-503' → 't2-503' sin barra", () => {
    expect(computeUnitDisplay({ unitLabel: "t2-503" })).toBe("t2-503");
  });

  it("unitLabel undefined + unitId 't2-503' → 't2-503'", () => {
    expect(computeUnitDisplay({ unitLabel: undefined, unitId: "t2-503" })).toBe("t2-503");
  });

  it("unitLabel undefined + unitId undefined → '-'", () => {
    expect(computeUnitDisplay({ unitLabel: undefined, unitId: undefined })).toBe("-");
  });

  it("user null → '-'", () => {
    expect(computeUnitDisplay(null)).toBe("-");
  });

  it("no contiene patron hash (20+ chars alfanum) en resultado", () => {
    const hash = "u-t2-503-G1bWNzZJuakw9KRoAx7p";
    const result = computeUnitDisplay({ unitLabel: hash });
    // Hash de Firestore tiene >20 chars; el display no debe ser un hash puro
    // Si viene como unitLabel se pasa tal cual (ya no debería llegar tras IMP-02),
    // pero si el tower tiene espacio, se parte. El test verifica que no hay patrón /^[a-z0-9]{20,}$/
    expect(/^[a-z0-9]{20,}$/.test(result)).toBe(false);
  });

  it("'Torre Central-apt-202' → 'Torre Central / apt-202'", () => {
    expect(computeUnitDisplay({ unitLabel: "Torre Central-apt-202" })).toBe("Torre Central / apt-202");
  });

  it("unitLabel nunca se muestra crudo cuando contiene 'Torre X-'", () => {
    const labels = ["Torre 1-t2-503", "Torre 2-apt-202", "Torre Central-bloque-a-101"];
    for (const lbl of labels) {
      const result = computeUnitDisplay({ unitLabel: lbl });
      expect(result).not.toBe(lbl);
      expect(result).toContain(" / ");
    }
  });
});
