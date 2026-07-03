/**
 * Detección de montos atípicos en egresos (VIV-1201): advertencia suave cuando
 * el monto difiere mucho del histórico de la misma categoría — típicamente un
 * cero de más o de menos al digitar ($15.000 en una categoría que promedia
 * $1.500.000). Se usa la MEDIANA (robusta a outliers previos) con umbral 10x.
 */

const MIN_HISTORY = 3;
const RATIO_THRESHOLD = 10;

export type AmountAnomaly = {
  median: number;
  /** "low" = sospechosamente bajo; "high" = sospechosamente alto. */
  direction: "low" | "high";
};

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Devuelve la anomalía detectada o null. Requiere al menos MIN_HISTORY montos
 * previos de la categoría para opinar (sin histórico no hay base de comparación).
 */
export function detectAmountAnomaly(history: readonly number[], amount: number): AmountAnomaly | null {
  const clean = history.filter((v) => Number.isFinite(v) && v > 0);
  if (clean.length < MIN_HISTORY || !Number.isFinite(amount) || amount <= 0) return null;
  const med = median(clean);
  if (med <= 0) return null;
  if (amount >= med * RATIO_THRESHOLD) return { median: med, direction: "high" };
  if (amount <= med / RATIO_THRESHOLD) return { median: med, direction: "low" };
  return null;
}
