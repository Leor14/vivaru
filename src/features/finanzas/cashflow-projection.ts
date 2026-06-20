import type { BillingStatement, Expense } from "@/types/domain";

import { granularityFor } from "./fund-coverage";
import { addDaysIso } from "./payables";

/**
 * Horizontes de proyección (en días) según el período: la granularidad escala
 * con el período (semanal → quincenal → mensual) y se topa en 6 checkpoints para
 * no saturar el gráfico de barras agrupadas. P. ej. 1 mes → [7,14,21,28];
 * 3 meses → [15..90]; 12 meses → [60..360].
 */
export function projectionCheckpoints(periodMonths: number): number[] {
  const g = granularityFor(periodMonths);
  const spanDays = g.unit === "week" ? 7 : g.unit === "fortnight" ? 15 : 30;
  const step = Math.max(1, Math.ceil(g.count / 6));
  const days: number[] = [];
  for (let i = step; i < g.count; i += step) days.push(i * spanDays);
  days.push(g.count * spanDays);
  return days;
}

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
