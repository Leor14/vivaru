"use client";

import { useMemo, useState } from "react";
import { LifeBuoy, Loader2, MessageSquare, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { AttachmentList, AttachmentPicker } from "@/components/shared/support-attachments";
import { Modal } from "@/components/shared/modal";
import { SectionIntro } from "@/components/shared/section-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_LIMITS,
  SUPPORT_STATUSES,
  canReopen,
  type SupportCategory,
  type SupportStatus,
  type SupportTicket,
} from "@/features/support/types";
import { uploadSupportAttachments } from "@/features/support/upload";
import { useSupportTickets } from "@/features/support/use-support-tickets";
import {
  closeSupportTicketCallable,
  createSupportTicketCallable,
  reopenSupportTicketCallable,
  replyToSupportTicketCallable,
} from "@/lib/firebase/callables";
import { cn } from "@/lib/utils/cn";

/**
 * Soporte al cliente, lado del administrador (PRD-V-FEAT-001).
 *
 * El canal entre el conjunto y Vivaru. NO es PQRS: aquella es entre el
 * residente y su administración; esta es entre la administración y nosotros.
 * Por eso vive en CONFIGURACIÓN y no en el bloque operativo.
 *
 * Toda escritura va por callable. Aquí solo se lee y se dispara.
 */

const STATUS_TONE: Record<SupportStatus, string> = {
  abierto: "bg-sky-100 text-sky-800",
  en_proceso: "bg-amber-100 text-amber-900",
  esperando_respuesta: "bg-[var(--brand-100)] text-[var(--brand-900)]",
  resuelto: "bg-emerald-100 text-emerald-800",
  cerrado: "bg-[var(--slate-200)] text-[var(--slate-700)]",
};

