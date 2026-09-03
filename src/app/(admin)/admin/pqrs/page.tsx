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
import { AsistenteTicket } from "@/features/pqrs/asistente-ticket";
import { FeatureGate } from "@/components/shared/feature-gate";
import { formatTicketDate, getTicketSla } from "@/features/pqrs/sla";
import { getTicketTypeLabel } from "@/features/pqrs/ticket-status";
import { useFeedbackAsistencia } from "@/features/pqrs/use-feedback-asistencia";
import { respondTicket, updateTicketClassification, useTickets } from "@/features/pqrs/use-tickets";
import { useModuleVariant } from "@/lib/config/use-module-variant";
import type { Ticket } from "@/types/domain";
import { getStatusLabel } from "@/utils/statusMapper";

type AlertFilter = "all" | "green" | "yellow" | "red";
type SortOption = "due" | "oldest" | "newest";


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
      return "bg-[var(--amber-100)] text-[var(--amber-800)]";
    case "in_progress":
      return "bg-[var(--info-100)] text-[var(--info-700)]";
    case "responded":
      return "bg-[var(--categoria-indigo-100)] text-[var(--categoria-indigo-700)]";
    case "resolved":
      return "bg-[var(--success-100)] text-[var(--success-700)]";
    case "closed":
      return "bg-[var(--slate-100)] text-[var(--slate-700)]";
    default:
      return "bg-[var(--slate-100)] text-[var(--slate-700)]";
  }
}

