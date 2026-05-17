"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useRegulationComplianceSummary } from "@/features/regulations/use-regulation-compliance-summary";

type Props = {
  tenantId?: string;
  totalUnits?: number;
};

export function RegulationComplianceWidget({ tenantId, totalUnits }: Props) {
  const summary = useRegulationComplianceSummary(tenantId, totalUnits);
  const [towerFilter, setTowerFilter] = useState<string>("all");

  const towerOptions = useMemo(
    () => ["all", ...summary.byTower.map((t) => t.tower)],
    [summary.byTower],
  );

  const filtered = useMemo(() => {
    if (towerFilter === "all") {
      return { signed: summary.signed, total: summary.total, pct: summary.pct, pending: summary.pending };
    }
    const t = summary.byTower.find((row) => row.tower === towerFilter);
    if (!t) return { signed: 0, total: 0, pct: 0, pending: 0 };
    return { signed: t.signed, total: t.total, pct: t.pct, pending: Math.max(t.total - t.signed, 0) };
  }, [summary, towerFilter]);

  return (
    <Card className="soft-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label text-[var(--slate-500)]">Firma del reglamento</p>
          <CardTitle className="mt-1 text-lg" help="Porcentaje de unidades del conjunto que han firmado digitalmente el reglamento activo. Las torres en rojo tienen firma pendiente.">Cumplimiento por torre</CardTitle>
          <CardDescription className="mt-1">
            Avance de residentes que han firmado el reglamento activo.
          </CardDescription>
        </div>
        <Link
          href="/admin/regulations"
          className="text-xs font-medium text-[var(--brand-700)] hover:underline"
        >
          Ver pendientes →
        </Link>
      </div>

      {summary.loading ? (
        <div className="mt-4 space-y-3">
          <div className="h-6 w-32 animate-pulse rounded bg-[var(--slate-200)]" />
          <div className="h-2 w-full animate-pulse rounded bg-[var(--slate-200)]" />
        </div>
      ) : !summary.activeRegulationId ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--slate-300)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--slate-600)]">
          Sin reglamento activo configurado.
        </p>
      ) : (
        <>
          {towerOptions.length > 1 ? (
            <div className="mt-3 inline-flex gap-1 rounded-xl bg-[var(--slate-100)] p-1">
              {towerOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTowerFilter(opt)}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                    towerFilter === opt
                      ? "bg-white font-semibold text-[var(--slate-800)] shadow-sm"
                      : "text-[var(--slate-600)] hover:text-[var(--slate-800)]"
                  }`}
                >
                  {opt === "all" ? "Todas" : opt}
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-[var(--slate-900)]">{filtered.signed}</span>
            <span className="text-sm text-[var(--slate-600)]">
              de {filtered.total} unidades firmaron
            </span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--slate-200)]">
            <div
              className="h-full rounded-full bg-[#1D9E75] transition-[width] duration-500"
              style={{ width: `${Math.min(filtered.pct, 100)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-[var(--slate-600)]">
            <span>{filtered.pct}% completado</span>
            <span>{filtered.pending} pendientes</span>
          </div>

          {towerFilter === "all" && summary.byTower.length > 1 ? (
            <div className="mt-4 space-y-2 border-t border-[var(--slate-200)] pt-3">
              {summary.byTower.map((row) => (
                <div key={row.tower} className="flex items-center gap-2.5">
                  <span className="w-16 shrink-0 text-xs text-[var(--slate-600)]">{row.tower}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--slate-200)]">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${Math.min(row.pct, 100)}%`,
                        background: row.pct >= 70 ? "#1D9E75" : row.pct >= 40 ? "#EF9F27" : "#E24B4A",
                      }}
                    />
                  </div>
                  <span className="w-9 shrink-0 text-right text-xs text-[var(--slate-600)]">{row.pct}%</span>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      {summary.error ? (
        <p className="mt-3 text-xs text-[var(--danger-700)]">No pudimos cargar el cumplimiento del reglamento.</p>
      ) : null}
    </Card>
  );
}
