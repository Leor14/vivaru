// tests/finanzas-statement.test.ts
// F1 · C5 — estado de ingresos y egresos por categoría.

import { describe, expect, it } from "vitest";

import { buildFinancialStatement, esRecaudoDeCartera } from "@/features/finanzas/financial-statement";
import type { LedgerEntry } from "@/types/domain";

const entry = (
  type: "ingreso" | "egreso",
  amount: number,
  category?: LedgerEntry["category"],
): LedgerEntry => ({
  id: Math.random().toString(36).slice(2),
  tenantId: "t",
  type,
  date: "2026-06-01",
  amount,
  concept: "c",
  category,
  reconciled: false,
});

describe("buildFinancialStatement", () => {
  it("agrupa por categoría y agrega el recaudo de cuotas como línea alicuota", () => {
    const entries = [
      entry("ingreso", 50, "interes_mora"),
      entry("egreso", 120, "servicios_publicos"),
      entry("egreso", 80, "mantenimiento"),
    ];
    const s = buildFinancialStatement(entries, 1000, 0);

    expect(s.cuotaIncome).toBe(1000);
    expect(s.totalIncome).toBe(1050); // 1000 cuotas + 50 interés
    expect(s.totalExpenses).toBe(200);
    expect(s.netResult).toBe(850);
    expect(s.fundBalance).toBe(850);
    expect(s.incomeByCategory.find((i) => i.category === "alicuota")?.amount).toBe(1000);
  });

  it("no duplica los asientos de libro con categoría alicuota", () => {
    const entries = [entry("ingreso", 1000, "alicuota")];
    const s = buildFinancialStatement(entries, 1000, 0);
    expect(s.totalIncome).toBe(1000);
  });

  // R12 · PRD-V-PLAT-003 — el mismo caso que en computeFundPosition, aquí
  // además comprueba que la multa NO aparece como una línea de ingreso propia
  // duplicando la que ya trae Cartera.
  it("no duplica el asiento de un cargo cuya categoría no es alicuota", () => {
    const multa: LedgerEntry = {
      ...entry("ingreso", 400, "otros_ingresos"),
      sourceType: "billingStatement",
    };
    const s = buildFinancialStatement([multa], 1000, 0);
    expect(s.totalIncome).toBe(1000);
    expect(s.incomeByCategory.find((i) => i.category === "otros_ingresos")).toBeUndefined();
  });

  it("mantiene los ingresos que no vienen de un cargo", () => {
    const arriendo: LedgerEntry = { ...entry("ingreso", 400, "arriendo"), sourceType: "manual" };
    const s = buildFinancialStatement([arriendo], 1000, 0);
    expect(s.totalIncome).toBe(1400);
    expect(s.incomeByCategory.find((i) => i.category === "arriendo")?.amount).toBe(400);
  });
});

describe("esRecaudoDeCartera", () => {
  it("excluye por origen y, durante la convivencia, también por categoría", () => {
    expect(esRecaudoDeCartera({ sourceType: "billingStatement", category: "otros_ingresos" })).toBe(true);
    expect(esRecaudoDeCartera({ sourceType: "reversal", category: "alicuota" })).toBe(true);
    expect(esRecaudoDeCartera({ sourceType: "manual", category: "arriendo" })).toBe(false);
    expect(esRecaudoDeCartera({ sourceType: "expense", category: "nomina" })).toBe(false);
    expect(esRecaudoDeCartera({})).toBe(false);
  });
});
