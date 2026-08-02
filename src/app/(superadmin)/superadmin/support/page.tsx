"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { toast } from "sonner";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  addInternalNote,
  daysSinceActivity,
  isSupportPending,
  normalizeSupportCategory,
  normalizeSupportPriority,
  normalizeSupportStatus,
  replyAsVivaru,
  updateSupportTicket,
  type SupportPriority,
  type SupportStatus,
  type SupportTicket,
} from "@/features/superadmin/support";
import { useSupportTickets } from "@/features/superadmin/support/use-support";
import { db } from "@/lib/firebase/client";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { cn } from "@/lib/utils/cn";

/**
 * Bandeja de soporte al cliente (PRD-V-FEAT-001).
 *
 * Dejó de ser una bitácora. Antes el superadmin daba de alta la incidencia
 * eligiendo el conjunto y tecleando a mano quién había reportado; ahora los
 * tickets nacen en el portal del administrador y aquí se atienden. Por eso
 * **no hay botón de alta**: si el equipo pudiera crear tickets a nombre de un
 * cliente, volveríamos a tener un registro interno en vez de un canal.
 *
 * Toda escritura va por callable: las reglas prohíben escribir en
 * `supportTickets` desde el cliente, también al superadmin.
 */

const STATUS_TONE: Record<SupportStatus, string> = {
  abierto: "bg-sky-100 text-sky-800",
  en_proceso: "bg-amber-100 text-amber-900",
  esperando_respuesta: "bg-[var(--brand-100)] text-[var(--brand-900)]",
  resuelto: "bg-emerald-100 text-emerald-800",
  cerrado: "bg-[var(--slate-200)] text-[var(--slate-700)]",
};

const PRIORITY_TONE: Record<SupportPriority, string> = {
  alta: "bg-[#FCEBEB] text-[#791F1F]",
  media: "bg-[#FAEEDA] text-[#633806]",
  baja: "bg-[var(--slate-100)] text-[var(--slate-700)]",
};

