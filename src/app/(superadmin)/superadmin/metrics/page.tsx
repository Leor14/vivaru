"use client";

import { useEffect, useMemo, useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAllTenantsMetrics } from "@/features/superadmin/metrics/services";
import type { TenantAdoptionMetrics } from "@/features/superadmin/metrics/types";

const STATUS_BADGE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  trial: "bg-slate-100 text-slate-700",
  suspended: "bg-red-100 text-red-800",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Activo",
  trial: "Trial",
  suspended: "Suspendido",
};

const ADOPTION_BADGE: Record<string, string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-red-100 text-red-800",
};

const ADOPTION_LABEL: Record<string, string> = {
  high: "Alto",
  medium: "Medio",
  low: "Bajo",
};

const columns: DataTableColumn<TenantAdoptionMetrics>[] = [
  {
    key: "tenant",
    header: "Tenant",
    render: (row) => (
      <div>
        <p className="font-medium text-[var(--slate-900)]">{row.tenantName}</p>
        <Badge className={STATUS_BADGE[row.status] ?? ""}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
      </div>
    ),
  },
  {
    key: "plan",
    header: "Plan",
    mobileHidden: true,
    render: (row) => row.planId ?? "—",
  },
  {
    key: "units",
    header: "Unidades",
    mobileHidden: true,
    render: (row) => row.units,
  },
  {
    key: "activeResidents",
    header: "Residentes activos",
    mobileHidden: true,
    render: (row) => row.activeResidents,
  },
  {
    key: "openTickets",
    header: "Tickets abiertos",
    mobileHidden: true,
    render: (row) => row.openTickets,
  },
  {
    key: "ticketsLast30d",
    header: "Tickets 30d",
    mobileHidden: true,
    render: (row) => row.ticketsLast30d,
  },
  {
    key: "visitsLast30d",
    header: "Visitas 30d",
    mobileHidden: true,
    render: (row) => row.visitsLast30d,
  },
  {
    key: "billingsLast30d",
    header: "Pagos 30d",
    mobileHidden: true,
    render: (row) => row.billingsLast30d,
  },
  {
    key: "packagesLast30d",
    header: "Paquetes 30d*",
    mobileHidden: true,
    render: (row) => row.packagesLast30d,
  },
  {
    key: "score",
    header: "Score",
    render: (row) => (
      <Badge className={ADOPTION_BADGE[row.adoptionLevel] ?? ""}>
        {ADOPTION_LABEL[row.adoptionLevel]} {row.adoptionScore}%
      </Badge>
    ),
  },
];

export default function SuperadminMetricsPage() {
  const [metrics, setMetrics] = useState<TenantAdoptionMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  function loadMetrics() {
    setLoading(true);
    setError(null);
    fetchAllTenantsMetrics()
      .then((data) => {
        setMetrics(data);
        setLastFetched(new Date());
      })
      .catch(() => {
        setError("No se pudieron cargar las métricas. Verifica tu conexión e intenta de nuevo.");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = useMemo(
    () => ({
      totalTenants: metrics.length,
      activeTenants: metrics.filter((m) => m.status === "active").length,
      totalOpenTickets: metrics.reduce((sum, m) => sum + m.openTickets, 0),
      highAdoptionCount: metrics.filter((m) => m.adoptionLevel === "high").length,
    }),
    [metrics],
  );

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Métricas de Adopción</CardTitle>
            <CardDescription className="mt-1">
              Health check de adopción por tenant — cargado bajo demanda.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {lastFetched && !loading && (
              <span className="text-sm text-[var(--slate-500)]">
                Actualizado {lastFetched.toLocaleTimeString("es-CO")}
              </span>
            )}
            <Button onClick={loadMetrics} disabled={loading} size="sm">
              {loading ? "Cargando…" : "Actualizar"}
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-[var(--slate-200)] p-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-2 h-6 w-10" />
              </div>
            ))
          ) : (
            <>
              <div className="rounded-xl border border-[var(--slate-200)] p-3">
                <p className="text-xs uppercase text-[var(--slate-500)]">Total tenants</p>
                <p className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{summary.totalTenants}</p>
              </div>
              <div className="rounded-xl border border-[var(--slate-200)] p-3">
                <p className="text-xs uppercase text-[var(--slate-500)]">Tenants activos</p>
                <p className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{summary.activeTenants}</p>
              </div>
              <div className="rounded-xl border border-[var(--slate-200)] p-3">
                <p className="text-xs uppercase text-[var(--slate-500)]">Tickets abiertos</p>
                <p className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{summary.totalOpenTickets}</p>
              </div>
              <div className="rounded-xl border border-[var(--slate-200)] p-3">
                <p className="text-xs uppercase text-[var(--slate-500)]">Adopción alta</p>
                <p className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{summary.highAdoptionCount}</p>
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && !loading && (
          <p className="mt-3 text-sm text-[var(--danger-700)]">{error}</p>
        )}

        {/* Table */}
        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={columns}
              rows={metrics}
              getRowKey={(row) => row.tenantId}
              loading={false}
              emptyText="No hay tenants registrados."
              errorText={error}
              tableMinWidthClassName="min-w-[900px]"
            />
          )}
        </div>

        {/* Footnote */}
        {!loading && metrics.length > 0 && (
          <p className="mt-2 text-xs text-[var(--slate-500)]">
            * Paquetes 30d excluye registros sin fecha de llegada. Tickets 30d basado en fecha de última actualización.
          </p>
        )}
      </Card>
    </section>
  );
}
