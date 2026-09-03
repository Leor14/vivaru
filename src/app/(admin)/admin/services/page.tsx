"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FilterX, Plus, ToggleLeft, ToggleRight } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { serviceSchema, type ServiceInput } from "@/features/admin/schemas";
import { normalizeTower } from "@/utils/tower";
import { buildUnitIndex, resolveUnitName } from "@/utils/unitLabel";
import {
  createService,
  deleteService,
  updateService,
  uploadServiceAttachment,
  uploadServiceImage,
  watchServices,
  watchUnits,
  type ServiceItem,
  type UnitItem,
} from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";
import { useGuidedAction } from "@/features/onboarding/guided-action";

const CATEGORY_LABELS: Record<ServiceItem["category"], string> = {
  resident_offer: "Oferta residente",
  third_party: "Servicio externo",
};

export default function AdminServicesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ServiceItem | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Enganche del recorrido guiado (src/lib/onboarding/steps.ts).
  useGuidedAction("servicios", () => setCreateOpen(true));
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | ServiceItem["category"]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [detailItem, setDetailItem] = useState<ServiceItem | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<ServiceItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "resident_offer",
      serviceType: "",
      providerName: "",
      providerContact: "",
      unitId: "",
      imageUrl: "",
      imagePath: "",
      attachmentUrl: "",
      attachmentName: "",
      attachmentPath: "",
      status: "active",
    },
  });

  const watchedCategory = form.watch("category");

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    const unsub = watchServices(
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

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub = watchUnits(
      user.tenantId,
      (data) => setUnits(data),
      () => undefined,
    );
    return () => unsub();
  }, [user?.tenantId]);

  function openCreate() {
    setEditingItem(null);
    setImageFile(null);
    setImagePreview(null);
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    form.reset({
      title: "",
      description: "",
      category: "resident_offer",
      serviceType: "",
      providerName: "",
      providerContact: "",
      unitId: "",
      imageUrl: "",
      imagePath: "",
      attachmentUrl: "",
      attachmentName: "",
      attachmentPath: "",
      status: "active",
    });
    setCreateOpen(true);
  }

  function openEdit(item: ServiceItem) {
    setEditingItem(item);
    setImageFile(null);
    setImagePreview(item.imageUrl ?? null);
    setAttachmentFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    form.reset({
      title: item.title,
      description: item.description,
      category: item.category,
      serviceType: item.serviceType,
      providerName: item.providerName,
      providerContact: item.providerContact,
      unitId: item.unitId ?? "",
      imageUrl: item.imageUrl ?? "",
      imagePath: item.imagePath ?? "",
      attachmentUrl: item.attachmentUrl ?? "",
      attachmentName: item.attachmentName ?? "",
      attachmentPath: item.attachmentPath ?? "",
      status: item.status,
    });
    setCreateOpen(true);
  }

  async function handleSave(values: ServiceInput) {
    if (!user?.tenantId) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const tempId = editingItem?.id ?? `new-${Date.now()}`;
      let imageUrl = values.imageUrl;
      let imagePath = values.imagePath;

      if (imageFile) {
        const uploaded = await uploadServiceImage({
          tenantId: user.tenantId,
          serviceId: tempId,
          file: imageFile,
        });
        imageUrl = uploaded.imageUrl;
        imagePath = uploaded.storagePath;
      }

      let attachmentUrl = values.attachmentUrl;
      let attachmentName = values.attachmentName;
      let attachmentPath = values.attachmentPath;

      if (attachmentFile) {
        const uploaded = await uploadServiceAttachment({
          tenantId: user.tenantId,
          serviceId: tempId,
          file: attachmentFile,
        });
        attachmentUrl = uploaded.attachmentUrl;
        attachmentName = uploaded.attachmentName;
        attachmentPath = uploaded.storagePath;
      }

      // Build payload without undefined fields — Firestore rejects undefined values
      type ServicePayload = Pick<ServiceItem, "title" | "description" | "category" | "serviceType" | "providerName" | "providerContact" | "status"> &
        Partial<Pick<ServiceItem, "unitId" | "imageUrl" | "imagePath" | "attachmentUrl" | "attachmentName" | "attachmentPath">>;
      const payload: ServicePayload = {
        title: values.title,
        description: values.description,
        category: values.category,
        serviceType: values.serviceType,
        providerName: values.providerName,
        providerContact: values.providerContact,
        status: values.status,
        ...(values.category === "resident_offer" && values.unitId ? { unitId: values.unitId } : {}),
        ...(imageUrl ? { imageUrl } : {}),
        ...(imagePath ? { imagePath } : {}),
        ...(attachmentUrl ? { attachmentUrl } : {}),
        ...(attachmentName ? { attachmentName } : {}),
        ...(attachmentPath ? { attachmentPath } : {}),
      };

      if (editingItem) {
        await updateService(editingItem.id, user.uid, payload);
        toast.success("Servicio actualizado.");
      } else {
        await createService(user.tenantId, user.uid, payload);
        toast.success("Servicio creado.");
      }
      setCreateOpen(false);
    } catch (saveError) {
      setErrorMessage(saveError instanceof Error ? saveError.message : "No fue posible guardar el servicio.");
      toastFirebaseError(saveError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(item: ServiceItem) {
    if (!user?.uid) return;
    setTogglingId(item.id);
    try {
      const newStatus = item.status === "active" ? "inactive" : "active";
      await updateService(item.id, user.uid, { status: newStatus });
      toast.success(newStatus === "active" ? "Servicio activado." : "Servicio desactivado.");
    } catch (toggleError) {
      toastFirebaseError(toggleError);
    } finally {
      setTogglingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeletion) return;
    const target = pendingDeletion;
    setDeleting(true);
    setErrorMessage(null);
    try {
      await deleteService(target.id);
      toast.success("Servicio eliminado.");
      setPendingDeletion(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible eliminar.");
      toastFirebaseError(error);
    } finally {
      setDeleting(false);
    }
  }

  const unitIndex = useMemo(() => buildUnitIndex(units), [units]);

  const filteredItems = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = categoryFilter === "all" ? true : item.category === categoryFilter;
      const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
      const matchesSearch =
        q.length === 0
          ? true
          : `${item.title} ${item.providerName} ${item.serviceType}`.toLowerCase().includes(q);
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [items, categoryFilter, statusFilter, searchFilter]);

  const activeFiltersCount =
    (categoryFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (searchFilter.trim() ? 1 : 0);

  const columns: DataTableColumn<ServiceItem>[] = [
    {
      key: "title",
      header: "Titulo",
      render: (item) => <span className="font-medium text-[var(--slate-900)]">{item.title}</span>,
    },
    {
      key: "category",
      header: "Categoria",
      render: (item) => (
        <span className="rounded-full border border-[var(--slate-200)] bg-[var(--slate-50)] px-2 py-0.5 text-xs text-[var(--slate-700)]">
          {CATEGORY_LABELS[item.category]}
        </span>
      ),
    },
    {
      key: "serviceType",
      header: "Tipo",
      render: (item) => <span className="text-[var(--slate-700)]">{item.serviceType}</span>,
    },
    {
      key: "providerName",
      header: "Proveedor",
      render: (item) => <span className="text-[var(--slate-700)]">{item.providerName}</span>,
    },
    {
      key: "status",
      header: "Estado",
      render: (item) => <StatusBadge status={item.status} context="amenity" />,
    },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle help="Publica servicios disponibles para la comunidad: ofertas de residentes y servicios externos de confianza. Los residentes pueden consultarlos desde su portal.">
            Servicios comunitarios
          </CardTitle>
          <CardDescription className="mt-1">Directorio de servicios disponibles para la comunidad.</CardDescription>
        </div>
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          <IconBadge tone="mint" className="mr-2">
            <Plus className="h-4 w-4" />
          </IconBadge>
          Agregar servicio
        </Button>
      </div>
      {errorMessage ? <p className="mt-2 text-xs text-[var(--danger-700)]">{errorMessage}</p> : null}

      <div className="mt-4 space-y-3">
        <MobileFiltersPanel
          title="Filtros de servicios"
          activeFiltersCount={activeFiltersCount}
          collapsibleOnDesktop={true}
          footer={
            <Button
              className="w-full md:w-auto"
              type="button"
              variant="outline"
              onClick={() => {
                setCategoryFilter("all");
                setStatusFilter("all");
                setSearchFilter("");
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
              placeholder="Titulo, proveedor o tipo"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
            />
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Categoria
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as "all" | ServiceItem["category"])}
            >
              <option value="all">Todas</option>
              <option value="resident_offer">Oferta residente</option>
              <option value="third_party">Servicio externo</option>
            </select>
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Estado
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
            >
              <option value="all">Todos</option>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </label>
        </MobileFiltersPanel>

        <DataTable
          columns={columns}
          rows={filteredItems}
          getRowKey={(item) => item.id}
          loading={loading}
          loadingText="Cargando servicios..."
          emptyText="No hay servicios con los filtros actuales."
          errorText={errorMessage}
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[640px] sm:min-w-[800px]"
          onRowClick={(item) => setDetailItem(item)}
          renderActions={(item) => (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                aria-label={item.status === "active" ? "Desactivar servicio" : "Activar servicio"}
                title={item.status === "active" ? "Desactivar" : "Activar"}
                disabled={togglingId === item.id}
                onClick={(event) => {
                  event.stopPropagation();
                  void handleToggleStatus(item);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--slate-600)] transition-colors hover:bg-[var(--slate-100)] disabled:opacity-50"
              >
                {item.status === "active" ? (
                  <ToggleRight className="h-4 w-4 text-[var(--success-600)]" />
                ) : (
                  <ToggleLeft className="h-4 w-4" />
                )}
              </button>
              <RowActionsMenu
                ariaLabel={`Acciones para ${item.title}`}
                onView={() => setDetailItem(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => setPendingDeletion(item)}
              />
            </div>
          )}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={createOpen}
        title={editingItem ? "Editar servicio" : "Agregar servicio"}
        onClose={() => setCreateOpen(false)}
      >
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => void handleSave(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Titulo</label>
            <Input {...form.register("title")} placeholder="Servicio de plomeria" />
            {form.formState.errors.title ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.title.message}</p>
            ) : null}
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Descripción</label>
            <Textarea {...form.register("description")} placeholder="Describe el servicio disponible para la comunidad" />
            {form.formState.errors.description ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.description.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Categoria
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                {...form.register("category")}
              >
                <option value="resident_offer">Oferta residente</option>
                <option value="third_party">Servicio externo</option>
              </select>
              {form.formState.errors.category ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.category.message}</p>
              ) : null}
            </label>

            <label className="text-sm text-[var(--slate-700)]">
              Estado
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                {...form.register("status")}
              >
                <option value="active">Activo</option>
                <option value="inactive">Inactivo</option>
              </select>
            </label>
          </div>

          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Tipo de servicio</label>
            <Input {...form.register("serviceType")} placeholder="Plomeria, electricidad, jardineria..." />
            {form.formState.errors.serviceType ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.serviceType.message}</p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre del proveedor</label>
              <Input {...form.register("providerName")} placeholder="Juan Perez o Empresa S.A.S." />
              {form.formState.errors.providerName ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.providerName.message}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Contacto</label>
              <Input {...form.register("providerContact")} placeholder="3001234567 o correo@ejemplo.com" />
              {form.formState.errors.providerContact ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.providerContact.message}</p>
              ) : null}
            </div>
          </div>

          {watchedCategory === "resident_offer" ? (
            <label className="text-sm text-[var(--slate-700)]">
              Unidad (opcional)
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                {...form.register("unitId")}
              >
                <option value="">Sin unidad específica</option>
                {units
                  .filter((u) => u.status === "active")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} — {normalizeTower(u.tower) || u.tower}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}

          <div className="space-y-2 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-sm font-medium text-[var(--slate-700)]">Imagen de portada <span className="font-normal text-[var(--slate-500)]">(opcional)</span></p>
            <p className="text-xs text-[var(--slate-500)]">Se muestra como imagen principal del servicio en el portal del residente.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setImageFile(file);
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => setImagePreview(reader.result as string);
                  reader.readAsDataURL(file);
                } else {
                  setImagePreview(editingItem?.imageUrl ?? null);
                }
              }}
            />
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Vista previa de portada"
                className="mt-2 h-24 w-24 rounded-lg object-cover"
              />
            ) : null}
            <p className="text-xs text-[var(--slate-500)]">
              {imageFile?.name ?? (form.watch("imageUrl") ? "Imagen guardada" : "Sin imagen")}
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-sm font-medium text-[var(--slate-700)]">Información adicional <span className="font-normal text-[var(--slate-500)]">(opcional)</span></p>
            <p className="text-xs text-[var(--slate-500)]">Sube un PDF o imagen con detalles del servicio (tarifas, carta, menú, etc.). El residente podrá verlo en el portal.</p>
            <input
              ref={attachmentInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setAttachmentFile(file);
              }}
            />
            <p className="text-xs text-[var(--slate-500)]">
              {attachmentFile?.name ?? (form.watch("attachmentName") ? form.watch("attachmentName") : "Sin archivo")}
            </p>
          </div>

          {errorMessage ? (
            <p className="rounded-lg bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">{errorMessage}</p>
          ) : null}

          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm delete */}
      <ConfirmDeleteDialog
        open={Boolean(pendingDeletion)}
        name={pendingDeletion?.title ?? ""}
        description={
          pendingDeletion
            ? "Esta acción eliminará el servicio del directorio comunitario. No se puede deshacer."
            : null
        }
        loading={deleting}
        onCancel={() => (deleting ? undefined : setPendingDeletion(null))}
        onConfirm={() => void handleConfirmDelete()}
      />

      {/* Detail drawer */}
      <Drawer
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        title={detailItem?.title ?? "Servicio"}
        headerExtra={detailItem ? <StatusBadge status={detailItem.status} context="amenity" /> : null}
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
            {detailItem.imageUrl ? (
              <img
                src={detailItem.imageUrl}
                alt={detailItem.title}
                className="h-40 w-full rounded-xl object-cover"
              />
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Categoria</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{CATEGORY_LABELS[detailItem.category]}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Tipo</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{detailItem.serviceType}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Proveedor</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{detailItem.providerName}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Contacto</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{detailItem.providerContact}</p>
              </div>
            </div>

            {detailItem.unitId ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Unidad</p>
                <p className="mt-0.5 text-[var(--slate-900)]">
                  {resolveUnitName(detailItem.unitId, unitIndex)}
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Descripción</p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--slate-800)]">{detailItem.description}</p>
            </div>

            {detailItem.attachmentUrl ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Información adicional</p>
                {detailItem.attachmentName?.toLowerCase().endsWith(".pdf") ? (
                  <a
                    href={detailItem.attachmentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-2 rounded-lg border border-[var(--brand-200)] bg-[var(--brand-50)] px-3 py-1.5 text-sm font-medium text-[var(--brand-700)] hover:bg-[var(--brand-100)]"
                  >
                    📄 {detailItem.attachmentName}
                  </a>
                ) : (
                  <img
                    src={detailItem.attachmentUrl}
                    alt={detailItem.attachmentName ?? "Adjunto"}
                    className="mt-1.5 max-h-56 w-full rounded-xl object-contain"
                  />
                )}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </Card>
  );
}
