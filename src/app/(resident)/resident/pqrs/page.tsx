"use client";

import { Tabs } from "@/components/ui/tabs";
import { useTabParam } from "@/lib/navigation/use-tab-param";
import { useState } from "react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { createTicket, useTickets } from "@/features/pqrs/use-tickets";
import { useModuleVariant } from "@/lib/config/use-module-variant";
import { getTicketTypeLabel, TICKET_TYPE_LABELS } from "@/features/pqrs/ticket-status";
import type { Ticket } from "@/types/domain";

// ─── Constants ────────────────────────────────────────────────────────────────

// Definiciones canónicas: datasets/pqrs/taxonomia.md (eje 2). El eje es de QUIÉN
// o de QUÉ se queja —persona (queja) contra servicio (reclamo)—, no la severidad.
// **Los rótulos salen del mapa único; aquí viven solo las descripciones.** Este fichero tenía
// DOS copias del mapa de tipos —esta y `TYPE_LABELS`, abajo— y coincidían por casualidad: eran
// el mismo mecanismo que hacía que un ticket `other` se llamara «Otros» en el panel y «General»
// en PQRS. Las descripciones sí son de esta pantalla y no de las otras, así que se quedan.
const TICKET_TYPES = [
  { value: "petition",   description: "Pides información, un documento o que se haga algo" },
  { value: "complaint",  description: "Inconformidad con la conducta de una persona" },
  { value: "claim",      description: "Inconformidad con un servicio que falló o no se cumplió" },
  { value: "suggestion", description: "Propones una mejora, sin reportar una falla" },
  { value: "other",      description: "No encaja en las anteriores" },
] as const;

type TicketTypeValue = typeof TICKET_TYPES[number]["value"];