function fecha(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function AdminSoportePage() {
  const { user } = useAuth();
  const { items, loading, error } = useSupportTickets(user?.tenantId);

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [category, setCategory] = useState<SupportCategory>("tecnico");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [reply, setReply] = useState("");
  const [nuevoAdjunto, setNuevoAdjunto] = useState<File[]>([]);
  const [respuestaAdjunto, setRespuestaAdjunto] = useState<File[]>([]);

  const selected = useMemo(
    () => items.find((t) => t.id === selectedId) ?? null,
    [items, selectedId],
  );

  const sinCerrar = items.filter((t) => t.status !== "cerrado").length;
  const alLimite = sinCerrar >= SUPPORT_LIMITS.maxOpenPerTenant;

  async function handleCreate() {
    if (!user?.tenantId) return;
    if (subject.trim().length < 4) return toast.error("Escribe un asunto que describa el problema.");
    if (description.trim().length < 10) return toast.error("Cuéntanos un poco más para poder ayudarte.");
    setSending(true);
    try {
      // La subida va antes: si un archivo no pasa, mejor saberlo sin haber
      // creado el ticket.
      const attachments = await uploadSupportAttachments(user.tenantId, nuevoAdjunto);
      const { ticketId } = await createSupportTicketCallable({
        tenantId: user.tenantId,
        category,
        subject: subject.trim(),
        description: description.trim(),
        attachments,
      });
      toast.success("Recibimos tu solicitud. Te avisaremos por correo cuando haya respuesta.");
      setCreateOpen(false);
      setSubject("");
      setDescription("");
      setNuevoAdjunto([]);
      setSelectedId(ticketId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible abrir el ticket.");
    } finally {
      setSending(false);
    }
  }

  async function handleReply(ticket: SupportTicket) {
    if (reply.trim().length < 2) return;
    setSending(true);
    try {
      const attachments = user?.tenantId
        ? await uploadSupportAttachments(user.tenantId, respuestaAdjunto)
        : [];
      // Reabrir y responder son operaciones distintas: la primera tiene su
      // propia ventana y su propia validación en el servidor.
      if (ticket.status === "resuelto") {
        await reopenSupportTicketCallable({ ticketId: ticket.id, message: reply.trim() });
        toast.success("Reabrimos tu ticket.");
      } else {
        await replyToSupportTicketCallable({ ticketId: ticket.id, message: reply.trim(), attachments });
        toast.success("Mensaje enviado.");
      }
      setReply("");
      setRespuestaAdjunto([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible enviar tu mensaje.");
    } finally {
      setSending(false);
    }
  }

  async function handleClose(ticket: SupportTicket) {
    setSending(true);
    try {
      await closeSupportTicketCallable({ ticketId: ticket.id });
      toast.success("Ticket cerrado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No fue posible cerrar el ticket.");
    } finally {
      setSending(false);
    }
  }

  const puedeEscribir =
    selected && ["abierto", "en_proceso", "esperando_respuesta"].includes(selected.status);
  const puedeReabrir = selected ? canReopen(selected) : false;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--slate-900)]">Soporte de Vivaru</h1>
          <p className="mt-1 text-sm text-[var(--slate-600)]">
            El canal directo con nuestro equipo para lo que tenga que ver con la plataforma.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} disabled={alLimite}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva solicitud
        </Button>
      </div>

      <SectionIntro
        storageKey="soporte-admin"
        icon={LifeBuoy}
        tone="peach"
        purpose="Escribirle al equipo de Vivaru cuando algo de la plataforma falla, no cuadra o no sabes cómo hacerlo."
        how="Abres una solicitud, te respondemos por aquí y te avisamos por correo. Todo queda registrado, así que si vuelve a pasar hay historial. Ojo: los reclamos de tus residentes van por PQRS, que es su canal contigo."
      />

      {alLimite ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Tienes {SUPPORT_LIMITS.maxOpenPerTenant} solicitudes sin cerrar. Cierra alguna resuelta
            antes de abrir otra — así ninguna se pierde de vista.
          </p>
        </Card>
      ) : null}

      {error ? (
        <Card>
          <p className="text-sm text-[var(--danger-700)]">{error}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        {/* ── Lista ────────────────────────────────────────────────────── */}
        <Card className="p-0">
          <div className="border-b border-[var(--slate-200)] px-4 py-3">
            <CardTitle className="text-sm">Tus solicitudes</CardTitle>
            <CardDescription className="mt-0.5 text-xs">
              {items.length === 0 ? "Ninguna todavía" : `${items.length} en total`}
            </CardDescription>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-center text-sm text-[var(--slate-500)]">Cargando…</p>
          ) : items.length === 0 ? (
            <div className="px-4 py-6">
              <EmptyState
                title="Sin solicitudes"
                description="Cuando necesites ayuda con la plataforma, escríbenos desde aquí."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--slate-100)]">
              {items.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(ticket.id)}
                    className={cn(
                      "w-full px-4 py-3 text-left [transition:background-color_150ms_var(--ease-out)]",
                      ticket.id === selectedId ? "bg-[var(--brand-50)]" : "hover:bg-[var(--surface-soft)]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--slate-900)]">
                        {ticket.subject}
                      </span>
                      <Badge className={cn("shrink-0 text-[11px]", STATUS_TONE[ticket.status])}>
                        {SUPPORT_STATUSES[ticket.status]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--slate-500)]">
                      {SUPPORT_CATEGORIES[ticket.category]} · {fecha(ticket.lastActivityAt)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* ── Detalle ──────────────────────────────────────────────────── */}
        <Card className={selected ? "" : "grid place-items-center py-16"}>
          {!selected ? (
            <p className="text-sm text-[var(--slate-500)]">
              Elige una solicitud para ver la conversación.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-[var(--slate-900)]">{selected.subject}</h2>
                  <p className="mt-0.5 text-xs text-[var(--slate-500)]">
                    {SUPPORT_CATEGORIES[selected.category]} · abierta el {fecha(selected.createdAt)}
                  </p>
                </div>
                <Badge className={STATUS_TONE[selected.status]}>{SUPPORT_STATUSES[selected.status]}</Badge>
              </div>

              <div className="rounded-xl bg-[var(--surface-soft)] p-3 text-sm text-[var(--slate-700)]">
                {selected.description}
              </div>

              {/* El hilo es append-only: nada se edita ni se borra. */}
              <ul className="space-y-3">
                {(selected.thread ?? []).map((m) => (
                  <li
                    key={m.id}
                    className={cn(
                      "rounded-xl border p-3",
                      m.role === "vivaru"
                        ? "border-[var(--brand-200)] bg-[var(--brand-50)]"
                        : "border-[var(--slate-200)] bg-white",
                    )}
                  >
                    <p className="text-xs font-semibold text-[var(--slate-600)]">
                      {m.role === "vivaru" ? "Equipo Vivaru" : m.authorName}
                      <span className="ml-2 font-normal text-[var(--slate-500)]">{fecha(m.createdAt)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--slate-800)]">{m.message}</p>
                    <AttachmentList attachments={m.attachments} />
                  </li>
                ))}
              </ul>

              {selected.status === "cerrado" ? (
                <p className="rounded-xl bg-[var(--slate-100)] p-3 text-sm text-[var(--slate-600)]">
                  Esta solicitud está cerrada. Si el tema vuelve, abre una nueva citando esta.
                </p>
              ) : puedeEscribir || puedeReabrir ? (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder={puedeReabrir ? "Cuéntanos por qué sigue sin resolverse…" : "Escribe tu mensaje…"}
                  />
                  <AttachmentPicker
                    files={respuestaAdjunto}
                    onChange={setRespuestaAdjunto}
                    disabled={sending}
                    onError={(m) => toast.error(m)}
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    {selected.status === "resuelto" || selected.status === "esperando_respuesta" ? (
                      <Button variant="outline" onClick={() => void handleClose(selected)} disabled={sending}>
                        Cerrar solicitud
                      </Button>
                    ) : null}
                    <Button onClick={() => void handleReply(selected)} disabled={sending || reply.trim().length < 2}>
                      {sending ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando…</>
                      ) : puedeReabrir ? (
                        <><MessageSquare className="mr-2 h-4 w-4" />Reabrir</>
                      ) : (
                        <><Send className="mr-2 h-4 w-4" />Enviar</>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl bg-[var(--slate-100)] p-3 text-sm text-[var(--slate-600)]">
                  La ventana para reabrir esta solicitud ya pasó. Abre una nueva citando esta.
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ── Alta ───────────────────────────────────────────────────────── */}
      <Modal open={createOpen} title="Nueva solicitud de soporte" onClose={() => setCreateOpen(false)}>
        <div className="space-y-3 text-sm text-[var(--slate-700)]">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
              ¿De qué se trata?
            </span>
            <select
              className="mt-1.5 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as SupportCategory)}
            >
              {Object.entries(SUPPORT_CATEGORIES).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">Asunto</span>
            <Input
              className="mt-1.5"
              maxLength={SUPPORT_LIMITS.subjectMaxLength}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ej: no cargan los cobros de agosto"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--brand-700)]">
              Cuéntanos qué pasa
            </span>
            <Textarea
              className="mt-1.5"
              rows={5}
              maxLength={SUPPORT_LIMITS.descriptionMaxLength}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Qué intentabas hacer, qué esperabas y qué pasó. Cuanto más concreto, más rápido lo resolvemos."
            />
          </label>

          <AttachmentPicker
            files={nuevoAdjunto}
            onChange={setNuevoAdjunto}
            disabled={sending}
            onError={(m) => toast.error(m)}
          />

          <p className="rounded-xl bg-[var(--surface-soft)] p-3 text-xs leading-relaxed text-[var(--slate-600)]">
            Te responderemos por aquí y te avisaremos a <strong>{user?.email ?? "tu correo"}</strong>. Tu
            asesor ya verá de qué conjunto escribes, así que no hace falta que lo expliques.
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={sending}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={sending}>
              {sending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando…</>) : "Enviar solicitud"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
