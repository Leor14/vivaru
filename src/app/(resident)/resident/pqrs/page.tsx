"use client";

import { useState } from "react";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import { createTicket, useTickets } from "@/features/pqrs/use-tickets";
import type { Ticket } from "@/types/domain";

// ─── Constants ────────────────────────────────────────────────────────────────

const TICKET_TYPES = [
  { value: "petition",   label: "Petición",   description: "Solicitud de un servicio o acción" },
  { value: "complaint",  label: "Queja",      description: "Inconformidad con un servicio" },
  { value: "claim",      label: "Reclamo",    description: "Corrección de un error o incumplimiento" },
  { value: "suggestion", label: "Sugerencia", description: "Idea para mejorar el edificio" },
] as const;

type TicketTypeValue = typeof TICKET_TYPES[number]["value"];

const STATUS_CONFIG: Record<Ticket["status"], { label: string; badgeCls: string }> = {
  open:        { label: "Abierto",     badgeCls: "bg-amber-100 text-amber-700" },
  in_progress: { label: "En proceso",  badgeCls: "bg-sky-100 text-sky-700" },
  responded:   { label: "Respondido",  badgeCls: "bg-indigo-100 text-indigo-700" },
  resolved:    { label: "Resuelto",    badgeCls: "bg-emerald-100 text-emerald-700" },
  closed:      { label: "Cerrado",     badgeCls: "bg-[var(--slate-100)] text-[var(--slate-600)]" },
};

const TYPE_LABELS: Record<string, string> = {
  petition: "Petición", complaint: "Queja", claim: "Reclamo",
  suggestion: "Sugerencia", other: "General",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(value: string | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

// ─── TicketRow ────────────────────────────────────────────────────────────────

function TicketRow({ ticket }: { ticket: Ticket }) {
  const statusCfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
  const typeLabel = ticket.type ? (TYPE_LABELS[ticket.type] ?? "General") : "General";
  const date = formatDate(ticket.createdAt ?? ticket.updatedAt);

  return (
    <div className="rounded-xl border border-[var(--slate-200)] bg-white p-3 space-y-2">
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
        <span className="rounded-md bg-[var(--slate-100)] px-1.5 py-0.5 font-medium text-[var(--slate-700)]">
          {typeLabel}
        </span>
        {date && <span>{date}</span>}
        {ticket.radicado && (
          <span className="font-mono text-[var(--slate-400)]">#{ticket.radicado}</span>
        )}
      </div>

      {/* Respuesta de la administración */}
      {ticket.response && (
        <div className="rounded-lg border border-[var(--slate-100)] bg-[var(--slate-50)] px-3 py-2">
          <p className="mb-1 text-xs font-medium text-[var(--slate-500)]">Respuesta de la administración</p>
          <p className="text-xs text-[var(--slate-700)] line-clamp-2">{ticket.response}</p>
          {ticket.respondedAt && (
            <p className="mt-1 text-[10px] text-[var(--slate-400)]">{formatDate(ticket.respondedAt)}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResidentPqrsPage() {
  const { user } = useAuth();
  const { items, loading } = useTickets(user?.tenantId, user?.unitId);

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
        type: ticketType,
      });
      setSubject("");
      setMessage("");
      setTicketType("petition");
      toast.success("Solicitud enviada. La administración responderá pronto.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSubmitting(false);
    }
  }

  const activeItems  = items.filter((t) => t.status !== "closed" && t.status !== "resolved");
  const closedItems  = items.filter((t) => t.status === "closed"  || t.status === "resolved");

  return (
    <Card>
      <CardTitle>PQRS</CardTitle>
      <CardDescription className="mt-1">
        Envía peticiones, quejas, reclamos o sugerencias a la administración del edificio.
      </CardDescription>

      {/* ── Formulario ── */}
      <div className="mt-4 space-y-3">
        {/* Tipo */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">
            Tipo de solicitud
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TICKET_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTicketType(t.value)}
                className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                  ticketType === t.value
                    ? "border-[var(--brand-700)] bg-[var(--brand-50)] font-semibold text-[var(--brand-700)]"
                    : "border-[var(--slate-200)] text-[var(--slate-700)] hover:bg-[var(--slate-100)]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Asunto */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--slate-600)]" htmlFor="pqrs-subject">
            Asunto <span className="text-red-500">*</span>
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

      {/* ── Lista ── */}
      <div className="mt-6">
        {loading ? (
          <p className="text-sm text-[var(--slate-500)]">Cargando solicitudes...</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="Sin solicitudes"
            description="No has enviado ninguna PQRS. Usa el formulario de arriba para crear tu primera solicitud."
          />
        ) : (
          <div className="space-y-5">
            {activeItems.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">
                  En curso ({activeItems.length})
                </p>
                <div className="space-y-2">
                  {activeItems.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)}
                </div>
              </div>
            )}
            {closedItems.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--slate-500)]">
                  Resueltas ({closedItems.length})
                </p>
                <div className="space-y-2">
                  {closedItems.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
