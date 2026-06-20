import { describe, expect, it } from "vitest";

import { projectCashFlow, projectionCheckpoints } from "@/features/finanzas/cashflow-projection";
import { summarizePayables } from "@/features/finanzas/payables";
import type { BillingStatement, Expense } from "@/types/domain";

const exp = (
  status: Expense["status"],
  amount: number,
  dueDate: string | undefined,
  category: Expense["category"] = "otros",
): Expense => ({ status, amount, dueDate, category } as Expense);

const stmt = (status: BillingStatement["status"], balance: number, dueDate?: string): BillingStatement =>
  ({ status, balance, dueDate } as BillingStatement);

describe("summarizePayables", () => {
  it("suma pendientes, separa por vencimiento e ignora pagados/anulados", () => {
    const expenses = [
      exp("registrado", 5_000_000, "2026-07-01", "nomina"),
      exp("registrado", 3_000_000, "2026-06-10", "servicios_publicos"),
      exp("registrado", 2_000_000, "2026-09-01", "nomina"),
      exp("pagado", 9_000_000, "2026-07-01"),
      exp("anulado", 1_000_000, "2026-07-01"),
    ];
    const res = summarizePayables(expenses, { asOf: "2026-06-19", horizonDays: 30 });
    expect(res.totalPayable).toBe(10_000_000);
    expect(res.dueSoon).toBe(5_000_000);
    expect(res.overdue).toBe(3_000_000);
    expect(res.byCategory[0]).toMatchObject({ category: "nomina", amount: 7_000_000 });
    expect(res.byCategory).toHaveLength(2);
  });
});

describe("projectCashFlow", () => {
  it("cruza cobros esperados con pagos por horizonte e ignora lo pagado", () => {
    const statements = [
      stmt("pending", 8_000_000, "2026-07-01"),
      stmt("overdue", 4_000_000, "2026-06-01"),
      stmt("pending", 6_000_000, "2026-08-01"),
      stmt("paid", 10_000_000, "2026-07-01"),
    ];
    const expenses = [
      exp("registrado", 5_000_000, "2026-07-10"),
      exp("registrado", 3_000_000, "2026-08-05"),
      exp("pagado", 9_000_000, "2026-07-10"),
    ];
    const res = projectCashFlow(statements, expenses, { asOf: "2026-06-19", horizons: [30, 60] });
    expect(res.horizons[0]).toMatchObject({ inflow: 12_000_000, outflow: 5_000_000, net: 7_000_000 });
    expect(res.horizons[1]).toMatchObject({ inflow: 18_000_000, outflow: 8_000_000, net: 10_000_000 });
  });
});

describe("projectionCheckpoints", () => {
  it("escala con el período y se topa en 6 checkpoints", () => {
    expect(projectionCheckpoints(1)).toEqual([7, 14, 21, 28]);
    expect(projectionCheckpoints(3)).toEqual([15, 30, 45, 60, 75, 90]);
    expect(projectionCheckpoints(12)).toEqual([60, 120, 180, 240, 300, 360]);
  });
});