function fecha(value: unknown) {
  if (!value) return "—";
  const d =
    typeof value === "string"
      ? new Date(value)
      : typeof value === "object" && value !== null && "toDate" in value
        ? (value as { toDate: () => Date }).toDate()
        : null;
  if (!d || Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Notas internas del ticket abierto. Subcolección: el cliente no la ve. */
function useInternalNotes(ticketId: string | undefined) {
  const [notes, setNotes] = useState<Array<{ id: string; note: string; createdBy?: string }>>([]);
  useEffect(() => {
    if (!ticketId || !db) {
      setNotes([]);
      return;
    }
    const unsub = onSnapshot(
      query(collection(db, "supportTickets", ticketId, "internal"), orderBy("createdAt", "asc")),
      (snap) => setNotes(snap.docs.map((d) => ({ id: d.id, ...(d.data() as { note: string; createdBy?: string }) }))),
      () => setNotes([]),
    );
    return () => unsub();
  }, [ticketId]);
  return notes;
}

export default function SuperadminSupportPage() {
  const [tenantSearch, setTenantSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const filters = useMemo(
    () => ({ status: statusFilter || undefined, priority: priorityFilter || undefined }),
    [statusFilter, priorityFilter],
  );
  const { tickets, loading } = useSupportTickets(filters);

  // Los tickets viejos pueden traer valores de la etapa bitácora; se traducen
  // al leer en vez de migrarlos.
  const normalizados = useMemo(
    () =>
      tickets.map((t) => ({
        ...t,
        status: normalizeSupportStatus(t.status),
        category: normalizeSupportCategory(t.category),
        priority: normalizeSupportPriority(t.priority),
      })),
    [tickets],
  );

  const filtrados = useMemo(() => {
    if (!tenantSearch.trim()) return normalizados;
    const q = tenantSearch.trim().toLowerCase();
    return normalizados.filter(
      (t) => (t.tenantName ?? "").toLowerCase().includes(q) || t.tenantId.toLowerCase().includes(q),
    );
  }, [normalizados, tenantSearch]);

  const pendientes = normalizados.filter((t) => isSupportPending(t.status)).length;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reply, setReply] = useState("");
  const [note, setNote] = useState("");

  const selected = useMemo(
    () => filtrados.find((t) => t.id === selectedId) ?? null,
    [filtrados, selectedId],
  );
  const notes = useInternalNotes(selected?.id);

  function openDrawer(ticket: SupportTicket) {
    setSelectedId(ticket.id);
    setReply("");
    setNote("");
    setDrawerOpen(true);
  }

  async function cambiarEstado(status: SupportStatus) {
    if (!selected) return;
    setSaving(true);
    try {
      await updateSupportTicket(selected.id, { status });
      toast.success("Ticket actualizado.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  async function cambiarPrioridad(priority: SupportPriority) {
    if (!selected) return;
    setSaving(true);
    try {
      await updateSupportTicket(selected.id, { priority });
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  async function responder() {
    if (!selected || reply.trim().length < 2) return;
    setSaving(true);
    try {
      await replyAsVivaru(selected.id, reply.trim());
      toast.success("Respuesta enviada al cliente.");
      setReply("");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  async function guardarNota() {
    if (!selected || note.trim().length < 2) return;
    setSaving(true);
    try {
      await addInternalNote(selected.id, note.trim());
      toast.success("Nota guardada. El cliente no la ve.");
      setNote("");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  const columns: DataTableColumn<SupportTicket>[] = [
    {
      key: "tenantName",
      header: "Conjunto",
      render: (t) => (
        <div>
          <p className="font-medium text-[var(--slate-900)]">{t.tenantName}</p>
          <p className="text-xs text-[var(--slate-500)]">{t.createdByName ?? t.reportedByName ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "subject",
      header: "Asunto",
      render: (t) => (
        <span title={t.subject}>{t.subject.length > 48 ? `${t.subject.slice(0, 48)}…` : t.subject}</span>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      render: (t) => <Badge>{SUPPORT_CATEGORIES[t.category]}</Badge>,
      mobileHidden: true,
    },
    {
      key: "priority",
      header: "Prioridad",
      render: (t) => <Badge className={PRIORITY_TONE[t.priority]}>{SUPPORT_PRIORITIES[t.priority]}</Badge>,
    },
    {
      key: "status",
      header: "Estado",
      render: (t) => <Badge className={STATUS_TONE[t.status]}>{SUPPORT_STATUSES[t.status]}</Badge>,
    },
    {
      key: "antiguedad",
      header: "Sin moverse",
      // La antigüedad es la señal que evita que un ticket se pudra en la cola.
      // Roja a partir de dos días: con revisión diaria, eso ya es un olvido.
      render: (t) => {
        const dias = daysSinceActivity(t);
        if (dias === null) return <span className="text-xs text-[var(--slate-500)]">—</span>;
        const urgente = isSupportPending(t.status) && dias >= 2;
        return (
          <span
            className={cn(
              "text-xs font-medium",
              urgente ? "text-[var(--danger-700)]" : "text-[var(--slate-600)]",
            )}
          >
            {dias === 0 ? "hoy" : `${dias} día${dias === 1 ? "" : "s"}`}
          </span>
        );
      },
    },
  ];

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Soporte al cliente</CardTitle>
            <CardDescription className="mt-1">
              Solicitudes abiertas por los administradores desde su portal. Responder aquí les llega
              por correo y aparece en su pantalla de soporte.
            </CardDescription>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] px-4 py-2 text-center">
            <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Pendientes</p>
            <p
              className={cn(
                "text-xl font-semibold",
                pendientes > 0 ? "text-[var(--danger-700)]" : "text-[var(--slate-900)]",
              )}
            >
              {pendientes}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <MobileFiltersPanel
            title="Filtros de soporte"
            footer={
              <Button
                className="w-full md:w-auto"
                type="button"
                variant="outline"
                onClick={() => {
                  setTenantSearch("");
                  setStatusFilter("");
                  setPriorityFilter("");
                }}
              >
                Limpiar filtros
              </Button>
            }
          >
            <label className="text-sm text-[var(--slate-700)]">
              Conjunto
              <Input
                className="mt-1"
                placeholder="Nombre o ID"
                value={tenantSearch}
                onChange={(e) => setTenantSearch(e.target.value)}
              />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Estado
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="">Todos</option>
                {Object.entries(SUPPORT_STATUSES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Prioridad
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
              >
                <option value="">Todas</option>
                {Object.entries(SUPPORT_PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </label>
          </MobileFiltersPanel>
        </div>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          rows={filtrados}
          getRowKey={(t) => t.id}
          loading={loading}
          loadingText="Cargando solicitudes..."
          emptyText="No hay solicitudes con los filtros actuales."
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[860px]"
          renderActions={(t) => (
            <Button size="sm" variant="outline" onClick={() => openDrawer(t)}>
              Atender
            </Button>
          )}
        />
      </Card>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selected?.subject ?? "Solicitud de soporte"}
        headerExtra={
          selected ? (
            <>
              <Badge className={STATUS_TONE[selected.status]}>{SUPPORT_STATUSES[selected.status]}</Badge>
              <Badge className={PRIORITY_TONE[selected.priority]}>{SUPPORT_PRIORITIES[selected.priority]}</Badge>
            </>
          ) : null
        }
        footer={
          selected && selected.status !== "cerrado" ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-[var(--slate-700)]">
                  Estado
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--slate-300)] bg-white px-2 text-xs"
                    value={selected.status}
                    onChange={(e) => void cambiarEstado(e.target.value as SupportStatus)}
                    disabled={saving}
                  >
                    {Object.entries(SUPPORT_STATUSES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-[var(--slate-700)]">
                  Prioridad
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--slate-300)] bg-white px-2 text-xs"
                    value={selected.priority}
                    onChange={(e) => void cambiarPrioridad(e.target.value as SupportPriority)}
                    disabled={saving}
                  >
                    {Object.entries(SUPPORT_PRIORITIES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Textarea
                rows={3}
                placeholder="Escribe la respuesta que verá el cliente…"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
              />
              <div className="flex justify-end">
                <Button size="sm" disabled={saving || reply.trim().length < 2} onClick={() => void responder()}>
                  {saving ? "Enviando…" : "Responder al cliente"}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-4 text-sm text-[var(--slate-800)]">
            <div className="rounded-xl border border-[var(--slate-200)] p-3">
              <p className="text-xs text-[var(--slate-500)]">
                {selected.tenantName} · {selected.createdByName ?? "—"} ·{" "}
                {selected.createdByEmail ?? "sin correo"}
              </p>
              <p className="mt-2 whitespace-pre-wrap">{selected.description}</p>
              <p className="mt-2 text-xs text-[var(--slate-500)]">Abierta el {fecha(selected.createdAt)}</p>
            </div>

            {/* Hilo. Append-only: nada se edita ni se borra. */}
            {(selected.thread ?? []).length > 0 ? (
              <ul className="space-y-2">
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
                      {m.role === "vivaru" ? "Vivaru" : m.authorName}
                      <span className="ml-2 font-normal text-[var(--slate-500)]">{fecha(m.createdAt)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{m.message}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--slate-500)]">Sin mensajes todavía.</p>
            )}

            {/* Notas internas: subcolección, invisibles para el cliente. */}
            <div className="rounded-xl border border-dashed border-[var(--slate-300)] bg-[var(--surface-soft)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-600)]">
                Notas internas · el cliente no las ve
              </p>
              {notes.length > 0 ? (
                <ul className="mt-2 space-y-1.5">
                  {notes.map((n) => (
                    <li key={n.id} className="text-xs text-[var(--slate-700)]">
                      · {n.note}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-[var(--slate-500)]">Ninguna.</p>
              )}
              <div className="mt-2 flex gap-2">
                <Input
                  className="h-9 text-xs"
                  placeholder="Añadir nota interna…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button size="sm" variant="outline" disabled={saving || note.trim().length < 2} onClick={() => void guardarNota()}>
                  Guardar
                </Button>
              </div>
            </div>

            {selected.status === "cerrado" ? (
              <p className="rounded-xl bg-[var(--slate-100)] p-3 text-xs text-[var(--slate-600)]">
                Esta solicitud está cerrada y no admite cambios.
              </p>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}