const STATUS_CONFIG: Record<Ticket["status"], { label: string; badgeCls: string }> = {
  open:        { label: "Abierto",     badgeCls: "bg-[var(--amber-100)] text-[var(--amber-700)]" },
  in_progress: { label: "En proceso",  badgeCls: "bg-[var(--info-100)] text-[var(--info-700)]" },
  responded:   { label: "Respondido",  badgeCls: "bg-[var(--categoria-indigo-100)] text-[var(--categoria-indigo-700)]" },
  resolved:    { label: "Resuelto",    badgeCls: "bg-[var(--success-100)] text-[var(--success-700)]" },
  closed:      { label: "Cerrado",     badgeCls: "bg-[var(--slate-100)] text-[var(--slate-600)]" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

// ─── TicketRow ────────────────────────────────────────────────────────────────

function TicketRow({ ticket, simple = false }: { ticket: Ticket; simple?: boolean }) {
  const statusCfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
  const typeLabel = getTicketTypeLabel(ticket.type);
  const date = formatDate(ticket.createdAt ?? ticket.updatedAt);

  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-3 space-y-2">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="flex-1 min-w-0 truncate text-sm font-medium text-[var(--slate-900)]">
          {ticket.subject}
        </p>
        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusCfg.badgeCls}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--slate-500)]">
        {!simple && (
          <span className="rounded-md bg-[var(--slate-100)] px-1.5 py-0.5 font-medium text-[var(--slate-700)]">
            {typeLabel}
          </span>
        )}
        {date && <span>{date}</span>}
        {!simple && ticket.radicado && (
          <span className="font-mono text-[var(--slate-400)]">#{ticket.radicado}</span>
        )}
      </div>

      {/* Respuesta de la administración */}
      {ticket.response && (
        <div className="rounded-lg border border-[var(--slate-100)] bg-[var(--slate-50)] px-3 py-2">
          <p className="mb-1 text-xs font-medium text-[var(--slate-500)]">Respuesta de la administración</p>
          <p className="text-xs text-[var(--slate-700)]">{ticket.response}</p>
          {ticket.respondedAt && (
            <p className="mt-1 text-[10px] text-[var(--slate-400)]">{formatDate(ticket.respondedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/** Nivel de módulo: la lista de claves tiene que ser estable entre renders. */
const SECCIONES = [
  { key: "mis-pqrs", label: "Mis PQRS" },
  { key: "nueva", label: "Nueva solicitud" },
] as const;
const CLAVES_SECCION = SECCIONES.map((seccion) => seccion.key);

export default function ResidentPqrsPage() {
  const { user } = useAuth();
  const { items, loading } = useTickets(user?.tenantId, user?.unitId);
  const isSimpleMode = useModuleVariant(user?.tenantId, "pqrs") === "buzon_simple";

  // La pestaña vive en la URL (`?vista=`): así se puede enlazar «Nueva
  // solicitud» y el botón «atrás» vuelve a la lista en vez de salir.
  const [tab, setTab] = useTabParam("vista", CLAVES_SECCION, "mis-pqrs");
  const [ticketType, setTicketType] = useState<TicketTypeValue>("petition");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = subject.trim().length > 0 && !submitting;

  async function handleCreateTicket() {
    if (!user?.tenantId || !canSubmit) return;
    setSubmitting(true);
    try {
      await createTicket({
        tenantId: user.tenantId,
        userId: user.uid,
        unitId: user.unitId,
        unitLabel: user.unitLabel ?? "Unidad no definida",
        subject: subject.trim(),
        message: message.trim() || subject.trim(),
        residentName: user.fullName,
        // En buzon_simple el tipo no aplica y el selector está oculto: sin él,
        // createTicket escribe "other" en vez de un "petition" que nadie eligió.
        type: isSimpleMode ? undefined : ticketType,
      });
      setSubject("");
      setMessage("");
      setTicketType("petition");
      toast.success("Solicitud enviada. La administración responderá pronto.");
      setTab("mis-pqrs");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSubmitting(false);
    }
  }

  const activeItems = items.filter((t) => t.status !== "closed" && t.status !== "resolved");
  const closedItems = items.filter((t) => t.status === "closed"  || t.status === "resolved");

  return (
    <Card>
      <CardTitle>PQRS</CardTitle>
      <CardDescription className="mt-1">
        {isSimpleMode
          ? "Envía un mensaje a la administración del edificio y recibe su respuesta."
          : "Peticiones, quejas, reclamos y sugerencias a la administración del edificio."}
      </CardDescription>

      {/* ── Tabs ── */}
      <Tabs
        items={SECCIONES.map((s) =>
          // El contador de pendientes viaja en la etiqueta, como estaba.
          s.key === "mis-pqrs" && activeItems.length > 0
            ? { ...s, label: `${s.label} (${activeItems.length})` }
            : s,
        )}
        value={tab}
        onChange={setTab}
        ariaLabel="Secciones PQRS"
        variant="pill"
        className="mt-4"
      />

      {/* ── Tab: Nueva ── */}
      {tab === "nueva" && (
        <div className="mt-4 space-y-3">
          {/* Tipo */}
          {!isSimpleMode && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">
                Tipo de solicitud
              </p>
              <p className="mb-2 text-xs text-[var(--slate-500)]">
                Si reportas algo que ya salió mal, elige Queja o Reclamo aunque además
                pidas que lo arreglen.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TICKET_TYPES.map((t) => {
                  const selected = ticketType === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setTicketType(t.value)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                        selected
                          ? "border-[var(--brand-700)] bg-[var(--brand-50)]"
                          : "border-[var(--slate-200)] hover:bg-[var(--slate-100)]"
                      }`}
                    >
                      <span className={`block font-semibold ${selected ? "text-[var(--brand-700)]" : "text-[var(--slate-800)]"}`}>
                        {TICKET_TYPE_LABELS[t.value]}
                      </span>
                      <span className={`mt-0.5 block ${selected ? "text-[var(--brand-700)]" : "text-[var(--slate-500)]"}`}>
                        {t.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Asunto */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--slate-600)]" htmlFor="pqrs-subject">
              Asunto <span className="text-[var(--danger-500)]">*</span>
            </label>
            <Input
              id="pqrs-subject"
              placeholder="Ej: Daño en la iluminación del parqueadero"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--slate-600)]" htmlFor="pqrs-message">
              Descripción <span className="text-[var(--slate-400)] font-normal">(opcional)</span>
            </label>
            <Textarea
              id="pqrs-message"
              placeholder="Añade detalles: cuándo ocurrió, dónde, qué esperas como resolución..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <Button onClick={() => void handleCreateTicket()} disabled={!canSubmit}>
            {submitting ? "Enviando..." : "Enviar solicitud"}
          </Button>
        </div>
      )}

      {/* ── Tab: Mis PQRS ── */}
      {tab === "mis-pqrs" && (
        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-strong)] p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Skeleton className="h-5 w-48 rounded-sm" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-16 rounded-md" />
                    <Skeleton className="h-4 w-24 rounded-sm" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="space-y-3">
              <EmptyState
                title="Sin solicitudes"
                description="No has enviado ninguna PQRS todavía."
              />
              <div className="text-center">
                <Button size="sm" onClick={() => setTab("nueva")}>
                  Crear primera solicitud
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {activeItems.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">
                    En curso ({activeItems.length})
                  </p>
                  <div className="space-y-2">
                    {activeItems.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} simple={isSimpleMode} />)}
                  </div>
                </div>
              )}
              {closedItems.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">
                    Resueltas ({closedItems.length})
                  </p>
                  <div className="space-y-2">
                    {closedItems.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} simple={isSimpleMode} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
