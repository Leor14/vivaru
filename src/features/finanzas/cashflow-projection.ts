import type { BillingStatement, Expense } from "@/types/domain";

import { addDaysIso } from "./payables";

/**
 * Proyección de flujo de caja: cruza el ingreso esperado de Cartera (saldos por
 * cobrar con vencimiento dentro del horizonte) con las salidas esperadas de
 * Egresos (cuentas por pagar con vencimiento dentro del horizonte). Selector
 * puro (asOf inyectado) para el tablero "Flujo de caja proyectado".
 */

export type CashFlowHorizon = {
  horizonDays: number;
  inflow: number;
  outflow: number;
  net: number;
};

export type CashFlowProjection = { horizons: CashFlowHorizon[] };

export function projectCashFlow(
  statements: BillingStatement[],
  expenses: Expense[],
  opts: { asOf: string; horizons?: number[] },
): CashFlowProjection {
  const horizons = opts.horizons ?? [30, 60];

  return {
    horizons: horizons.map((days) => {
      const cutoff = addDaysIso(opts.asOf, days);
      let inflow = 0;
      let outflow = 0;

      for (const s of statements) {
        // Pendiente o en mora; lo pagado ya no es ingreso futuro.
        if (s.status === "paid") continue;
        if (s.dueDate && s.dueDate <= cutoff) inflow += s.balance;
      }
      for (const e of expenses) {
        if (e.status !== "registrado") continue;
        if (e.dueDate && e.dueDate <= cutoff) outflow += e.amount;
      }

      return { horizonDays: days, inflow, outflow, net: inflow - outflow };
    }),
  };
}
