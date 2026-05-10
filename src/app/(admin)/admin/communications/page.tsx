"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FilterX, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Modal } from "@/components/shared/modal";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Textarea } from "@/components/ui/textarea";
import { communicationSchema, type CommunicationInput } from "@/features/admin/schemas";
import {
  createCommunication,
  deleteCommunication,
  listCommunicationsOnce,
  uploadCommunicationAttachment,
  updateCommunication,
  watchCommunications,
  type CommunicationItem,
} from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";

export default function AdminCommunicationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<CommunicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<CommunicationItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft" | "archived" | "scheduled" | "expired">("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [detailItem, setDetailItem] = useState<CommunicationItem | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<CommunicationItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const form = useForm<CommunicationInput>({
    resolver: zodResolver(communicationSchema),
    defaultValues: {
      title: "",
      message: "",
      status: "published",
      startsAt: "",
      endsAt: "",
      attachmentUrl: "",
      attachmentName: "",
    },
  });

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    const unsub = watchCommunications(
      user.tenantId,
      (data) => {
        setItems(data);
        setErrorMessage(null);
        setLoading(false);
      },
      (message) => {
        setErrorMessage(message);
        toast.error(message);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [user?.tenantId]);

  function openCreate() {
    setEditingItem(null);
    setAttachmentFile(null);
    form.reset({ title: "", message: "", status: "published", startsAt: "", endsAt: "", attachmentName: "", attachmentUrl: "" });
    setCreateOpen(true);
  }

  function openEdit(item: CommunicationItem) {
    setEditingItem(item);
    setAttachmentFile(null);
    form.reset({
      title: item.title,
      message: item.message,
      status: item.status,
      startsAt: item.startsAt ?? "",
      endsAt: item.endsAt ?? "",
      attachmentUrl: item.attachmentUrl ?? "",
      attachmentName: item.attachmentName ?? "",
    });
    setCreateOpen(true);
  }

  async function handleSave(values: CommunicationInput) {
    if (!user?.tenantId) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      let attachmentUrl = values.attachmentUrl;
      let attachmentName = values.attachmentName;

      if (attachmentFile) {
        const uploaded = await uploadCommunicationAttachment({ tenantId: user.tenantId, file: attachmentFile });
        attachmentUrl = uploaded.fileUrl;
        attachmentName = uploaded.fileName;
      }

      const today = new Date().toISOString().slice(0, 10);
      const startsAt = values.startsAt || undefined;
      const endsAt = values.endsAt || undefined;
      let computedStatus: CommunicationItem["status"] = values.status;
      if (values.status !== "draft" && values.status !== "archived") {
        if (startsAt && startsAt > today) {
          computedStatus = "scheduled";
        } else if (endsAt && endsAt < today) {
          computedStatus = "expired";
        } else {
          computedStatus = "published";
        }
      }

      const payload = {
        ...values,
        startsAt,
        endsAt,
        status: computedStatus,
        attachmentUrl,
        attachmentName,
      };

      if (editingItem) {
        await updateCommunication(editingItem.id, user.uid, payload);
        toast.success("Comunicado actualizado.");
      } else {
        await createCommunication(user.tenantId, user.uid, payload);
        toast.success("Comunicado creado.");
      }
      const refreshed = await listCommunicationsOnce(user.tenantId);
      setItems(refreshed);
      setCreateOpen(false);
    } catch (createError) {
      setErrorMessage(createError instanceof Error ? createError.message : "No fue posible guardar comunicado.");
      toastFirebaseError(createError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeletion) return;
    const target = pendingDeletion;
    setDeleting(true);
    setErrorMessage(null);
    try {
      await deleteCommunication(target.id);
      if (user?.tenantId) {
        const refreshed = await listCommunicationsOnce(user.tenantId);
        setItems(refreshed);
      }
      toast.success("Comunicado eliminado.");
      setPendingDeletion(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible eliminar.");
      toastFirebaseError(error);
    } finally {
      setDeleting(false);
    }
  }

  const filteredItems = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return items.filter((item) => {
      const effectiveStatus: CommunicationItem["status"] =
        item.status === "draft" || item.status === "archived"
          ? item.status
          : item.startsAt && item.startsAt > today
            ? "scheduled"
            : item.endsAt && item.endsAt < today
              ? "expired"
              : "published";
      const matchesStatus = statusFilter === "all" ? true : effectiveStatus === statusFilter;
      const matchesSearch =
        query.length === 0
          ? true
          : `${item.title} ${item.message}`.toLowerCase().includes(query);
      const referenceDate = item.startsAt || item.endsAt || "";
      const matchesFrom = !dateFrom ? true : referenceDate >= dateFrom;
      const matchesTo = !dateTo ? true : referenceDate <= dateTo;
      return matchesStatus && matchesSearch && matchesFrom && matchesTo;
    });
  }, [items, statusFilter, searchFilter, dateFrom, dateTo]);

  const activeFiltersCount =
    (statusFilter !== "all" ? 1 : 0) + (searchFilter.trim() ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const columns: DataTableColumn<CommunicationItem>[] = [
    {
      key: "title",
      header: "Titulo",
      render: (item) => <span className="font-medium text-[var(--slate-900)]">{item.title}</span>,
    },
    {
      key: "message",
      header: "Mensaje",
      render: (item) => <span className="text-[var(--slate-700)]">{item.message}</span>,
    },
    {
      key: "status",
      header: "Estado",
      render: (item) => {
        const today = new Date().toISOString().slice(0, 10);
        const effectiveStatus =
          item.status === "draft" || item.status === "archived"
            ? item.status
            : item.startsAt && item.startsAt > today
              ? "scheduled"
              : item.endsAt && item.endsAt < today
                ? "expired"
                : "published";
        return <StatusBadge status={effectiveStatus} context="communication" />;
      },
    },
    {
      key: "attachment",
      header: "Adjunto",
      render: (item) =>
        item.attachmentUrl ? (
          <a className="text-[var(--brand-700)] hover:underline" href={item.attachmentUrl} target="_blank" rel="noreferrer">
            {item.attachmentName || "PDF"}
          </a>
        ) : (
          "-"
        ),
    },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Comunicaciones</CardTitle>
          <CardDescription className="mt-1">Centro de mensajes y notificaciones.</CardDescription>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          <IconBadge tone="mint" className="mr-2">
            <Plus className="h-4 w-4" />
          </IconBadge>
          Crear comunicado
        </Button>
      </div>
      {errorMessage ? <p className="mt-2 text-xs text-[var(--danger-700)]">{errorMessage}</p> : null}
      <div className="mt-4 space-y-3">
        <MobileFiltersPanel
          title="Filtros de comunicados"
          activeFiltersCount={activeFiltersCount}
          footer={
            <Button
              className="w-full md:w-auto"
              type="button"
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setSearchFilter("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              <IconBadge tone="sand" className="mr-2">
                <FilterX className="h-4 w-4" />
              </IconBadge>
              Limpiar filtros
            </Button>
          }
        >
          <label className="text-sm text-[var(--slate-700)]">
            Buscar
            <Input
              className="mt-1"
              placeholder="Titulo o mensaje"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
            />
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Estado
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "published" | "draft" | "archived" | "scheduled" | "expired")}
            >
              <option value="all">Todos</option>
              <option value="published">Publicado</option>
              <option value="scheduled">Programado</option>
              <option value="expired">Vencido</option>
              <option value="draft">Borrador</option>
              <option value="archived">Archivado</option>
            </select>
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Vigencia desde
            <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Vigencia hasta
            <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </MobileFiltersPanel>

        <DataTable
          columns={columns}
          rows={filteredItems}
          getRowKey={(item) => item.id}
          loading={loading}
          loadingText="Cargando comunicaciones..."
          emptyText="No hay comunicados con los filtros actuales."
          errorText={errorMessage}
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[640px] sm:min-w-[720px]"
          onRowClick={(item) => setDetailItem(item)}
          renderActions={(item) => (
            <div className="flex justify-end">
              <RowActionsMenu
                ariaLabel={`Acciones para ${item.title}`}
                onView={() => openEdit(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => setPendingDeletion(item)}
              />
            </div>
          )}
        />
      </div>

      <Modal open={createOpen} title={editingItem ? "Editar comunicado" : "Crear comunicado"} onClose={() => setCreateOpen(false)}>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => void handleSave(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Titulo</label>
            <Input {...form.register("title")} placeholder="Corte programado de agua" />
            {form.formState.errors.title ? <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.title.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Mensaje</label>
            <Textarea {...form.register("message")} placeholder="Detalle para residentes" />
            {form.formState.errors.message ? <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.message.message}</p> : null}
          </div>
          <label className="text-sm text-[var(--slate-700)]">
            Estado
            <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("status")}>
              <option value="published">Publicado</option>
              <option value="scheduled">Programado</option>
              <option value="expired">Vencido</option>
              <option value="draft">Borrador</option>
              <option value="archived">Archivado</option>
            </select>
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Vigencia desde
              <Input type="date" {...form.register("startsAt")} />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Vigencia hasta
              <Input type="date" {...form.register("endsAt")} />
            </label>
          </div>
          <div className="space-y-2 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-sm text-[var(--slate-700)]">Adjunto PDF</p>
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-[var(--slate-500)]">{attachmentFile?.name ?? (form.watch("attachmentName") || "Sin adjunto")}</p>
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteDialog
        open={Boolean(pendingDeletion)}
        name={pendingDeletion?.title ?? ""}
        description={
          pendingDeletion
            ? `Esta acción eliminará el comunicado y dejará de mostrarse a los residentes. No se puede deshacer.`
            : null
        }
        loading={deleting}
        onCancel={() => (deleting ? undefined : setPendingDeletion(null))}
        onConfirm={() => void handleConfirmDelete()}
      />

      <Drawer
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        title={detailItem?.title ?? "Comunicado"}
        headerExtra={
          detailItem
            ? (() => {
                const today = new Date().toISOString().slice(0, 10);
                const effectiveStatus =
                  detailItem.status === "draft" || detailItem.status === "archived"
                    ? detailItem.status
                    : detailItem.startsAt && detailItem.startsAt > today
                      ? "scheduled"
                      : detailItem.endsAt && detailItem.endsAt < today
                        ? "expired"
                        : "published";
                return <StatusBadge status={effectiveStatus} context="communication" />;
              })()
            : null
        }
        footer={
          detailItem ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (detailItem) {
                    openEdit(detailItem);
                    setDetailItem(null);
                  }
                }}
              >
                Editar
              </Button>
              <Button type="button" onClick={() => setDetailItem(null)}>
                Cerrar
              </Button>
            </div>
          ) : null
        }
      >
        {detailItem ? (
          <div className="space-y-4 text-sm text-[var(--slate-800)]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Vigencia desde</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{detailItem.startsAt || "Sin definir"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Vigencia hasta</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{detailItem.endsAt || "Sin definir"}</p>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Mensaje</p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--slate-800)]">{detailItem.message}</p>
            </div>
            {detailItem.attachmentUrl ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Adjunto</p>
                <a
                  className="mt-1 inline-flex items-center gap-1 text-[var(--brand-700)] hover:underline"
                  href={detailItem.attachmentUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {detailItem.attachmentName || "Descargar PDF"}
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </Card>
  );
}
