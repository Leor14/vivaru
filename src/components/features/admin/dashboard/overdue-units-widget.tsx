"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { computeStatementStatus } from "@/features/billing/statement-status";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import type { BillingStatement } from "@/types/domain";

type Props = {
  items: BillingStatement[];
  loading: boolean;
};

type SortMode = "saldo" | "dias";

function deriveTower(unitLabel: string) {
  const prefix = unitLabel.split("-")[0]?.trim();
  if (prefix && prefix !== unitLabel) return prefix;
  return "Sin torre";
}

/**
 * Días de mora. Sin `dueDate`, se cuenta desde el fin del mes del `period`
 * ("YYYY-MM") — la misma regla con la que computeStatementStatus declara la
 * mora. Antes estos cobros mostraban "0 días vencido" y aun así ofrecían
 * "Enviar aviso" (VIV-102).
 */
function daysOverdue(dueDate?: string, period?: string): number {
  let refDate = dueDate;
  if (!refDate && period && /^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split("-").map(Number);
    // Día 0 del mes siguiente = último día del mes del período (fecha local).
    const lastDay = new Date(year, month, 0);
    refDate = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, "0")}-${String(lastDay.getDate()).padStart(2, "0")}`;
  }
  if (!refDate) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${refDate}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(Math.floor((today.getTime() - due.getTime()) / 86400000), 0);
}

export function OverdueUnitsWidget({ items, loading }: Props) {
  const [sortMode, setSortMode] = useState<SortMode>("saldo");
  const [tower, setTower] = useState<string>("all");
  const { formatAmount } = useTenantCurrency();

  const enriched = useMemo(() => {
    return items
      .filter(
        (item) =>
          computeStatementStatus(item.balance, { dueDate: item.dueDate, period: item.period }) === "overdue",
      )
      .map((item) => ({
        id: item.id,
        unitLabel: item.unitLabel,
        balance: Math.max(item.balance, 0),
        days: daysOverdue(item.dueDate, item.period),
        tower: deriveTower(item.unitLabel ?? ""),
      }))
      // Solo mora efectiva: a 0 días no corresponde "Enviar aviso" (VIV-102).
      .filter((item) => item.days > 0);
  }, [items]);

  const towerOptions = useMemo(
    () => Array.from(new Set(enriched.map((e) => e.tower))).sort(),
    [enriched],
  );

  const filtered = useMemo(() => {
    let list = enriched;
    if (tower !== "all") list = list.filter((e) => e.tower === tower);
    list = [...list].sort((a, b) => (sortMode === "saldo" ? b.balance - a.balance : b.days - a.days));
    return list.slice(0, 3);
  }, [enriched, tower, sortMode]);

  return (
    <Card className="soft-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label text-[var(--slate-500)]">Seguimiento de mora</p>
          <CardTitle className="mt-1 text-lg" help="Ranking de las unidades con mayor saldo vencido. Permite identificar deudores prioritarios para gestion de cobro. Filtra por torre o cambia el criterio de ordenamiento.">Unidades con mayor saldo vencido</CardTitle>
          <CardDescription className="mt-1">
            Top de unidades a priorizar para gestión de cobranza.
          </CardDescription>
        </div>
        <Link href="/admin/billing" className="text-xs font-medium text-[var(--brand-700)] hover:underline">
          Ver cartera →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 rounded-xl bg-[var(--slate-100)] p-1">
          {(["saldo", "dias"] as SortMode[]).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setSortMode(opt)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                sortMode === opt
                  ? "bg-[var(--surface-strong)] font-semibold text-[var(--slate-800)] shadow-sm"
                  : "text-[var(--slate-600)] hover:text-[var(--slate-800)]"
              }`}
            >
              {opt === "saldo" ? "Mayor saldo" : "Más días"}
            </button>
          ))}
        </div>
        <select
          value={tower}
          onChange={(e) => setTower(e.target.value)}
          className="rounded-lg border border-[var(--slate-300)] bg-[var(--surface-strong)] px-2.5 py-1 text-xs text-[var(--slate-700)]"
        >
          <option value="all">Todas las torres</option>
          {towerOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-[var(--slate-200)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-[var(--slate-300)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--slate-600)]">
          <CheckCircle2 className="h-4 w-4 text-[#1D9E75]" aria-hidden />
          Sin unidades en mora
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold text-[var(--slate-900)]">{row.unitLabel}</p>
                <p className="text-[11px] text-[var(--slate-500)]">{row.days} días vencido</p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-sm font-semibold text-[#A32D2D]">{formatAmount(row.balance)}</span>
                <Link
                  href={`/admin/billing?unitId=${encodeURIComponent(row.id)}`}
                  className="text-[11px] text-[var(--brand-700)] hover:underline"
                >
                  Enviar aviso
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
