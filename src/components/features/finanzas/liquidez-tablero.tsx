"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer } from "@/components/features/admin/dashboard/chart-container";
import { StatTile, type StatTone } from "@/components/features/finanzas/stat-tile";
import { chartAxis, chartBar, chartColors, chartGrid, chartMargin } from "@/features/finanzas/chart-theme";
import { buildExpenseSeries, computeFundCoverage, granularityFor } from "@/features/finanzas/fund-coverage";
import { computeFundPosition, useLedgerEntries } from "@/features/finanzas/use-ledger";

const COVERAGE_TARGET_MONTHS = 6;

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Tono semántico de la cobertura: verde sana, ámbar ajustada, rojo crítica. */
function coverageTone(months: number | null): StatTone {
  if (months == null) return "blue";
  if (months >= COVERAGE_TARGET_MONTHS) return "green";
  if (months >= 3) return "amber";
  return "red";
}

/**
 * Tablero "Liquidez y cobertura del fondo" (flagship del carrusel de Cartera).
 * Cruza el saldo de fondos (Libro) con el ritmo de egreso reciente (Egresos)
 * para responder "¿cuántos meses aguanta el conjunto?". Construido con los
 * primitivos de la familia: ChartContainer + StatTile + chartTheme. Trae sus
 * propios datos del libro; recibe el recaudo de cuotas (cuotaIncome) del padre.
 */
export function LiquidezTablero({
  tenantId,
  cuotaIncome,
  months = 3,
  formatAmount,
  formatAmountCompact,
}: {
  tenantId?: string;
  cuotaIncome: number;
  months?: number;
  formatAmount: (value: number) => string;
  formatAmountCompact: (value: number) => string;
}) {
  const { entries } = useLedgerEntries(tenantId);
  const asOf = todayIso();
  const fund = computeFundPosition(entries, cuotaIncome);
  const coverage = computeFundCoverage(entries, fund.balance, { asOf, months });

  const coverageText =
    coverage.coverageMonths == null ? "—" : `${coverage.coverageMonths.toFixed(1)} meses`;
  // La granularidad del desglose de egresos depende del período: semanal (1 mes),
  // quincenal (hasta 3 meses) o mensual.
  const granularity = granularityFor(months);
  const chartRows = buildExpenseSeries(entries, { asOf, unit: granularity.unit, count: granularity.count });

  return (
    <ChartContainer
      title="Liquidez y cobertura del fondo"
      description="Cuántos meses de gastos cubre el fondo al ritmo de egreso reciente."
      helpText={`Saldo de fondos dividido entre el egreso promedio de los últimos ${months} meses. La meta de referencia es ${COVERAGE_TARGET_MONTHS} meses. Combina datos de Libro y fondos y de Egresos.`}
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile tone="blue" label="Saldo de fondos" value={formatAmount(fund.balance)} />
        <StatTile tone={coverageTone(coverage.coverageMonths)} label="Cobertura del fondo" value={coverageText} />
        <StatTile tone="slate" label={`Gasto prom./mes (${months}m)`} value={formatAmount(coverage.avgMonthlyExpense)} />
      </div>

      <p className="mt-4 text-xs text-[var(--slate-500)]">Egresos por período · vista {granularity.label}</p>
      <div className="mt-2 h-[220px] rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} margin={chartMargin}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="label" {...chartAxis} />
            <YAxis tickFormatter={(value) => formatAmountCompact(Number(value))} {...chartAxis} />
            <Tooltip formatter={(value) => formatAmount(Number(value))} cursor={{ fill: "rgba(140,178,214,0.12)" }} />
            <Bar dataKey="amount" name="Egresos" fill={chartColors.barAmber} {...chartBar} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
