import { describe, expect, it } from "vitest";

import { buildWeeklyExpenseSeries, computeFundCoverage } from "@/features/finanzas/fund-coverage";
import type { LedgerEntry } from "@/types/domain";

const egreso = (date: string, amount: number): LedgerEntry =>
  ({ type: "egreso", date, amount } as LedgerEntry);

const ingreso = (date: string, amount: number): LedgerEntry =>
  ({ type: "ingreso", date, amount } as LedgerEntry);

describe("computeFundCoverage", () => {
  it("promedia el egreso de la ventana de 3 meses y calcula la cobertura", () => {
    const entries = [
      egreso("2026-04-10", 6_000_000),
      egreso("2026-05-12", 9_000_000),
      egreso("2026-06-03", 3_000_000),
    ];
    const res = computeFundCoverage(entries, 36_000_000, { asOf: "2026-06-19", months: 3 });
    expect(res.avgMonthlyExpense).toBe(6_000_000);
    expect(res.coverageMonths).toBe(6);
    expect(res.monthlyExpenses.map((m) => m.month)).toEqual(["2026-04", "2026-05", "2026-06"]);
  });

  it("ignora egresos fuera de la ventana y los ingresos", () => {
    const entries = [
      egreso("2026-01-10", 99_000_000),
      ingreso("2026-05-10", 50_000_000),
      egreso("2026-05-10", 9_000_000),
    ];
    const res = computeFundCoverage(entries, 9_000_000, { asOf: "2026-06-19", months: 3 });
    expect(res.avgMonthlyExpense).toBe(3_000_000);
    expect(res.coverageMonths).toBe(3);
  });

  it("devuelve cobertura null cuando no hay egresos en la ventana", () => {
    const res = computeFundCoverage([egreso("2025-12-01", 1_000_000)], 10_000_000, {
      asOf: "2026-06-19",
      months: 3,
    });
    expect(res.avgMonthlyExpense).toBe(0);
    expect(res.coverageMonths).toBeNull();
  });

  it("respeta una ventana distinta y cruza el cambio de año", () => {
    const entries = [egreso("2026-01-05", 4_000_000), egreso("2025-12-05", 2_000_000)];
    const res = computeFundCoverage(entries, 12_000_000, { asOf: "2026-02-15", months: 6 });
    expect(res.monthlyExpenses.map((m) => m.month)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(res.avgMonthlyExpense).toBe(1_000_000);
  });
});

describe("buildWeeklyExpenseSeries", () => {
  it("agrupa egresos en las últimas 4 semanas (antigua → reciente) e ignora lo de fuera", () => {
    const entries = [
      egreso("2026-06-15", 1_000_000),
      egreso("2026-06-10", 2_000_000),
      egreso("2026-05-25", 3_000_000),
      egreso("2026-04-01", 9_000_000),
    ];
    const res = buildWeeklyExpenseSeries(entries, { asOf: "2026-06-19", weeks: 4 });
    expect(res).toHaveLength(4);
    expect(res.map((b) => b.amount)).toEqual([3_000_000, 0, 2_000_000, 1_000_000]);
  });
});
