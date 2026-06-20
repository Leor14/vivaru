import type { Expense } from "@/types/domain";

import { categoryLabel } from "./financial-statement";

/**
 * Resumen de cuentas por pagar a partir de los egresos. Selector puro (asOf
 * inyectado) para el tablero "Cuentas por pagar" en Cartera. Solo considera
 * egresos en estado "registrado" (pendientes de pago); ignora pagados y
 * anulados. Ver chart-theme.ts y StatTile para la presentación.
 */

export type PayableSummary = {
  totalPayable: number;
  /** Pendientes que vencen dentro del horizonte (default 30 días). */
  dueSoon: number;
  /** Pendientes ya vencidos (dueDate < asOf). */
  overdue: number;
  horizonDays: number;
  byCategory: { category: string; label: string; amount: number }[];
};

/** Suma `days` a una fecha "YYYY-MM-DD" en UTC y devuelve "YYYY-MM-DD". */
export function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function summarizePayables(
  expenses: Expense[],
  opts: { asOf: string; horizonDays?: number },
): PayableSummary {
  const horizonDays = opts.horizonDays ?? 30;
  const cutoff = addDaysIso(opts.asOf, horizonDays);
  let totalPayable = 0;
  let dueSoon = 0;
  let overdue = 0;
  const byCat = new Map<string, number>();

  for (const e of expenses) {
    if (e.status !== "registrado") continue;
    totalPayable += e.amount;
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
    if (e.dueDate) {
      if (e.dueDate < opts.asOf) overdue += e.amount;
      else if (e.dueDate <= cutoff) dueSoon += e.amount;
    }
  }

  const byCategory = [...byCat.entries()]
    .map(([category, amount]) => ({ category, label: categoryLabel(category), amount }))
    .sort((a, b) => b.amount - a.amount);

  return { totalPayable, dueSoon, overdue, horizonDays, byCategory };
}
