"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Package } from "lucide-react";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { usePackagesBodegaSummary } from "@/features/packages/use-packages-bodega-summary";

type Props = { tenantId?: string };
type SortMode = "dias" | "reciente";

export function PackagesBodegaWidget({ tenantId }: Props) {
  const summary = usePackagesBodegaSummary(tenantId);
  const [towerFilter, setTowerFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("dias");

  const towerOptions = useMemo(
    () => Array.from(new Set(summary.items.map((i) => i.tower))).sort(),
    [summary.items],
  );

  const filtered = useMemo(() => {
    let list = summary.items;
    if (towerFilter !== "all") list = list.filter((i) => i.tower === towerFilter);
    list = [...list].sort((a, b) =>
      sortMode === "dias" ? b.daysInBodega - a.daysInBodega : a.daysInBodega - b.daysInBodega,
    );
    return list.slice(0, 4);
  }, [summary.items, towerFilter, sortMode]);

  return (
    <Card className="soft-panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label text-[var(--slate-500)]">Tiempo en bodega</p>
          <CardTitle className="mt-1 text-lg" help="Paquetes que aun no han sido recogidos por el residente, ordenados por tiempo en bodega. Un paquete con mas de 7 dias debe ser notificado al residente.">Paquetes pendientes de entrega</CardTitle>
          <CardDescription className="mt-1">
            Paquetes sin entregar al residente, ordenados por antigüedad.
          </CardDescription>
        </div>
        <Link href="/admin/packages" className="text-xs font-medium text-[var(--brand-700)] hover:underline">
          Ver paquetería →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 rounded-xl bg-[var(--slate-100)] p-1">
          <button
            type="button"
            onClick={() => setTowerFilter("all")}
            className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
              towerFilter === "all"
                ? "bg-[var(--surface-strong)] font-semibold text-[var(--slate-800)] shadow-sm"
                : "text-[var(--slate-600)] hover:text-[var(--slate-800)]"
            }`}
          >
            Todas
          </button>
          {towerOptions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTowerFilter(t)}
              className={`rounded-lg px-2.5 py-1 text-xs transition-colors ${
                towerFilter === t
                  ? "bg-[var(--surface-strong)] font-semibold text-[var(--slate-800)] shadow-sm"
                  : "text-[var(--slate-600)] hover:text-[var(--slate-800)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="inline-flex gap-1 rounded-xl bg-[var(--slate-100)] p-1">
          {(["dias", "reciente"] as SortMode[]).map((opt) => (
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
              {opt === "dias" ? "Más días" : "Recientes"}
            </button>
          ))}
        </div>
      </div>

      {summary.loading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded-xl bg-[var(--slate-200)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-[var(--slate-300)] bg-[var(--surface-soft)] p-4 text-sm text-[var(--slate-600)]">
          <Package className="h-4 w-4 text-[var(--slate-500)]" aria-hidden />
          Sin paquetes pendientes
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map((pkg) => {
            const crit = pkg.daysInBodega >= 7;
            return (
              <li
                key={pkg.id}
                className="flex items-center justify-between rounded-xl bg-[var(--surface-soft)] px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--slate-900)]">{pkg.name}</p>
                  <p className="truncate text-[11px] text-[var(--slate-500)]">{pkg.unitLabel}</p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-0.5">
                  <span className={`text-sm font-semibold ${crit ? "text-[var(--tinte-rojo-texto-1)]" : "text-[var(--tinte-ambar-texto-3)]"}`}>
                    {pkg.daysInBodega} días
                  </span>
                  <Link
                    href={`/admin/packages?packageId=${encodeURIComponent(pkg.id)}`}
                    className="text-[11px] text-[var(--brand-700)] hover:underline"
                  >
                    Notificar
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {summary.error ? (
        <p className="mt-2 text-xs text-[var(--danger-700)]">No pudimos cargar los paquetes pendientes.</p>
      ) : null}
    </Card>
  );
}
