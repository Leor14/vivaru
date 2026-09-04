import type { Expense } from "@/types/domain";

import { categoryLabel, pendienteDelEgreso, sumarDeudaAProveedores } from "@/lib/finanzas/nucleo-estado-financiero";

import { envejecerEgreso } from "./cuotas-del-egreso";

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
  // **El total lo calcula el núcleo del estado financiero, no este bucle.** Es
  // la MISMA cifra que el informe mensual llama «deuda a proveedores»
  // (`PRD-V-FLOW-007` entrega 1), y tenerla escrita dos veces es exactamente
  // cómo nacieron R12 y R16. Lo que sigue en el bucle —el vencimiento y el
  // reparto por categoría— sí es propio de esta tarjeta.
  const totalPayable = sumarDeudaAProveedores(expenses);
  let dueSoon = 0;
  let overdue = 0;
  const byCat = new Map<string, number>();

  for (const e of expenses) {
    if (e.status !== "registrado") continue;
    // **`PRD-V-FLOW-008`: el reparto por categoría suma LO PENDIENTE, no el
    // importe de la factura.** Antes sumaba `e.amount`, que valía lo mismo
    // mientras un egreso solo pudiera estar pagado o sin pagar. Con calendario de
    // cuotas dejarían de coincidir, y entonces esta tarjeta enseñaría **un total
    // y unas categorías que no lo suman** — la contradicción de un widget
    // consigo mismo, que es peor que estar mal.
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + pendienteDelEgreso(e));
    // **El vencimiento va POR CUOTA cuando hay plan** (`RN-09`). Sin plan,
    // `envejecerEgreso` cae al `dueDate` del egreso: idéntico a lo de siempre.
    const { vencido, proximo } = envejecerEgreso(e, opts.asOf, cutoff);
    overdue += vencido;
    dueSoon += proximo;
  }

  const byCategory = [...byCat.entries()]
    .map(([category, amount]) => ({ category, label: categoryLabel(category), amount }))
    .sort((a, b) => b.amount - a.amount);

  return { totalPayable, dueSoon, overdue, horizonDays, byCategory };
}
