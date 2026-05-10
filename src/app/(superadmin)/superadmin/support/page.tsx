"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Modal } from "@/components/shared/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/auth-context";
import {
  supportTicketCreateSchema,
  type SupportTicketCreateInput,
} from "@/features/superadmin/support/schemas";
import {
  createSupportTicket,
  updateSupportTicket,
} from "@/features/superadmin/support/services";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  type SupportTicket,
} from "@/features/superadmin/support/types";
import { useSupportTickets } from "@/features/superadmin/support/use-support";
import {
  watchTenants,
  type TenantWorkspaceItem,
} from "@/features/superadmin/services";

function priorityClassName(priority: SupportTicket["priority"]) {
  if (priority === "high") return "bg-red-100 text-red-800";
  if (priority === "medium") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function statusClassName(status: SupportTicket["status"]) {
  if (status === "open") return "bg-blue-100 text-blue-800";
  if (status === "in_progress") return "bg-orange-100 text-orange-800";
  return "bg-emerald-100 text-emerald-800";
}

function formatDate(ts: SupportTicket["createdAt"] | undefined) {
  if (!ts) return "-";
  const date = typeof ts === "object" && "toDate" in ts ? (ts as { toDate: () => Date }).toDate() : new Date(ts as unknown as string);
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SuperadminSupportPage() {
  const { user } = useAuth();

  // Tenant list for create form
  const [tenants, setTenants] = useState<TenantWorkspaceItem[]>([]);
  useEffect(() => {
    const unsub = watchTenants(
      (items) => setTenants(items),
      (msg) => toast.error(msg),
    );
    return () => unsub();
  }, []);

  // Filters
  const [tenantSearch, setTenantSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  // Debounce tenant search to avoid unnecessary Firestore queries
  const [debouncedTenantId, setDebouncedTenantId] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      const match = tenants.find(
        (t) =>
          t.name.toLowerCase().includes(tenantSearch.toLowerCase()) ||
          t.id.toLowerCase().includes(tenantSearch.toLowerCase()),
      );
      setDebouncedTenantId(match?.id ?? (tenantSearch.trim() ? "__no_match__" : ""));
    }, 400);
    return () => clearTimeout(timer);
  }, [tenantSearch, tenants]);

  const filters = useMemo(
    () => ({
      tenantId: debouncedTenantId || undefined,
      status: statusFilter || undefined,
      priority: priorityFilter || undefined,
    }),
    [debouncedTenantId, statusFilter, priorityFilter],
  );

  const { tickets, loading } = useSupportTickets(filters);

  // Client-side tenant name search (supplements Firestore filter)
  const filteredTickets = useMemo(() => {
    if (!tenantSearch.trim()) return tickets;
    const q = tenantSearch.trim().toLowerCase();
    return tickets.filter(
      (t) =>
        t.tenantName.toLowerCase().includes(q) ||
        t.tenantId.toLowerCase().includes(q),
    );
  }, [tickets, tenantSearch]);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const createForm = useForm<SupportTicketCreateInput>({
    resolver: zodResolver(supportTicketCreateSchema),
    defaultValues: {
      tenantId: "",
      tenantName: "",
      reportedBy: "",
      reportedByName: "",
      category: "technical",
      subject: "",
      description: "",
      priority: "medium",
      notes: "",
    },
  });

  // Auto-fill tenantName when tenantId changes
  const watchedTenantId = createForm.watch("tenantId");
  useEffect(() => {
    const match = tenants.find((t) => t.id === watchedTenantId);
    if (match) createForm.setValue("tenantName", match.name);
  }, [watchedTenantId, tenants, createForm]);

  async function handleCreate(values: SupportTicketCreateInput) {
    if (!user?.uid) return;
    setSaving(true);
    try {
      await createSupportTicket(
        {
          tenantId: values.tenantId,
          tenantName: values.tenantName,
          reportedBy: values.reportedBy,
          reportedByName: values.reportedByName,
          category: values.category,
          subject: values.subject,
          description: values.description,
          priority: values.priority,
          notes: values.notes,
          createdBy: user.uid,
        },
        user.uid,
      );
      toast.success("Incidencia registrada.");
      setCreateOpen(false);
      createForm.reset();
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  // Detail drawer
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<SupportTicket["status"]>("open");
  const [updateNotes, setUpdateNotes] = useState("");
  const [savingUpdate, setSavingUpdate] = useState(false);

  function openDrawer(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setUpdateStatus(ticket.status);
    setUpdateNotes(ticket.notes ?? "");
    setDrawerOpen(true);
  }

  async function handleUpdate() {
    if (!selectedTicket) return;
    setSavingUpdate(true);
    try {
      await updateSupportTicket(selectedTicket.id, {
        status: updateStatus,
        notes: updateNotes || undefined,
      });
      toast.success("Ticket actualizado.");
      setDrawerOpen(false);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingUpdate(false);
    }
  }

  const columns: DataTableColumn<SupportTicket>[] = [
    {
      key: "tenantName",
      header: "Tenant",
      render: (t) => (
        <div>
          <p className="font-medium text-[var(--slate-900)]">{t.tenantName}</p>
          <p className="text-xs text-[var(--slate-500)]">{t.tenantId}</p>
        </div>
      ),
    },
    {
      key: "reportedBy",
      header: "Reportado por",
      render: (t) => (
        <div>
          <p className="text-[var(--slate-900)]">{t.reportedByName ?? t.reportedBy}</p>
          {t.reportedByName ? <p className="text-xs text-[var(--slate-500)]">{t.reportedBy}</p> : null}
        </div>
      ),
    },
    {
      key: "subject",
      header: "Asunto",
      render: (t) => (
        <span title={t.subject}>
          {t.subject.length > 50 ? `${t.subject.slice(0, 50)}…` : t.subject}
        </span>
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
      render: (t) => (
        <Badge className={priorityClassName(t.priority)}>{SUPPORT_PRIORITIES[t.priority]}</Badge>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (t) => (
        <Badge className={statusClassName(t.status)}>{SUPPORT_STATUSES[t.status]}</Badge>
      ),
    },
    {
      key: "createdAt",
      header: "Creado",
      render: (t) => formatDate(t.createdAt),
      mobileHidden: true,
    },
  ];

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Centro de soporte operacional</CardTitle>
            <CardDescription className="mt-1">Registro de incidencias reportadas por tenants. Solo visible para el equipo Hogaru.</CardDescription>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
            Registrar incidencia
          </Button>
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
              Tenant
              <Input
                className="mt-1"
                placeholder="Nombre o ID del tenant"
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
          rows={filteredTickets}
          getRowKey={(t) => t.id}
          loading={loading}
          loadingText="Cargando incidencias..."
          emptyText="No hay incidencias con los filtros actuales."
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[800px] sm:min-w-[980px]"
          renderActions={(t) => (
            <Button size="sm" variant="outline" onClick={() => openDrawer(t)}>
              Ver detalle
            </Button>
          )}
        />
      </Card>

      {/* Create modal */}
      <Modal open={createOpen} title="Registrar incidencia" onClose={() => { setCreateOpen(false); createForm.reset(); }}>
        <form className="space-y-3" onSubmit={createForm.handleSubmit((v) => void handleCreate(v))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Tenant</label>
            <select
              className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              {...createForm.register("tenantId")}
            >
              <option value="">Selecciona un tenant…</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {createForm.formState.errors.tenantId ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.tenantId.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Email del admin</label>
              <Input type="email" {...createForm.register("reportedBy")} />
              {createForm.formState.errors.reportedBy ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.reportedBy.message}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre (opcional)</label>
              <Input {...createForm.register("reportedByName")} />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Categoría</label>
              <select
                className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                {...createForm.register("category")}
              >
                {Object.entries(SUPPORT_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Prioridad</label>
              <select
                className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                {...createForm.register("priority")}
              >
                {Object.entries(SUPPORT_PRIORITIES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Asunto</label>
            <Input {...createForm.register("subject")} />
            {createForm.formState.errors.subject ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.subject.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Descripción</label>
            <Textarea rows={4} {...createForm.register("description")} />
            {createForm.formState.errors.description ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.description.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Notas internas (opcional)</label>
            <Textarea rows={2} {...createForm.register("notes")} />
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => { setCreateOpen(false); createForm.reset(); }}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar incidencia"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail drawer */}
      <Drawer
        open={drawerOpen && Boolean(selectedTicket)}
        onClose={() => setDrawerOpen(false)}
        title={selectedTicket?.subject ?? "Detalle de incidencia"}
        headerExtra={
          selectedTicket ? (
            <>
              <Badge className={statusClassName(selectedTicket.status)}>
                {SUPPORT_STATUSES[selectedTicket.status]}
              </Badge>
              <Badge className={priorityClassName(selectedTicket.priority)}>
                {SUPPORT_PRIORITIES[selectedTicket.priority]}
              </Badge>
            </>
          ) : null
        }
        footer={
          selectedTicket ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs text-[var(--slate-700)]">
                  Estado
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-[var(--slate-300)] bg-white px-2 text-xs"
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value as SupportTicket["status"])}
                  >
                    {Object.entries(SUPPORT_STATUSES).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>
              <Textarea
                rows={2}
                placeholder="Notas internas (opcional)"
                value={updateNotes}
                onChange={(e) => setUpdateNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
                  Cerrar
                </Button>
                <Button type="button" size="sm" disabled={savingUpdate} onClick={() => void handleUpdate()}>
                  {savingUpdate ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {selectedTicket ? (
          <div className="space-y-4 text-sm text-[var(--slate-800)]">
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Tenant</dt>
                <dd className="mt-0.5 font-medium text-[var(--slate-900)]">{selectedTicket.tenantName}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Tenant ID</dt>
                <dd className="mt-0.5 text-[var(--slate-500)]">{selectedTicket.tenantId}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Reportado por</dt>
                <dd className="mt-0.5 text-[var(--slate-900)]">{selectedTicket.reportedByName ?? selectedTicket.reportedBy}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Email</dt>
                <dd className="mt-0.5 text-[var(--slate-600)]">{selectedTicket.reportedBy}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Categoría</dt>
                <dd className="mt-0.5"><Badge>{SUPPORT_CATEGORIES[selectedTicket.category]}</Badge></dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Creado</dt>
                <dd className="mt-0.5 text-[var(--slate-600)]">{formatDate(selectedTicket.createdAt)}</dd>
              </div>
              {selectedTicket.resolvedAt ? (
                <div className="col-span-2">
                  <dt className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Resuelto el</dt>
                  <dd className="mt-0.5 text-[var(--slate-600)]">{formatDate(selectedTicket.resolvedAt)}</dd>
                </div>
              ) : null}
            </dl>
            <div className="border-t border-[var(--slate-200)] pt-3">
              <p className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Descripción</p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--slate-700)]">{selectedTicket.description}</p>
            </div>
            {selectedTicket.notes ? (
              <div className="border-t border-[var(--slate-200)] pt-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--slate-500)]">Notas internas</p>
                <p className="mt-1 whitespace-pre-wrap text-[var(--slate-700)]">{selectedTicket.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </section>
  );
}
