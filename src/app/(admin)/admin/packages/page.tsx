"use client";

import { Filter, FilterX, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { TablePager } from "@/components/shared/table-pager";
import { usePagination } from "@/components/shared/use-pagination";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useAuth } from "@/features/auth/auth-context";
import { usePackages } from "@/features/packages/use-packages";
import { resolveIdentityCell } from "@/lib/utils/identity";
import { resolveUnitName } from "@/lib/utils/unit";
import { useDebounce } from "@/lib/utils/use-debounce";

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function formatDate(value: unknown) {
  const parsed = toDate(value);
  if (!parsed) return "-";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
}

function resolveGuardName(item: {
  receivedByGuardName?: string;
  registeredByName?: string;
  status: string;
}) {
  if (item.receivedByGuardName?.trim()) return item.receivedByGuardName;
  if (item.registeredByName?.trim()) return item.registeredByName;
  return item.status === "pending" ? "Guardia no registrado" : "No registrado";
}

export default function AdminPackagesPage() {
  const { user } = useAuth();
  const { items, loading } = usePackages(user?.tenantId);

  const [torreFilter, setTorreFilter] = useState<string>("all");
  const [nameQuery, setNameQuery] = useState("");
  const debouncedNameQuery = useDebounce(nameQuery.trim(), 200);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const torres = useMemo(() => {
    const set = new Set<string>();
    items.forEach((item) => {
      const torre = resolveUnitName(item.unitLabel || "").torre;
      if (torre) set.add(torre);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = debouncedNameQuery.toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return items.filter((item) => {
      const torre = resolveUnitName(item.unitLabel || "").torre;
      const torreOk = torreFilter === "all" ? true : torre === torreFilter;
      const name = (item.residentName || item.recipientName || "").toLowerCase();
      const reference = (item.reference || "").toLowerCase();
      const unitLabel = (item.unitLabel || "").toLowerCase();
      const nameOk = !query
        ? true
        : name.includes(query) || reference.includes(query) || unitLabel.includes(query);
      const arrived = toDate(item.arrivedAt);
      const arrivedMs = arrived?.getTime() ?? null;
      const fromOk = fromMs == null ? true : arrivedMs != null && arrivedMs >= fromMs;
      const toOk = toMs == null ? true : arrivedMs != null && arrivedMs <= toMs;
      return torreOk && nameOk && fromOk && toOk;
    });
  }, [items, torreFilter, debouncedNameQuery, dateFrom, dateTo]);

  const pager = usePagination(filteredItems);

  const activeFiltersCount =
    (torreFilter !== "all" ? 1 : 0) + (debouncedNameQuery ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  function clearFilters() {
    setTorreFilter("all");
    setNameQuery("");
    setDateFrom("");
    setDateTo("");
  }

  return (
    <Card>
      <CardTitle help="Registra la entrada de correspondencia y paquetes, y notifica al residente destinatario. Un control preciso reduce el riesgo de extravíos y da tranquilidad a quienes esperan sus entregas. El registro lo inicia el guardia desde su panel.">Correspondencia y paquetería</CardTitle>
      <CardDescription className="mt-1">
        Trazabilidad de paquetes recibidos por la portería. El registro de nuevos paquetes lo realiza el guardia desde su panel.
      </CardDescription>

      <div className="mt-4">
        <MobileFiltersPanel
          title="Filtros de paquetes"
          collapsibleOnDesktop
          defaultOpen={false}
          activeFiltersCount={activeFiltersCount}
          openLabel="Mostrar filtros"
          closeLabel="Ocultar filtros"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-[var(--slate-600)]">
                {activeFiltersCount > 0 ? `${activeFiltersCount} filtro(s) activo(s)` : "Sin filtros activos"}
              </p>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="inline-flex items-center gap-1"
                disabled={!hasActiveFilters}
                onClick={clearFilters}
              >
                <IconBadge tone="sand">
                  <FilterX className="h-3.5 w-3.5" />
                </IconBadge>
                Limpiar filtros
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            <label className="block text-xs text-[var(--slate-600)]">
              Buscar por nombre, referencia o unidad
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--slate-500)]" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Ej. Maria, PK-1010, T1-101..."
                  value={nameQuery}
                  onChange={(event) => setNameQuery(event.target.value)}
                  autoComplete="off"
                  className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white pl-9 pr-9 text-sm focus:border-[var(--brand-700)] focus:outline-none"
                  aria-label="Buscar paquetes"
                />
                {nameQuery ? (
                  <button
                    type="button"
                    onClick={() => setNameQuery("")}
                    aria-label="Limpiar busqueda"
                    className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-[var(--slate-500)] hover:bg-[var(--slate-100)] hover:text-[var(--slate-900)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-xs text-[var(--slate-600)]">
                Torre
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                  value={torreFilter}
                  onChange={(event) => setTorreFilter(event.target.value)}
                >
                  <option value="all">Todas</option>
                  {torres.map((torre) => (
                    <option key={torre} value={torre}>
                      {torre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-[var(--slate-600)]">
                Desde
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className="text-xs text-[var(--slate-600)]">
                Hasta
                <input
                  type="date"
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
            </div>
          </div>
        </MobileFiltersPanel>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-[var(--slate-600)]">
        <Filter className="h-3.5 w-3.5" />
        <span>
          Mostrando <strong className="text-[var(--slate-900)]">{filteredItems.length}</strong> de {items.length} paquetes
        </span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--slate-200)]">
        <table className="min-w-[680px] w-full text-sm">
          <thead className="bg-[var(--slate-100)] text-left text-[var(--slate-700)]">
            <tr>
              <th className="px-3 py-2 font-medium">Destinatario / Unidad</th>
              <th className="px-3 py-2 font-medium">Descripción</th>
              <th className="px-3 py-2 font-medium">Recibido por</th>
              <th className="px-3 py-2 font-medium">Fecha recepción</th>
              <th className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-[var(--slate-600)]">Cargando paquetería...</td>
              </tr>
            ) : null}
            {!loading && filteredItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4">
                  <EmptyState
                    title={hasActiveFilters ? "Sin resultados" : "Sin paquetes"}
                    description={
                      hasActiveFilters
                        ? "Ajusta los filtros para ver mas resultados."
                        : "No hay paquetes registrados para este tenant en este momento."
                    }
                  />
                </td>
              </tr>
            ) : null}
            {pager.pageItems.map((item) => {
              const identity = resolveIdentityCell({
                unitLabel: item.unitLabel,
                personName: item.residentName || item.recipientName,
              });
              return (
                <tr key={item.id} className="border-t border-[var(--slate-200)] align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-[var(--slate-900)]">{identity.primary}</p>
                    {identity.secondary ? (
                      <p className="mt-0.5 text-[11px] text-[var(--slate-500)]">{identity.secondary}</p>
                    ) : null}
                    <p className="mt-0.5 text-[11px] text-[var(--slate-500)]">{item.reference || `PK-${item.id.slice(0, 6).toUpperCase()}`}</p>
                  </td>
                  <td className="px-3 py-2 text-[var(--slate-700)]">{item.description?.trim() || "Sin descripción"}</td>
                  <td className="px-3 py-2 text-[var(--slate-700)]">{resolveGuardName(item)}</td>
                  <td className="px-3 py-2 text-[var(--slate-700)]">{formatDate(item.arrivedAt)}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={item.status} context="package" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pager.hasPagination ? (
        <TablePager
          page={pager.page}
          totalPages={pager.totalPages}
          total={pager.total}
          start={pager.start}
          pageSize={pager.pageSize}
          onPrev={pager.prev}
          onNext={pager.next}
          onPageSizeChange={pager.setPageSize}
        />
      ) : null}
    </Card>
  );
}
