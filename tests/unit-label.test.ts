import { describe, expect, it } from "vitest";

import { buildUnitIndex, resolveUnitName, UNRESOLVED_UNIT_LABEL } from "@/utils/unitLabel";

const units = [
  { id: "G1bWNzZJuakw9KRoAx7p", unitId: "apartamento-201", displayName: "Apartamento 201" },
  { id: "9YLUY4ki4uny212nKxnp", unitId: "t1-101", displayName: "T1-101" },
];
const index = buildUnitIndex(units);

// Ninguna resolución debe devolver un ID crudo de Firestore (20 chars).
const RAW_ID = /[A-Za-z0-9]{20}/;

describe("resolveUnitName", () => {
  it("resuelve por doc id", () => {
    expect(resolveUnitName("G1bWNzZJuakw9KRoAx7p", index)).toBe("Apartamento 201");
  });

  it("resuelve por slug (unitId)", () => {
    expect(resolveUnitName("apartamento-201", index)).toBe("Apartamento 201");
  });

  it("recupera un compuesto histórico 'torre-<docId>'", () => {
    expect(resolveUnitName("torre1-G1bWNzZJuakw9KRoAx7p", index)).toBe("Apartamento 201");
  });

  it("devuelve un texto ya humano tal cual", () => {
    expect(resolveUnitName("Apartamento 305", index)).toBe("Apartamento 305");
  });

  it("nunca renderiza un ID crudo cuando no resuelve", () => {
    const out = resolveUnitName("ZZZZZZZZZZZZZZZZZZZZ", index);
    expect(out).toBe(UNRESOLVED_UNIT_LABEL);
    expect(out).not.toMatch(RAW_ID);
  });

  it("recupera un compuesto cuya cola no está en el índice → fallback seguro", () => {
    const out = resolveUnitName("torreX-ZZZZZZZZZZZZZZZZZZZZ", index);
    expect(out).toBe(UNRESOLVED_UNIT_LABEL);
    expect(out).not.toMatch(RAW_ID);
  });

  it("vacío/nulo → fallback seguro", () => {
    expect(resolveUnitName("", index)).toBe(UNRESOLVED_UNIT_LABEL);
    expect(resolveUnitName(null, index)).toBe(UNRESOLVED_UNIT_LABEL);
    expect(resolveUnitName(undefined, index)).toBe(UNRESOLVED_UNIT_LABEL);
  });
});
