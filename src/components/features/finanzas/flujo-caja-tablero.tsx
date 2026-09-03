"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer } from "@/components/features/admin/dashboard/chart-container";
import { StatTile, type StatTone } from "@/components/features/finanzas/stat-tile";
import { chartAxis, chartBar, chartColors, chartGrid, chartMargin } from "@/features/finanzas/chart-theme";
import { projectCashFlow, projectionCheckpoints } from "@/features/finanzas/cashflow-projection";
import { useExpenses } from "@/features/finanzas/use-expenses";
import type { BillingStatement } from "@/types/domain";

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Tablero "Flujo de caja proyectado": cruza el ingreso esperado de Cartera
 * (saldos por cobrar que vencen en el horizonte) con las salidas esperadas de
 * Egresos, con horizontes según el período. Recibe los estados de cuenta y trae sus
 * propios egresos. Mismos primitivos de la familia.
 */
export function FlujoCajaTablero({
  tenantId,
  statements,
  periodMonths = 3,
  formatAmount,
  formatAmountCompact,
}: {
  tenantId?: string;
  statements: BillingStatement[];
  periodMonths?: number;
  formatAmount: (value: number) => string;
  formatAmountCompact: (value: number) => string;
}) {
  const { expenses } = useExpenses(tenantId);
  // Granularidad de la proyección según el período (semanal/quincenal/mensual).
  const horizons = projectionCheckpoints(periodMonths);
  const proj = projectCashFlow(statements, expenses, { asOf: todayIso(), horizons });

  const monthsLabel = (m: number) => `${m} ${m === 1 ? "mes" : "meses"}`;
  const horizonLabel = (days: number) =>
    days % 30 === 0 ? monthsLabel(days / 30) : days % 7 === 0 ? `${days / 7} sem` : `${days} d`;
  const headline = proj.horizons[proj.horizons.length - 1];
  const periodLabel = horizonLabel(headline.horizonDays);
  const chartRows = proj.horizons.map((h) => ({
    label: horizonLabel(h.horizonDays),
    Entradas: h.inflow,
    Salidas: h.outflow,
  }));

  const netTone: StatTone = headline.net >= 0 ? "green" : "red";
  const netText = `${headline.net >= 0 ? "+" : "−"}${formatAmount(Math.abs(headline.net))}`;

  return (
    <ChartContainer
      title="Flujo de caja proyectado"
      description="Entradas esperadas vs salidas por pagar dentro del período."
      helpText="Entradas: saldos de Cartera por cobrar que vencen en el horizonte. Salidas: cuentas por pagar de Egresos que vencen en el horizonte. El horizonte lo fija el período de análisis; el resultado es la diferencia."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile tone="green" label={`Entradas (${periodLabel})`} value={formatAmount(headline.inflow)} />
        <StatTile tone="red" label={`Salidas (${periodLabel})`} value={formatAmount(headline.outflow)} />
        <StatTile tone={netTone} label={`Resultado proy. (${periodLabel})`} value={netText} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-[var(--slate-500)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.barGreen }} />
          Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chartColors.barRed }} />
          Salidas
        </span>
      </div>

      <div className="mt-2 h-[220px] rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-strong)] px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} margin={chartMargin}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="label" {...chartAxis} />
            <YAxis tickFormatter={(value) => formatAmountCompact(Number(value))} {...chartAxis} />
            <Tooltip formatter={(value) => formatAmount(Number(value))} cursor={{ fill: "rgba(140,178,214,0.12)" }} />
            <Bar dataKey="Entradas" fill={chartColors.barGreen} {...chartBar} />
            <Bar dataKey="Salidas" fill={chartColors.barRed} {...chartBar} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
