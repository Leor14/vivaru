"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer } from "@/components/features/admin/dashboard/chart-container";
import { StatTile, type StatTone } from "@/components/features/finanzas/stat-tile";
import { chartAxis, chartBar, chartColors, chartGrid, chartMargin } from "@/features/finanzas/chart-theme";
import { projectCashFlow } from "@/features/finanzas/cashflow-projection";
import { useExpenses } from "@/features/finanzas/use-expenses";
import type { BillingStatement } from "@/types/domain";

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Tablero "Flujo de caja proyectado": cruza el ingreso esperado de Cartera
 * (saldos por cobrar que vencen en el horizonte) con las salidas esperadas de
 * Egresos, a 30 y 60 días. Recibe los estados de cuenta del padre y trae sus
 * propios egresos. Mismos primitivos de la familia.
 */
export function FlujoCajaTablero({
  tenantId,
  statements,
  formatAmount,
  formatAmountCompact,
}: {
  tenantId?: string;
  statements: BillingStatement[];
  formatAmount: (value: number) => string;
  formatAmountCompact: (value: number) => string;
}) {
  const { expenses } = useExpenses(tenantId);
  const proj = projectCashFlow(statements, expenses, { asOf: todayIso(), horizons: [30, 60] });
  const h30 = proj.horizons[0];
  const chartRows = proj.horizons.map((h) => ({
    label: `${h.horizonDays} días`,
    Entradas: h.inflow,
    Salidas: h.outflow,
  }));

  const netTone: StatTone = h30.net >= 0 ? "green" : "red";
  const netText = `${h30.net >= 0 ? "+" : "−"}${formatAmount(Math.abs(h30.net))}`;

  return (
    <ChartContainer
      title="Flujo de caja proyectado"
      description="Entradas esperadas vs salidas por pagar, a 30 y 60 días."
      helpText="Entradas: saldos de Cartera por cobrar que vencen en el horizonte. Salidas: cuentas por pagar de Egresos que vencen en el horizonte. El resultado es la diferencia."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile tone="green" label="Entradas 30 días" value={formatAmount(h30.inflow)} />
        <StatTile tone="red" label="Salidas 30 días" value={formatAmount(h30.outflow)} />
        <StatTile tone={netTone} label="Resultado proy. (30d)" value={netText} />
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

      <div className="mt-2 h-[220px] rounded-2xl border border-[var(--slate-200)] bg-white px-2 py-2">
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
