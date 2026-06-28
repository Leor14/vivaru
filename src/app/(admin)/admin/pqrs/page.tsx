"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, MessageSquareReply } from "lucide-react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { EmptyState } from "@/components/shared/empty-state";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { TablePager } from "@/components/shared/table-pager";
import { usePagination } from "@/components/shared/use-pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { resolveIdentityCell } from "@/lib/utils/identity";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { formatTicketDate, getTicketSla } from "@/features/pqrs/sla";
import { respondTicket, useTickets } from "@/features/pqrs/use-tickets";
import { useModuleVariant } from "@/lib/config/use-module-variant";
import type { Ticket } from "@/types/domain";
import { getStatusLabel } from "@/utils/statusMapper";

type AlertFilter = "all" | "green" | "yellow" | "red";
type SortOption = "due" | "oldest" | "newest";


const TICKET_TYPE_LABELS: Record<string, string> = {
  petition: "Petición",
  complaint: "Queja",
  claim: "Reclamo",
  suggestion: "Sugerencia",
  other: "General",
};

function getTicketTypeLabel(type?: string | null): string {
  if (!type) return "General";
  const key = type.trim().toLowerCase();
  return TICKET_TYPE_LABELS[key] ?? type;
}

const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Abierto",
  in_progress: "En proceso",
  responded: "Respondido",
  resolved: "Resuelto",
  closed: "Cerrado",
};

