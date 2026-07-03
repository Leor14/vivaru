import { statementChargedAmount, statementCollectedAmount } from "@/features/billing/collection";
import type { BillingStatement } from "@/types/domain";

export type BillingTrendPoint = {
  period: string;
  totalCharged: number;
  totalCollected: number;
};

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

    // Fórmula única de facturado/recaudado (src/features/billing/collection.ts).
    const collected = statementCollectedAmount(statement);
    const charged = statementChargedAmount(statement);

    const current = grouped.get(period) ?? { period, totalCharged: 0, totalCollected: 0 };
    current.totalCharged += charged;
    current.totalCollected += collected;
    grouped.set(period, current);
  });

  return Array.from(grouped.values()).sort((a, b) => a.period.localeCompare(b.period));
}
