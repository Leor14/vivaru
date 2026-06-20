import type { LedgerEntry } from "@/types/domain";

import { addDaysIso } from "./payables";

const MONTH_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/**
 * Cobertura del fondo ("runway"): cuántos meses de gastos cubre el saldo de
 * fondos al ritmo de egreso reciente. Selector puro (sin I/O ni Date) para que
 * sea testeable; el llamador inyecta `asOf`. La ventana `months` arranca en 3
 * pero queda parametrizada para que un filtro de página la gobierne más adelante.
 * Alimenta el tablero "Liquidez y cobertura del fondo" en Cartera.
 */

export type MonthlyExpense = { month: string; amount: number };

export type FundCoverage = {
  fundBalance: number;
  avgMonthlyExpense: number;
  /** null cuando no hay egresos en la ventana (cobertura indefinida). */
  coverageMonths: number | null;
  months: number;
  monthlyExpenses: MonthlyExpense[];
};

/** Devuelve las `count` claves "YYYY-MM" que terminan en `asOfMonth` (incluido). */
function trailingMonths(asOfMonth: string, count: number): string[] {
  const [y, m] = asOfMonth.split("-").map(Number);
  const out: string[] = [];
  let year = y;
  let mon = m;
  for (let i = 0; i < count; i += 1) {
    out.unshift(`${year}-${String(mon).padStart(2, "0")}`);
    mon -= 1;
    if (mon === 0) {
      mon = 12;
      year -= 1;
    }
  }
  return out;
}

export type SeriesBucket = { label: string; amount: number };
export type GranularityUnit = "week" | "fortnight" | "month";

/**
 * Mapea el período de análisis a la granularidad de la serie temporal: cuanto
 * más corto el período, más fino el bucket. 1 mes → semanal, hasta 3 meses →
 * quincenal, más allá → mensual. Una sola fuente de verdad para los tableros.
 */
export function granularityFor(months: number): { unit: GranularityUnit; count: number; label: string } {
  if (months <= 1) return { unit: "week", count: 4, label: "semanal" };
  if (months <= 3) return { unit: "fortnight", count: months * 2, label: "quincenal" };
  return { unit: "month", count: months, label: "mensual" };
}

/**
 * Serie de egresos agrupada según la granularidad (semanal, quincenal o
 * mensual), de la más antigua a la más reciente terminando en `asOf`. Alimenta
 * el gráfico del tablero de Liquidez según el período seleccionado.
 */
export function buildExpenseSeries(
  entries: LedgerEntry[],
  opts: { asOf: string; unit: GranularityUnit; count: number },
): SeriesBucket[] {
  const { asOf, unit, count } = opts;

  if (unit === "month") {
    const months = trailingMonths(asOf.slice(0, 7), count);
    const byMonth = new Map<string, number>(months.map((mm) => [mm, 0]));
    for (const entry of entries) {
      if (entry.type !== "egreso" || !entry.date) continue;
      const mm = entry.date.slice(0, 7);
      if (byMonth.has(mm)) byMonth.set(mm, (byMonth.get(mm) ?? 0) + entry.amount);
    }
    return months.map((mm) => {
      const [y, m] = mm.split("-").map(Number);
      return { label: `${MONTH_ABBR[m - 1]} ${String(y).slice(2)}`, amount: byMonth.get(mm) ?? 0 };
    });
  }

  const span = unit === "fortnight" ? 15 : 7;
  const buckets: { start: string; end: string; label: string; amount: number }[] = [];
  for (let i = 0; i < count; i += 1) {
    const end = addDaysIso(asOf, -span * i);
    const start = addDaysIso(asOf, -span * i - (span - 1));
    const [, m, d] = start.split("-").map(Number);
    buckets.unshift({ start, end, label: `${d} ${MONTH_ABBR[m - 1]}`, amount: 0 });
  }

  for (const entry of entries) {
    if (entry.type !== "egreso" || !entry.date) continue;
    const date = entry.date;
    const bucket = buckets.find((b) => date >= b.start && date <= b.end);
    if (bucket) bucket.amount += entry.amount;
  }

  return buckets.map((b) => ({ label: b.label, amount: b.amount }));
}

export function computeFundCoverage(
  entries: LedgerEntry[],
  fundBalance: number,
  opts: { asOf: string; months?: number },
): FundCoverage {
  const months = opts.months ?? 3;
  const windowMonths = months > 0 ? trailingMonths(opts.asOf.slice(0, 7), months) : [];
  const byMonth = new Map<string, number>(windowMonths.map((mm) => [mm, 0]));

  for (const entry of entries) {
    if (entry.type !== "egreso" || !entry.date) continue;
    const mm = entry.date.slice(0, 7);
    if (byMonth.has(mm)) byMonth.set(mm, (byMonth.get(mm) ?? 0) + entry.amount);
  }

  const monthlyExpenses = windowMonths.map((mm) => ({ month: mm, amount: byMonth.get(mm) ?? 0 }));
  const total = monthlyExpenses.reduce((sum, x) => sum + x.amount, 0);
  const avgMonthlyExpense = months > 0 ? total / months : 0;
  const coverageMonths = avgMonthlyExpense > 0 ? fundBalance / avgMonthlyExpense : null;

  return { fundBalance, avgMonthlyExpense, coverageMonths, months, monthlyExpenses };
}
