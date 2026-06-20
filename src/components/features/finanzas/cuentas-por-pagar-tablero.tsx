"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer } from "@/components/features/admin/dashboard/chart-container";
import { StatTile } from "@/components/features/finanzas/stat-tile";
import { chartAxis, chartBar, chartColors, chartGrid, chartMargin } from "@/features/finanzas/chart-theme";
import { summarizePayables } from "@/features/finanzas/payables";
import { useExpenses } from "@/features/finanzas/use-expenses";

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Tablero "Cuentas por pagar": resume los egresos pendientes (total, lo que
 * vence en 30 días, lo ya vencido) y los desglosa por categoría. Construido con
 * los primitivos de la familia (ChartContainer + StatTile + chartTheme). Trae
 * sus propios egresos del tenant.
 */
export function CuentasPorPagarTablero({
  tenantId,
  formatAmount,
  formatAmountCompact,
}: {
  tenantId?: string;
  formatAmount: (value: number) => string;
  formatAmountCompact: (value: number) => string;
}) {
  const { expenses } = useExpenses(tenantId);
  const summary = summarizePayables(expenses, { asOf: todayIso(), horizonDays: 30 });
  const chartRows = summary.byCategory.map((c) => ({ label: c.label, amount: c.amount }));

  return (
    <ChartContainer
      title="Cuentas por pagar"
      description="Egresos pendientes del conjunto y su vencimiento."
      helpText="Solo cuenta egresos pendientes de pago (no los pagados ni anulados). 'Vence en 30 días' y 'Vencido' se calculan con la fecha de vencimiento de cada egreso."
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatTile tone="blue" label="Total por pagar" value={formatAmount(summary.totalPayable)} />
        <StatTile tone="amber" label="Vence en 30 días" value={formatAmount(summary.dueSoon)} />
        <StatTile tone="red" label="Vencido" value={formatAmount(summary.overdue)} />
      </div>

      <div className="mt-4 h-[220px] rounded-2xl border border-[var(--slate-200)] bg-white px-2 py-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} margin={chartMargin}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="label" {...chartAxis} />
            <YAxis tickFormatter={(value) => formatAmountCompact(Number(value))} {...chartAxis} />
            <Tooltip formatter={(value) => formatAmount(Number(value))} cursor={{ fill: "rgba(224,182,106,0.14)" }} />
            <Bar dataKey="amount" name="Por pagar" fill={chartColors.barAmber} {...chartBar} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
}
