import {
  statementChargedAmount,
  statementCollectedAmount,
  statementSettledAmount,
} from "@/features/billing/collection";
import type { BillingStatement } from "@/types/domain";

export type BillingTrendPoint = {
  period: string;
  totalCharged: number;
  /** El dinero que entró. Es lo que se pinta como «recaudado» en las barras. */
  totalCollected: number;
  /**
   * Lo que dejó de deberse (`FLOW-002` R16). **Es el numerador del «% recaudo»**,
   * y no `totalCollected`: en cuanto hay anticipos los dos dejan de ser el mismo
   * número, y una unidad que cubre julio con un anticipo de junio saldría al 0 %
   * con la cuota saldada.
   */
  totalSettled: number;
};

/**
 * **`L-24` — la tendencia ACUMULADA, «desde el primer mes del año hasta el mes en curso».**
 *
 * Lote «Análisis de la plataforma» (pág. 9 de su documento). La tendencia mes a mes ya existía; lo
 * que pedía y no estaba es el acumulado. Vive junto a `buildBillingTrend` a propósito: el día que
 * cambie cómo se suma un período, las dos lecturas cambian a la vez.
 *
 * **Acumula sobre los puntos que recibe, en orden de período**, así que respeta el rango que el
 * administrador tenga puesto en el gráfico. `acumuladoDelAnio` es la otra pregunta —la del año
 * natural— y filtra por el prefijo `YYYY` del período, que está en el 100% de los cargos.
 */
export function acumularTendencia(puntos: readonly BillingTrendPoint[]): BillingTrendPoint[] {
  let cobrado = 0;
  let recaudado = 0;
  let saldado = 0;
  return [...puntos]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((punto) => {
      cobrado += punto.totalCharged;
      recaudado += punto.totalCollected;
      saldado += punto.totalSettled;
      return { period: punto.period, totalCharged: cobrado, totalCollected: recaudado, totalSettled: saldado };
    });
}

export type AcumuladoDelAnio = {
  anio: string;
  /** Los períodos del año que tienen datos, en orden. Vacío si el año no tiene ninguno. */
  periodos: string[];
  cobrado: number;
  recaudado: number;
  /** Lo que sigue debiéndose del año: cobrado menos lo que dejó de deberse. */
  pendiente: number;
};

export function acumuladoDelAnio(puntos: readonly BillingTrendPoint[], anio: string): AcumuladoDelAnio {
  const delAnio = puntos.filter((p) => p.period.slice(0, 4) === anio).sort((a, b) => a.period.localeCompare(b.period));
  const cobrado = delAnio.reduce((suma, p) => suma + p.totalCharged, 0);
  const recaudado = delAnio.reduce((suma, p) => suma + p.totalCollected, 0);
  const saldado = delAnio.reduce((suma, p) => suma + p.totalSettled, 0);
  return { anio, periodos: delAnio.map((p) => p.period), cobrado, recaudado, pendiente: cobrado - saldado };
}

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function toMonthPeriod(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{4}-\d{2})/);
  return match ? match[1] : null;
}

export function getBillingPeriods(statements: BillingStatement[], unitFilter: string) {
  const periods = new Set<string>();
  statements.forEach((statement) => {
    const unitMatches = unitFilter === "all" ? true : statement.unitLabel === unitFilter;
    if (!unitMatches) return;
    const period = toMonthPeriod(statement.period);
    if (!period) return;
    periods.add(period);
  });
  return Array.from(periods).sort((a, b) => a.localeCompare(b));
}

export function buildBillingTrend(
  statements: BillingStatement[],
  unitFilter: string,
  fromPeriod: string,
  toPeriod: string,
): BillingTrendPoint[] {
  const grouped = new Map<string, BillingTrendPoint>();

  statements.forEach((statement) => {
    const unitMatches = unitFilter === "all" ? true : statement.unitLabel === unitFilter;
    if (!unitMatches) return;

    const period = toMonthPeriod(statement.period);
    if (!period) return;
    if (fromPeriod && period < fromPeriod) return;
    if (toPeriod && period > toPeriod) return;

    // Fórmula única de facturado/recaudado/liquidado (src/features/billing/collection.ts).
    const collected = statementCollectedAmount(statement);
    const charged = statementChargedAmount(statement);
    const settled = statementSettledAmount(statement);

    const current = grouped.get(period) ?? { period, totalCharged: 0, totalCollected: 0, totalSettled: 0 };
    current.totalCharged += charged;
    current.totalCollected += collected;
    current.totalSettled += settled;
    grouped.set(period, current);
  });

  return Array.from(grouped.values()).sort((a, b) => a.period.localeCompare(b.period));
}