function getTicketStatusLabel(status: string): string {
  return TICKET_STATUS_LABELS[status] ?? getStatusLabel(status);
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "open":
      return "bg-amber-100 text-amber-700";
    case "in_progress":
      return "bg-sky-100 text-sky-700";
    case "responded":
      return "bg-indigo-100 text-indigo-700";
    case "resolved":
      return "bg-emerald-100 text-emerald-700";
    case "closed":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getDueBadge(params: { isClosed: boolean; businessDaysRemaining: number | null | undefined }) {
  if (params.isClosed) {
    return { label: "Cerrado", className: "bg-slate-100 text-slate-700" };
  }
  const remaining = params.businessDaysRemaining;
  if (remaining == null) {
    return { label: "Al día", className: "bg-emerald-100 text-emerald-700" };
  }
  if (remaining < 0) {
    return { label: "Vencido", className: "bg-rose-100 text-rose-700" };
  }
  if (remaining <= 5) {
    return { label: `${remaining} días`, className: "bg-amber-100 text-amber-700" };
  }
  return { label: "Al día", className: "bg-emerald-100 text-emerald-700" };
}

export default function AdminPqrsPage() {
  const { user } = useAuth();
  const { items, loading, error } = useTickets(user?.tenantId);
  const isSimpleMode = useModuleVariant(user?.tenantId, "pqrs") === "buzon_simple";

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [residentFilter, setResidentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("due");

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [responseText, setResponseText] = useState("");
  const [responseStatus, setResponseStatus] = useState<Ticket["status"]>("responded");
  const [savingResponse, setSavingResponse] = useState(false);

  const enrichedItems = useMemo(() => {
    return items.map((ticket) => {
      const unitLabel = ticket.unitLabel || "Sin unidad";
      const residentName = ticket.residentName || "Residente";
      const radicado = ticket.radicado || `PQRS-${ticket.id.slice(0, 8).toUpperCase()}`;
      const radicationDate = ticket.radicationDate || ticket.createdAt || ticket.updatedAt;
      const sla = getTicketSla({
        radicationDate,
        status: ticket.status,
        responseDate: ticket.respondedAt,
      });

      return {
        ...ticket,
        unitLabel,
        residentName,
        radicado,
        radicationDate,
        sla,
      };
    });
  }, [items]);

  const units = useMemo(
    () => Array.from(new Set(enrichedItems.map((item) => item.unitLabel))).sort((a, b) => a.localeCompare(b)),
    [enrichedItems],
  );

  const residents = useMemo(
    () => Array.from(new Set(enrichedItems.map((item) => item.residentName))).sort((a, b) => a.localeCompare(b)),
    [enrichedItems],
  );

  const types = useMemo(
    () => Array.from(new Set(enrichedItems.map((item) => item.type || "other"))).sort((a, b) => a.localeCompare(b)),
    [enrichedItems],
  );

  const selectedTicket = useMemo(
    () => enrichedItems.find((item) => item.id === selectedTicketId) ?? null,
    [enrichedItems, selectedTicketId],
  );

  useEffect(() => {
    if (!drawerOpen || !selectedTicket) return;

    setResponseStatus(selectedTicket.status === "closed" ? "closed" : "responded");
  }, [drawerOpen, selectedTicket]);

  // En modo buzón simple no hay semáforo ni tipos: orden por recientes y sin filtros de SLA/tipo.
  useEffect(() => {
    if (isSimpleMode) {
      setSortBy("newest");
      setTypeFilter("all");
      setAlertFilter("all");
    }
  }, [isSimpleMode]);

  const filteredItems = useMemo(() => {
    const filtered = enrichedItems.filter((ticket) => {
      const byStatus = statusFilter === "all" ? true : ticket.status === statusFilter;
      const byType = typeFilter === "all" ? true : (ticket.type || "other") === typeFilter;
      const byUnit = unitFilter === "all" ? true : ticket.unitLabel === unitFilter;
      const byResident = residentFilter === "all" ? true : ticket.residentName === residentFilter;

      const radication = ticket.radicationDate ? new Date(ticket.radicationDate) : null;
      const fromDate = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
      const toDate = dateTo ? new Date(`${dateTo}T23:59:59`) : null;

      const byDateFrom = fromDate && radication ? radication >= fromDate : true;
      const byDateTo = toDate && radication ? radication <= toDate : true;
      const byAlert = alertFilter === "all" ? true : ticket.sla.level === alertFilter;

      return byStatus && byType && byUnit && byResident && byDateFrom && byDateTo && byAlert;
    });

    if (sortBy === "oldest") {
      return filtered.sort((a, b) => new Date(a.radicationDate || 0).getTime() - new Date(b.radicationDate || 0).getTime());
    }

    if (sortBy === "newest") {
      return filtered.sort((a, b) => new Date(b.radicationDate || 0).getTime() - new Date(a.radicationDate || 0).getTime());
    }

    return filtered.sort((a, b) => {
      const aClosed = a.sla.isClosed;
      const bClosed = b.sla.isClosed;
      if (aClosed !== bClosed) return aClosed ? 1 : -1;

      const aRemaining = a.sla.businessDaysRemaining ?? 999;
      const bRemaining = b.sla.businessDaysRemaining ?? 999;
      if (aRemaining !== bRemaining) return aRemaining - bRemaining;

      return new Date(a.radicationDate || 0).getTime() - new Date(b.radicationDate || 0).getTime();
    });
  }, [enrichedItems, statusFilter, typeFilter, unitFilter, residentFilter, dateFrom, dateTo, alertFilter, sortBy]);

  const pager = usePagination(filteredItems);

  function openTicketDrawer(ticketId: string) {
    setSelectedTicketId(ticketId);
    setDrawerOpen(true);
    setResponseText("");
  }

  async function handleRespondTicket() {
    if (!selectedTicket || !user?.tenantId || !user?.uid) return;
    if (!responseText.trim()) {
      toast.error("Escribe una respuesta antes de guardar.");
      return;
    }

    try {
      setSavingResponse(true);
      await respondTicket({
        ticketId: selectedTicket.id,
        tenantId: user.tenantId,
        response: responseText,
        status: responseStatus,
        adminUserId: user.uid,
        adminUserName: user.fullName,
        previousHistory: selectedTicket.responseHistory,
      });
      setResponseText("");
      toast.success("Respuesta registrada correctamente.");
    } catch (responseError) {
      toastFirebaseError(responseError);
    } finally {
      setSavingResponse(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="min-w-0 flex-1">
        <CardTitle help={isSimpleMode ? "Buzón de mensajes de los residentes. Recibe y responde sin categorías ni semáforo de tiempo." : "Gestiona las peticiones, quejas, reclamos y sugerencias de los residentes con trazabilidad completa. Cada ticket tiene un plazo legal de 15 días hábiles — el módulo te alerta cuando estás próximo al límite para que ninguna solicitud quede sin atender."}>PQRS e incidencias</CardTitle>
        <CardDescription className="mt-1">
          {isSimpleMode
            ? "Recibe y responde los mensajes de los residentes."
            : "Recibe, responde y haz seguimiento a las solicitudes de los residentes, dentro del plazo de 15 días hábiles."}
        </CardDescription>

        {error ? <p className="mt-3 text-sm text-[var(--danger-700)]">{error}</p> : null}

        <div className="mt-4">
          <MobileFiltersPanel
            title="Filtros de tickets"
            collapsibleOnDesktop
            defaultOpen={false}
            activeFiltersCount={
              (statusFilter !== "all" ? 1 : 0) +
              (typeFilter !== "all" ? 1 : 0) +
              (unitFilter !== "all" ? 1 : 0) +
              (residentFilter !== "all" ? 1 : 0) +
              (dateFrom ? 1 : 0) +
              (dateTo ? 1 : 0) +
              (alertFilter !== "all" ? 1 : 0)
            }
            openLabel="Mostrar filtros"
            closeLabel="Ocultar filtros"
          >
            <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
              <label className="text-xs text-[var(--slate-600)]">
                Estado
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Todos</option>
                  <option value="open">Abierto</option>
                  <option value="in_progress">En proceso</option>
                  <option value="responded">Respondido</option>
                  <option value="resolved">Resuelto</option>
                  <option value="closed">Cerrado</option>
                </select>
              </label>

              {!isSimpleMode && (
                <label className="text-xs text-[var(--slate-600)]">
                  Tipo
                  <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    {types.map((type) => (
                      <option key={type} value={type}>{getTicketTypeLabel(type)}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-xs text-[var(--slate-600)]">
                Unidad
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                  <option value="all">Todas</option>
                  {units.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-[var(--slate-600)]">
                Residente
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={residentFilter} onChange={(event) => setResidentFilter(event.target.value)}>
                  <option value="all">Todos</option>
                  {residents.map((resident) => (
                    <option key={resident} value={resident}>{resident}</option>
                  ))}
                </select>
              </label>

              <Input type="date" label="Radicación desde" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <Input type="date" label="Radicación hasta" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />

              {!isSimpleMode && (
                <label className="text-xs text-[var(--slate-600)]">
                  Prioridad de respuesta
                  <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={alertFilter} onChange={(event) => setAlertFilter(event.target.value as AlertFilter)}>
                    <option value="all">Todas</option>
                    <option value="green">En plazo</option>
                    <option value="yellow">Próximo a vencer</option>
                    <option value="red">Crítico</option>
                  </select>
                </label>
              )}

              <label className="text-xs text-[var(--slate-600)]">
                Orden
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
                  {!isSimpleMode && <option value="due">Próximos a vencer</option>}
                  <option value="oldest">Más antiguos primero</option>
                  <option value="newest">Más recientes</option>
                </select>
              </label>
            </div>
          </MobileFiltersPanel>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-[var(--slate-200)]">
          <table className="w-full text-sm" style={{ minWidth: 700 }}>
            <thead className="bg-[var(--slate-100)] text-left text-[var(--slate-700)]">
              <tr>
                <th className="px-3 py-2">Asunto</th>
                <th className="px-3 py-2">Unidad / Residente</th>
                <th className="px-3 py-2">Estado</th>
                {!isSimpleMode && <th className="px-3 py-2">Vencimiento</th>}
                <th className="px-3 py-2 text-center">Acción</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-t border-[var(--slate-200)]">
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-3/4 rounded" />
                        <Skeleton className="mt-1.5 h-3 w-1/2 rounded" />
                      </td>
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-full rounded" />
                        <Skeleton className="mt-1.5 h-3 w-2/3 rounded" />
                      </td>
                      <td className="px-3 py-2">
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </td>
                      <td className="px-3 py-2">
                        <Skeleton className="h-5 w-16 rounded-full" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Skeleton className="mx-auto h-8 w-8 rounded-lg" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : null}

              {!loading && filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={isSimpleMode ? 4 : 5} className="px-3 py-4">
                    {enrichedItems.length === 0 ? (
                      <EmptyState title="Sin tickets" description="Cuando residentes creen solicitudes, aparecerán aquí para gestión operativa." />
                    ) : (
                      <EmptyState title="Sin resultados" description="Ningún ticket coincide con los filtros aplicados. Ajusta los criterios de búsqueda." />
                    )}
                  </td>
                </tr>
              ) : null}

              {pager.pageItems.map((ticket) => {
                const identity = resolveIdentityCell({ unitLabel: ticket.unitLabel, personName: ticket.residentName });
                const dueBadge = getDueBadge({
                  isClosed: ticket.sla.isClosed,
                  businessDaysRemaining: ticket.sla.businessDaysRemaining,
                });
                const isSelected = drawerOpen && selectedTicketId === ticket.id;
                return (
                  <tr
                    key={ticket.id}
                    className={`border-t border-[var(--slate-200)] align-top ${isSelected ? "bg-[var(--surface-soft)]" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <p className="pqrs-asunto truncate font-medium text-[var(--slate-900)]">{ticket.subject}</p>
                      <p className="mt-0.5 truncate text-[11px] text-[var(--slate-500)]">
                        {isSimpleMode ? formatTicketDate(ticket.radicationDate) : `${ticket.radicado} · ${formatTicketDate(ticket.radicationDate)}`}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <p className="truncate text-[var(--slate-900)]">{identity.primary}</p>
                      {identity.secondary ? (
                        <p className="mt-0.5 truncate text-[11px] text-[var(--slate-500)]">{identity.secondary}</p>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={ticket.status} context="pqrs" />
                    </td>
                    {!isSimpleMode && (
                      <td className="px-3 py-2">
                        <Badge className={dueBadge.className}>{dueBadge.label}</Badge>
                      </td>
                    )}
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        aria-label="Ver detalle"
                        onClick={() => openTicketDrawer(ticket.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--slate-200)] text-[var(--slate-600)] transition-colors hover:bg-[var(--surface-soft)] hover:border-[var(--slate-400)] hover:text-[var(--slate-900)]"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
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

        {!loading && (
          <p className="mt-2 text-right text-xs text-[var(--slate-500)]">
            {filteredItems.length} de {enrichedItems.length} registro{enrichedItems.length !== 1 ? "s" : ""}
          </p>
        )}
      </Card>

      <Drawer
        open={drawerOpen && Boolean(selectedTicket)}
        onClose={() => setDrawerOpen(false)}
        title={selectedTicket?.subject ?? "Detalle PQRS"}
        headerExtra={
          selectedTicket ? (
            <>
              <StatusBadge status={selectedTicket.status} context="pqrs" />
              {!isSimpleMode && <span className="text-xs text-[var(--slate-500)]">{selectedTicket.radicado}</span>}
            </>
          ) : null
        }
        footer={
          selectedTicket ? (
            <div className="space-y-3">
              <Textarea
                value={responseText}
                onChange={(event) => setResponseText(event.target.value)}
                placeholder="Escribe la respuesta administrativa"
                rows={3}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex-1 text-xs text-[var(--slate-700)]">
                  Estado
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--slate-300)] bg-white px-2 text-xs"
                    value={responseStatus}
                    onChange={(event) => setResponseStatus(event.target.value as Ticket["status"])}
                  >
                    <option value="open">Abierto</option>
                    <option value="in_progress">En proceso</option>
                    <option value="responded">Respondido</option>
                    <option value="resolved">Resuelto</option>
                    <option value="closed">Cerrado</option>
                  </select>
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
                    Cerrar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={savingResponse || !responseText.trim()}
                    onClick={() => void handleRespondTicket()}
                  >
                    <MessageSquareReply className="mr-2 h-4 w-4" />
                    {savingResponse ? "Guardando..." : "Responder"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null
        }
      >
        {selectedTicket ? (
          <div className="space-y-4 text-sm text-[var(--slate-800)]">
            <dl className="grid grid-cols-2 gap-3">
              {!isSimpleMode && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Radicado</dt>
                  <dd className="mt-0.5 text-[var(--slate-900)]">{selectedTicket.radicado}</dd>
                </div>
              )}
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Fecha</dt>
                <dd className="mt-0.5 text-[var(--slate-900)]">{formatTicketDate(selectedTicket.radicationDate)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Unidad / Residente</dt>
                <dd className="mt-0.5 text-[var(--slate-900)]">
                  {selectedTicket.residentName && <span className="block">{selectedTicket.residentName}</span>}
                  <span className="block text-[var(--slate-500)]">{selectedTicket.unitLabel || "\u2014"}</span>
                </dd>
              </div>
              {!isSimpleMode && (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Tipo</dt>
                  <dd className="mt-0.5 text-[var(--slate-900)]">{getTicketTypeLabel(selectedTicket.type)}</dd>
                </div>
              )}
              {!isSimpleMode && (
                <div className="col-span-2">
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Vencimiento</dt>
                  <dd className="mt-0.5">
                    {(() => {
                      const badge = getDueBadge({
                        isClosed: selectedTicket.sla.isClosed,
                        businessDaysRemaining: selectedTicket.sla.businessDaysRemaining,
                      });
                      return <Badge className={badge.className}>{badge.label}</Badge>;
                    })()}
                  </dd>
                </div>
              )}
            </dl>

            <div className="border-t border-[var(--slate-200)] pt-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Descripción</p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--slate-700)]">{selectedTicket.message || selectedTicket.subject}</p>
            </div>

            {(selectedTicket.responseHistory ?? []).length > 0 ? (
              <div className="border-t border-[var(--slate-200)] pt-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Historial de respuestas</p>
                <div className="mt-2 space-y-2">
                  {(selectedTicket.responseHistory ?? []).map((entry) => (
                    <div key={entry.id} className="rounded-lg bg-[var(--surface-soft)] p-2 text-[12px]">
                      <p className="font-medium text-[var(--slate-900)]">{entry.createdByName || entry.createdBy}</p>
                      <p className="text-[10px] text-[var(--slate-500)]">{formatTicketDate(entry.createdAt)}</p>
                      <p className="mt-1 text-[var(--slate-700)]">{entry.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