function getDueBadge(params: { isClosed: boolean; businessDaysRemaining: number | null | undefined }) {
  if (params.isClosed) {
    return { label: "Cerrado", className: "bg-[var(--slate-100)] text-[var(--slate-700)]" };
  }
  const remaining = params.businessDaysRemaining;
  if (remaining == null) {
    return { label: "Al día", className: "bg-[var(--success-100)] text-[var(--success-700)]" };
  }
  if (remaining < 0) {
    return { label: "Vencido", className: "bg-[var(--danger-100)] text-[var(--danger-700)]" };
  }
  if (remaining <= 5) {
    return { label: `${remaining} días`, className: "bg-[var(--amber-100)] text-[var(--amber-800)]" };
  }
  return { label: "Al día", className: "bg-[var(--success-100)] text-[var(--success-700)]" };
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

  // Clasificación editable — Fase 3 de PRD-VAI-FEAT-002. Hasta ahora el
  // administrador no podía tocar ninguno de los tres ejes: `category` nacía
  // constante, `type` lo fijaba el residente y `priority` no se escribía nunca.
  const [clasCategory, setClasCategory] = useState<Ticket["category"]>("pqrs");
  const [clasType, setClasType] = useState<NonNullable<Ticket["type"]>>("other");
  // `""` es «sin prioridad», y es un estado REAL, no un hueco del formulario:
  // los tickets de PQRS nacen sin prioridad. El tipo anterior no podía decirlo
  // (`NonNullable`, arrancaba en «medium»), y en la sesión de F3 ese default se
  // guardó 3 de 7 veces como si una persona lo hubiera decidido.
  const [clasPriority, setClasPriority] = useState<NonNullable<Ticket["priority"]> | "">("");
  const [savingClasificacion, setSavingClasificacion] = useState(false);

  /**
   * Medición de la sesión de F3. Vive en la página y no en el panel porque los
   * dos guardados que más importan —la clasificación y la respuesta— ocurren
   * fuera de él: el panel solo propone.
   */
  const feedbackIa = useFeedbackAsistencia();

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
    // Los selectores arrancan en lo que el ticket ya tiene, no en una sugerencia.
    // `priority` no existe en los tickets creados hasta hoy, y eso se ENSEÑA:
    // el selector arranca en «Sin prioridad» y guardar así no escribe el campo.
    // Arrancar en «medium» era la trampa medida en la sesión de F3 — un default
    // con apariencia de decisión, la misma familia que el `type: "petition"`.
    setClasCategory(selectedTicket.category ?? "pqrs");
    setClasType(selectedTicket.type ?? "other");
    setClasPriority(selectedTicket.priority ?? "");
  }, [drawerOpen, selectedTicket]);

  // Cambiar de ticket cierra la fila del anterior y abre otra. Sin esto, lo que
  // se guarde en un caso quedaría anotado junto a la sugerencia de otro.
  useEffect(() => {
    feedbackIa.reiniciar();
    // Solo el ticket: `feedbackIa` es estable y añadirlo dispararía el reinicio
    // en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTicketId]);

  /**
   * Cerrar el drawer manda la fila.
   *
   * **Lo encontró el ensayo a ciegas, y era la mitad de la medición.** El envío
   * vivía solo en el desmontaje de la pantalla, al cambiar de ticket y al
   * ocultarse la pestaña; ninguno de los tres ocurre cuando alguien analiza un
   * ticket, cierra el panel y se queda donde está — que es exactamente lo que
   * hace un administrador en una sesión guiada. De once asistencias reales llegó
   * UNA fila. Cerrar el drawer es el momento en que la persona terminó con ese
   * ticket, así que es cuando hay algo que contar.
   *
   * Mandar de más no cuesta: el `sesionId` hace que el servidor funda los envíos
   * en una sola fila en vez de duplicarla.
   */
  useEffect(() => {
    if (!drawerOpen) feedbackIa.enviar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

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

  /**
   * Guarda la clasificación que dejó la persona en los selectores.
   *
   * La IA nunca llama a esto: solo puede rellenar los selectores, y quien pulsa
   * guardar es un administrador mirando lo que va a escribir.
   */
  async function handleSaveClasificacion() {
    if (!selectedTicket || !user?.tenantId || !user?.uid) return;

    try {
      setSavingClasificacion(true);
      // `""` → `null`: «sin prioridad» no se escribe en el ticket y el feedback
      // registra que este eje no se decidió. Es la diferencia entre medir una
      // corrección y fabricarla.
      const prioridadElegida = clasPriority === "" ? null : clasPriority;
      await updateTicketClassification({
        ticketId: selectedTicket.id,
        tenantId: user.tenantId,
        adminUserId: user.uid,
        category: clasCategory,
        type: clasType,
        priority: prioridadElegida,
      });
      // La «decisión real del administrador» de la que hablan las dos puertas de
      // G7. Se anota DESPUÉS de que la escritura haya ido bien: una clasificación
      // que falló al guardar no es una decisión, es un error.
      feedbackIa.anotarClasificacionGuardada({
        category: clasCategory,
        type: clasType,
        priority: prioridadElegida,
      });
      toast.success("Clasificación actualizada.");
    } catch (clasError) {
      toastFirebaseError(clasError);
    } finally {
      setSavingClasificacion(false);
    }
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
      // Con el texto ANTES de limpiarlo: es lo que hay que comparar con el
      // borrador que propuso el modelo para saber cuánto se cambió.
      feedbackIa.anotarRespuestaGuardada(responseText);
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
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
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
                  <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                    <option value="all">Todos</option>
                    {types.map((type) => (
                      <option key={type} value={type}>{getTicketTypeLabel(type)}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-xs text-[var(--slate-600)]">
                Unidad
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                  <option value="all">Todas</option>
                  {units.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-[var(--slate-600)]">
                Residente
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" value={residentFilter} onChange={(event) => setResidentFilter(event.target.value)}>
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
                  <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" value={alertFilter} onChange={(event) => setAlertFilter(event.target.value as AlertFilter)}>
                    <option value="all">Todas</option>
                    <option value="green">En plazo</option>
                    <option value="yellow">Próximo a vencer</option>
                    <option value="red">Crítico</option>
                  </select>
                </label>
              )}

              <label className="text-xs text-[var(--slate-600)]">
                Orden
                <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
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
                        <Skeleton className="h-4 w-3/4 rounded-sm" />
                        <Skeleton className="mt-1.5 h-3 w-1/2 rounded-sm" />
                      </td>
                      <td className="px-3 py-2">
                        <Skeleton className="h-4 w-full rounded-sm" />
                        <Skeleton className="mt-1.5 h-3 w-2/3 rounded-sm" />
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
                      {/* El asunto es la frase que escribio el residente y se enseña como la
                          escribio. Llevaba `capitalize`, que en español pone mayuscula a
                          CADA palabra: en pantalla se leia «Sobre El Cajon De T3-63» y
                          «Por Que Se Esta Pagando Dos Veces El Concepto De Basura». */}
                      <p className="truncate font-medium text-[var(--slate-900)]">{ticket.subject}</p>
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
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--slate-300)] bg-[var(--surface-strong)] px-2 text-xs"
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
              {/*
                El «Tipo» de solo lectura que vivía aquí lo sustituye el editor
                de clasificación de más abajo: enseñarlo en los dos sitios haría
                que el mismo campo apareciera dos veces, uno editable y otro no.
              */}
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

            {/*
              Clasificación editable — Fase 3 de PRD-VAI-FEAT-002.

              Va en el cuerpo del drawer, con el estilo normal de Vivaru y NO
              dentro del panel morado: son los campos confirmados del ticket, y
              la PRD §5 pide que se distingan de lo que propuso una máquina.

              En buzón simple no aparece, igual que el resto de la pantalla: esa
              variante opera sin categorías, y ahí el asistente tampoco clasifica.
            */}
            {!isSimpleMode && (
              <div className="border-t border-[var(--slate-200)] pt-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Clasificación</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="text-xs text-[var(--slate-700)]">
                    Categoría
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-[var(--slate-300)] bg-[var(--surface-strong)] px-2 text-xs"
                      value={clasCategory}
                      onChange={(event) => setClasCategory(event.target.value as Ticket["category"])}
                    >
                      <option value="pqrs">PQRS</option>
                      <option value="maintenance">Mantenimiento</option>
                      <option value="billing">Cartera</option>
                    </select>
                  </label>
                  <label className="text-xs text-[var(--slate-700)]">
                    Tipo
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-[var(--slate-300)] bg-[var(--surface-strong)] px-2 text-xs"
                      value={clasType}
                      onChange={(event) => setClasType(event.target.value as NonNullable<Ticket["type"]>)}
                    >
                      <option value="petition">Petición</option>
                      <option value="complaint">Queja</option>
                      <option value="claim">Reclamo</option>
                      <option value="suggestion">Sugerencia</option>
                      <option value="other">General</option>
                    </select>
                  </label>
                  <label className="text-xs text-[var(--slate-700)]">
                    Prioridad
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-[var(--slate-300)] bg-[var(--surface-strong)] px-2 text-xs"
                      value={clasPriority}
                      onChange={(event) => setClasPriority(event.target.value as NonNullable<Ticket["priority"]> | "")}
                    >
                      {/*
                        La opción vacía existe solo mientras el ticket no tenga
                        prioridad: es el estado real del que se parte, no un
                        valor al que volver. Una vez escrita, quitarla no es una
                        operación del producto — puerta de un solo sentido.
                      */}
                      {!selectedTicket.priority ? <option value="">Sin prioridad</option> : null}
                      <option value="low">Baja</option>
                      <option value="medium">Media</option>
                      <option value="high">Alta</option>
                    </select>
                  </label>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={savingClasificacion}
                    onClick={() => void handleSaveClasificacion()}
                  >
                    {savingClasificacion ? "Guardando..." : "Guardar clasificación"}
                  </Button>
                  {!selectedTicket.priority ? (
                    <span className="text-[11px] text-[var(--slate-500)]">
                      Este ticket todavía no tiene prioridad asignada.
                    </span>
                  ) : null}
                </div>
              </div>
            )}

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

            {/*
              El asistente va al FINAL del cuerpo y plegado: después de que la
              persona haya leído el caso y su historial, y justo encima del pie
              donde se responde. Quien no lo abra ve el drawer de siempre con una
              línea más.

              Ninguna de sus dos acciones escribe nada: «usar esta clasificación»
              rellena los selectores de arriba y «copiar al cuadro de respuesta»
              llena el textarea del pie. Guardar y responder siguen siendo actos
              de la persona, con su propio botón.

              Y va detrás de SU bandera, que es lo que su ficha del catálogo dice
              que hace («muestra al administrador la categoría y el resumen
              propuestos») y hasta el 17 de agosto de 2026 no hacía: la clave
              `ai-pqrs-suggestions` no aparecía en un solo sitio de `src/` fuera
              del propio catálogo, así que el panel se pintaba siempre. Se vio al
              preparar la promoción a producción, donde `asistirTicketPqrs` no
              está desplegada: un administrador habría encontrado un panel de IA
              que revienta al pulsarlo.

              Apagada, el drawer queda exactamente como antes de la Fase 3 — el
              editor de clasificación y el pie de respuesta siguen enteros,
              porque no son de IA. Es lo que la PRD llama «rollback: apagar la
              bandera, sin migración».

              Y esto es presentación, no candado: el servidor ya lo comprueba en
              `runGateway`. La sombra de la Fase 4 NO mira esta bandera a
              propósito — clasifica en silencio con `ai-pqrs-shadow`, que es lo
              que permite tener sombra global sin sugerencia visible.
            */}
            <FeatureGate flag="ai-pqrs-suggestions">
              <div className="border-t border-[var(--slate-200)] pt-3">
                <AsistenteTicket
                  // Al cambiar de ticket se monta un panel nuevo: sin la clave, la
                  // propuesta del ticket anterior seguiría en pantalla sobre un
                  // caso distinto, que es la peor forma de equivocarse aquí.
                  key={selectedTicket.id}
                  ticketId={selectedTicket.id}
                  onAplicarClasificacion={(clasificacion) => {
                    setClasCategory(clasificacion.category);
                    setClasType(clasificacion.type);
                    setClasPriority(clasificacion.priority);
                  }}
                  onUsarBorrador={(texto) => setResponseText(texto)}
                  feedback={feedbackIa}
                />
              </div>
            </FeatureGate>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
