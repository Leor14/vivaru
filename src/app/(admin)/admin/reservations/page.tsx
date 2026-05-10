"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import {
  combineDateAndTime,
  getMinAllowedDateTime,
  isDateTimeValid,
  isSameDay,
  toDateInputValue,
  toTimeInputValue,
} from "@/utils/datetimeValidation";
import { StatusBadge } from "@/components/ui/StatusBadge";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Modal } from "@/components/shared/modal";
import { cn } from "@/lib/utils/cn";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { IconBadge } from "@/components/ui/icon-badge";
import { FilterX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { reservationSchema, type ReservationInput } from "@/features/admin/schemas";
import {
  createAmenity,
  createReservation,
  deleteAmenity,
  deleteReservation,
  disableAmenityAndCancelFutureReservations,
  updateAmenity,
  updateReservation,
  watchAmenities,
  watchReservations,
  watchUnits,
  type AmenityItem,
  type ReservationItem,
  type UnitItem,
} from "@/features/admin/services";

function asDateLabel(value: unknown) {
  if (!value) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null) {
    const candidate = value as { toDate?: () => Date; seconds?: number };
    if (typeof candidate.toDate === "function") return candidate.toDate().toLocaleString();
    if (typeof candidate.seconds === "number") return new Date(candidate.seconds * 1000).toLocaleString();
  }
  return "-";
}
import { useAuth } from "@/features/auth/auth-context";

function debugAdminReservations(message: string, payload: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  console.info(message, payload);
}

export default function AdminReservationsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ReservationItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [amenities, setAmenities] = useState<AmenityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ReservationItem | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAmenity, setSavingAmenity] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "cancelled">("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [amenityFilter, setAmenityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [detailItem, setDetailItem] = useState<ReservationItem | null>(null);
  const [updatingDetailStatus, setUpdatingDetailStatus] = useState(false);
  const [amenityName, setAmenityName] = useState("");
  const [amenityCategory, setAmenityCategory] = useState<AmenityItem["category"]>("social");
  const [pendingDeletion, setPendingDeletion] = useState<ReservationItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pendingAmenityDeletion, setPendingAmenityDeletion] = useState<AmenityItem | null>(null);
  const [deletingAmenity, setDeletingAmenity] = useState(false);
  const [editingAmenity, setEditingAmenity] = useState<AmenityItem | null>(null);
  const [editAmenityName, setEditAmenityName] = useState("");
  const [editAmenityCategory, setEditAmenityCategory] = useState<AmenityItem["category"]>("social");
  const [savingAmenityEdit, setSavingAmenityEdit] = useState(false);
  const [togglingAmenityId, setTogglingAmenityId] = useState<string | null>(null);

  const canEdit = user?.role === "tenant_admin" && user?.status === "active";
  const activeAmenities = useMemo(() => amenities.filter((item) => item.status === "active"), [amenities]);

  const form = useForm<ReservationInput>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      amenityName: "",
      unitId: "",
      reservedBy: user?.fullName ?? "",
      date: "",
      startTime: "18:00",
      endTime: "20:00",
      status: "pending",
      paymentConfirmed: false,
    },
  });

  const selectedDate = form.watch("date");
  const selectedStartTime = form.watch("startTime");
  const nowDateTime = new Date();
  const minReservationDateTime = getMinAllowedDateTime("reservation", nowDateTime);
  const minDateValue = toDateInputValue(nowDateTime);

  const reservationDateTimeError = useMemo(() => {
    if (!selectedDate || !selectedStartTime) return null;

    const selectedDateTime = combineDateAndTime(selectedDate, selectedStartTime);
    if (!selectedDateTime) {
      return "Debes seleccionar una hora futura";
    }

    if (!isDateTimeValid(selectedDateTime, "reservation", nowDateTime)) {
      return "La reserva requiere al menos 30 minutos de anticipacion";
    }

    return null;
  }, [selectedDate, selectedStartTime, nowDateTime]);

  const minStartTimeValue = useMemo(() => {
    if (!selectedDate) return undefined;
    const selectedDateOnly = new Date(`${selectedDate}T00:00:00`);
    if (Number.isNaN(selectedDateOnly.getTime())) return undefined;
    return isSameDay(selectedDateOnly, nowDateTime) ? toTimeInputValue(minReservationDateTime) : undefined;
  }, [selectedDate, nowDateTime, minReservationDateTime]);

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    debugAdminReservations("[admin-reservations] tenant resolved", { tenantId: user.tenantId });

    const unsubReservations = watchReservations(
      user.tenantId,
      (data) => {
        setItems(data);
        setLoading(false);
      },
      (message) => {
        toast.error(message);
        setLoading(false);
      },
    );

    const unsubUnits = watchUnits(
      user.tenantId,
      (data) => {
        setUnits(data);
      },
      (message) => toast.error(message),
    );

    const unsubAmenities = watchAmenities(
      user.tenantId,
      (data) => {
        setAmenities(data);
        debugAdminReservations("[admin-reservations] amenities loaded", {
          tenantId: user.tenantId,
          count: data.length,
          active: data.filter((item) => item.status === "active").length,
        });
      },
      (message) => toast.error(message),
    );

    return () => {
      unsubReservations();
      unsubUnits();
      unsubAmenities();
    };
  }, [user?.tenantId]);

  function openCreate() {
    setEditingItem(null);
    const firstAmenity = activeAmenities[0]?.name ?? "";
    form.reset({
      amenityName: firstAmenity,
      paymentConfirmed: false,
      unitId: units[0]?.id ?? "",
      reservedBy: user?.fullName ?? "",
      date: "",
      startTime: "18:00",
      endTime: "20:00",
      status: "pending",
    });
    setOpenModal(true);
  }

  useEffect(() => {
    const currentValue = form.getValues("amenityName");
    if (currentValue) return;
    if (activeAmenities.length === 0) return;

    form.setValue("amenityName", activeAmenities[0].name, { shouldDirty: false });
  }, [activeAmenities, form]);

  function openEdit(item: ReservationItem) {
    setEditingItem(item);
    form.reset({
      amenityName: item.amenityName,
      unitId: item.unitId,
      reservedBy: item.reservedBy,
      date: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status,
      paymentConfirmed: item.paymentConfirmed ?? false,
    });
    setOpenModal(true);
  }

  async function handleSave(values: ReservationInput) {
    if (!user?.tenantId) return;

    const selectedDateTime = combineDateAndTime(values.date, values.startTime);
    if (!selectedDateTime || !isDateTimeValid(selectedDateTime, "reservation")) {
      toast.error("La reserva requiere al menos 30 minutos de anticipacion.");
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await updateReservation(editingItem.id, user.uid, values);
        toast.success("Reserva actualizada.");
      } else {
        await createReservation(user.tenantId, user.uid, values);
        toast.success("Reserva registrada.");
      }
      setOpenModal(false);
    } catch (createError) {
      toastFirebaseError(createError);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAmenity() {
    if (!user?.tenantId) {
      toast.error("No se pudo identificar el tenant de tu sesion.");
      return;
    }

    const cleanName = amenityName.trim();
    if (!cleanName) {
      toast.error("Ingresa un nombre valido para la amenidad.");
      return;
    }

    if (cleanName.length < 3) {
      toast.error("El nombre de la amenidad debe tener al menos 3 caracteres.");
      return;
    }

    if (savingAmenity) return;

    setSavingAmenity(true);
    try {
      await createAmenity(user.tenantId, user.uid, {
        name: cleanName,
        category: amenityCategory,
        status: "active",
      });
      setAmenityName("");
      toast.success("Amenidad creada.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingAmenity(false);
    }
  }

  async function handleDeleteAmenity(item: AmenityItem) {
    setPendingAmenityDeletion(item);
  }

  async function handleConfirmDeleteAmenity() {
    if (!pendingAmenityDeletion) return;
    const target = pendingAmenityDeletion;
    setDeletingAmenity(true);
    try {
      await deleteAmenity(target.id);
      toast.success("Amenidad eliminada.");
      setPendingAmenityDeletion(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setDeletingAmenity(false);
    }
  }

  function handleEditAmenity(item: AmenityItem) {
    setEditingAmenity(item);
    setEditAmenityName(item.name);
    setEditAmenityCategory(item.category);
  }

  async function handleSaveAmenityEdit() {
    if (!editingAmenity || !user?.uid) return;
    const cleanName = editAmenityName.trim();
    if (!cleanName) {
      toast.error("Ingresa un nombre válido.");
      return;
    }
    setSavingAmenityEdit(true);
    try {
      await updateAmenity(editingAmenity.id, user.uid, {
        name: cleanName,
        category: editAmenityCategory,
      });
      toast.success("Amenidad actualizada.");
      setEditingAmenity(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingAmenityEdit(false);
    }
  }

  async function handleToggleAmenityStatus(item: AmenityItem) {
    if (!user?.tenantId || !user?.uid) return;
    setTogglingAmenityId(item.id);
    try {
      if (item.status === "active") {
        const result = await disableAmenityAndCancelFutureReservations({
          amenityName: item.name,
          amenityId: item.id,
          tenantId: user.tenantId,
          userId: user.uid,
        });
        toast.success(`Amenidad deshabilitada. Reservas afectadas: ${result.affectedReservations}.`);
      } else {
        await updateAmenity(item.id, user.uid, { status: "active" });
        toast.success("Amenidad habilitada.");
      }
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setTogglingAmenityId(null);
    }
  }

  async function handleDelete(item: ReservationItem) {
    setPendingDeletion(item);
  }

  async function handleConfirmDelete() {
    if (!pendingDeletion) return;
    const target = pendingDeletion;
    setDeleting(true);
    try {
      await deleteReservation(target.id);
      toast.success("Reserva eliminada.");
      setPendingDeletion(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setDeleting(false);
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const statusMatches = statusFilter === "all" ? true : item.status === statusFilter;
      const unitMatches = unitFilter === "all" ? true : item.unitId === unitFilter;
      const amenityMatches = amenityFilter === "all" ? true : item.amenityName === amenityFilter;
      const fromOk = !dateFrom ? true : (item.date ?? "") >= dateFrom;
      const toOk = !dateTo ? true : (item.date ?? "") <= dateTo;
      return statusMatches && unitMatches && amenityMatches && fromOk && toOk;
    });
  }, [items, statusFilter, unitFilter, amenityFilter, dateFrom, dateTo]);

  const activeFiltersCount =
    (statusFilter !== "all" ? 1 : 0) +
    (unitFilter !== "all" ? 1 : 0) +
    (amenityFilter !== "all" ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const columns: DataTableColumn<ReservationItem>[] = [
    {
      key: "amenity",
      header: "Amenidad",
      render: (item) => <span className="font-medium text-[var(--slate-900)]">{item.amenityName}</span>,
    },
    {
      key: "unit",
      header: "Unidad",
      render: (item) => units.find((unit) => unit.id === item.unitId)?.displayName ?? item.unitId,
    },
    {
      key: "reservedBy",
      header: "Reservado por",
      render: (item) => item.reservedBy,
    },
    {
      key: "date",
      header: "Fecha",
      render: (item) => asDateLabel(item.date),
    },
    {
      key: "startTime",
      header: "Inicio",
      render: (item) => item.startTime,
      mobileHidden: true,
    },
    {
      key: "endTime",
      header: "Fin",
      render: (item) => item.endTime,
      mobileHidden: true,
    },
    {
      key: "status",
      header: "Estado",
      render: (item) => <StatusBadge status={item.status} context="reservation" />,
    },
    {
      key: "paymentConfirmed",
      header: "Abono",
      render: (item) => (item.paymentConfirmed ? "Pagado" : "Pendiente"),
    },
  ];

  return (
    <Card>
      {canEdit ? (
        <div className="mb-4 rounded-2xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="text-sm font-semibold text-[var(--slate-900)]">Gestión de amenidades</p>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_180px_auto]">
            <Input value={amenityName} onChange={(event) => setAmenityName(event.target.value)} placeholder="Nombre de amenidad" />
            <select className="h-10 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={amenityCategory} onChange={(event) => setAmenityCategory(event.target.value as AmenityItem["category"])}>
              <option value="social">Social</option>
              <option value="sports">Deportes</option>
              <option value="wellness">Bienestar</option>
              <option value="business">Negocios</option>
              <option value="other">Otro</option>
            </select>
            <Button onClick={() => void handleCreateAmenity()} disabled={savingAmenity || !amenityName.trim()}>
              {savingAmenity ? "Agregando..." : "Agregar +"}
            </Button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {amenities.map((item) => {
              const isActive = item.status === "active";
              const isToggling = togglingAmenityId === item.id;
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--slate-200)] bg-white p-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium text-[var(--slate-900)]">{item.name}</span>
                    <StatusBadge status={item.status} context="amenity" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isActive}
                      aria-label={`${isActive ? "Deshabilitar" : "Habilitar"} amenidad ${item.name}`}
                      disabled={isToggling}
                      onClick={() => void handleToggleAmenityStatus(item)}
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition disabled:opacity-50",
                        isActive ? "bg-[var(--slate-900)]" : "bg-[var(--slate-300)]",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
                          isActive ? "translate-x-4" : "translate-x-0.5",
                        )}
                      />
                    </button>
                    <RowActionsMenu
                      ariaLabel={`Acciones de ${item.name}`}
                      items={[
                        { key: "edit", label: "Editar amenidad", onSelect: () => handleEditAmenity(item) },
                        { key: "delete", label: "Eliminar amenidad", danger: true, separatorBefore: true, onSelect: () => void handleDeleteAmenity(item) },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Reservas de zonas comunes</CardTitle>
          <CardDescription className="mt-1">Creación, edicion y cancelacion con refresco inmediato en tabla.</CardDescription>
        </div>
        {canEdit ? (
          <Button className="w-full sm:w-auto" onClick={openCreate} disabled={activeAmenities.length === 0}>
            Crear reserva
          </Button>
        ) : null}
      </div>
      <div className="mt-4 space-y-3">
        <MobileFiltersPanel
          title="Filtros de reservas"
          collapsibleOnDesktop
          defaultOpen={false}
          activeFiltersCount={activeFiltersCount}
          openLabel="Mostrar filtros"
          closeLabel="Ocultar filtros"
          footer={
            <Button
              className="w-full md:w-auto"
              type="button"
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setUnitFilter("all");
                setAmenityFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              <IconBadge tone="sand" className="mr-2">
                <FilterX className="h-3.5 w-3.5" />
              </IconBadge>
              Limpiar filtros
            </Button>
          }
        >
          <label className="text-sm text-[var(--slate-700)]">
            Estado
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "pending" | "approved" | "cancelled")}
            >
              <option value="all">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="approved">Aprobada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Unidad
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Amenidad
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={amenityFilter}
              onChange={(event) => setAmenityFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              {amenities.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Desde
            <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Hasta
            <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </MobileFiltersPanel>

        <DataTable
          columns={columns}
          rows={filteredItems}
          getRowKey={(item) => item.id}
          loading={loading}
          loadingText="Cargando reservas..."
          emptyText="No hay reservas con los filtros actuales."
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[760px] sm:min-w-[920px]"
          onRowClick={(item) => setDetailItem(item)}
          renderActions={canEdit ? (item) => (
            <div className="flex justify-end">
              <RowActionsMenu
                ariaLabel={`Acciones para reserva de ${item.amenityName}`}
                onView={() => openEdit(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => void handleDelete(item)}
              />
            </div>
          ) : undefined}
        />
      </div>

      <Modal open={openModal} title={editingItem ? "Editar reserva" : "Crear reserva"} onClose={() => setOpenModal(false)}>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => void handleSave(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Amenidad</label>
            <select className="h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("amenityName")}>
              {activeAmenities.length === 0 ? <option value="">No hay amenidades activas</option> : null}
              {activeAmenities.map((item) => (
                <option key={item.id} value={item.name}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Unidad (ID o etiqueta)
              <Input
                list="reservation-units"
                {...form.register("unitId")}
                placeholder="T1-101 o u-t1-101"
              />
              <datalist id="reservation-units">
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.displayName}</option>
                ))}
              </datalist>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Reservado por
              <Input {...form.register("reservedBy")} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-[var(--slate-700)]">
              Fecha
              <Input type="date" min={minDateValue} {...form.register("date")} />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Hora inicio
              <Input type="time" min={minStartTimeValue} {...form.register("startTime")} />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Hora fin
              <Input type="time" {...form.register("endTime")} />
            </label>
          </div>
          <label className="text-sm text-[var(--slate-700)]">
            Estado
            <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("status")}>
              <option value="pending">Pendiente</option>
              <option value="approved">Aprobada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-[var(--slate-700)]">
            <input type="checkbox" {...form.register("paymentConfirmed")} />
            Abono de reserva confirmado
          </label>
          {form.formState.errors.endTime ? <p className="text-xs text-[var(--danger-700)]">{form.formState.errors.endTime.message}</p> : null}
          {reservationDateTimeError ? <p className="text-xs text-[var(--danger-700)]">{reservationDateTimeError}</p> : null}
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={saving || Boolean(reservationDateTimeError)}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDeleteDialog
        open={Boolean(pendingDeletion)}
        name={pendingDeletion ? `reserva de ${pendingDeletion.amenityName}` : ""}
        description={
          pendingDeletion
            ? `Esta acción cancelará y eliminará la reserva del ${asDateLabel(pendingDeletion.date)} a las ${pendingDeletion.startTime}. No se puede deshacer.`
            : null
        }
        loading={deleting}
        onCancel={() => (deleting ? undefined : setPendingDeletion(null))}
        onConfirm={() => void handleConfirmDelete()}
      />

      <ConfirmDeleteDialog
        open={Boolean(pendingAmenityDeletion)}
        name={pendingAmenityDeletion ? `amenidad ${pendingAmenityDeletion.name}` : ""}
        description={
          pendingAmenityDeletion
            ? "Esta acción elimina la amenidad de forma permanente. No se puede deshacer."
            : null
        }
        loading={deletingAmenity}
        onCancel={() => (deletingAmenity ? undefined : setPendingAmenityDeletion(null))}
        onConfirm={() => void handleConfirmDeleteAmenity()}
      />

      <Modal
        open={Boolean(editingAmenity)}
        onClose={() => (savingAmenityEdit ? undefined : setEditingAmenity(null))}
        title="Editar amenidad"
      >
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--slate-700)]">Nombre</span>
            <Input
              value={editAmenityName}
              onChange={(event) => setEditAmenityName(event.target.value)}
              placeholder="Nombre de amenidad"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-[var(--slate-700)]">Categoría</span>
            <select
              className="h-10 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={editAmenityCategory}
              onChange={(event) => setEditAmenityCategory(event.target.value as AmenityItem["category"])}
            >
              <option value="social">Social</option>
              <option value="sports">Deportes</option>
              <option value="wellness">Bienestar</option>
              <option value="business">Negocios</option>
              <option value="other">Otro</option>
            </select>
          </label>
          <div className="mobile-action-group">
            <Button
              className="w-full sm:w-auto"
              type="button"
              variant="outline"
              onClick={() => setEditingAmenity(null)}
              disabled={savingAmenityEdit}
            >
              Cancelar
            </Button>
            <Button
              className="w-full sm:w-auto"
              type="button"
              onClick={() => void handleSaveAmenityEdit()}
              disabled={savingAmenityEdit || !editAmenityName.trim()}
            >
              {savingAmenityEdit ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>

      <Drawer
        open={Boolean(detailItem)}
        onClose={() => setDetailItem(null)}
        title={detailItem ? `Reserva: ${detailItem.amenityName}` : "Reserva"}
        headerExtra={
          detailItem ? <StatusBadge status={detailItem.status} context="reservation" /> : null
        }
        footer={
          detailItem ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canEdit && detailItem.status === "pending" ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={updatingDetailStatus}
                    onClick={async () => {
                      if (!user?.uid || !detailItem) return;
                      setUpdatingDetailStatus(true);
                      try {
                        await updateReservation(detailItem.id, user.uid, { status: "cancelled" });
                        toast.success("Reserva rechazada.");
                        setDetailItem(null);
                      } catch (error) {
                        toastFirebaseError(error);
                      } finally {
                        setUpdatingDetailStatus(false);
                      }
                    }}
                  >
                    Rechazar
                  </Button>
                  <Button
                    type="button"
                    disabled={updatingDetailStatus}
                    onClick={async () => {
                      if (!user?.uid || !detailItem) return;
                      setUpdatingDetailStatus(true);
                      try {
                        await updateReservation(detailItem.id, user.uid, { status: "approved" });
                        toast.success("Reserva aprobada.");
                        setDetailItem(null);
                      } catch (error) {
                        toastFirebaseError(error);
                      } finally {
                        setUpdatingDetailStatus(false);
                      }
                    }}
                  >
                    Aprobar
                  </Button>
                </>
              ) : null}
              {canEdit && detailItem.status === "approved" ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={updatingDetailStatus}
                  onClick={async () => {
                    if (!user?.uid || !detailItem) return;
                    setUpdatingDetailStatus(true);
                    try {
                      await updateReservation(detailItem.id, user.uid, { status: "cancelled" });
                      toast.success("Reserva cancelada.");
                      setDetailItem(null);
                    } catch (error) {
                      toastFirebaseError(error);
                    } finally {
                      setUpdatingDetailStatus(false);
                    }
                  }}
                >
                  Cancelar reserva
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => setDetailItem(null)}>
                Cerrar
              </Button>
            </div>
          ) : null
        }
      >
        {detailItem ? (
          <div className="space-y-3 text-sm text-[var(--slate-800)]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Unidad</p>
                <p className="mt-0.5 text-[var(--slate-900)]">
                  {units.find((unit) => unit.id === detailItem.unitId)?.displayName ?? detailItem.unitId}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Reservado por</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{detailItem.reservedBy}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Fecha</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{asDateLabel(detailItem.date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Horario</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{detailItem.startTime} - {detailItem.endTime}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Abono</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{detailItem.paymentConfirmed ? "Pagado" : "Pendiente"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Amenidad</p>
                <p className="mt-0.5 text-[var(--slate-900)]">{detailItem.amenityName}</p>
              </div>
            </div>
            {detailItem.cancellationReason ? (
              <div className="rounded-xl border border-[var(--danger-200)] bg-[var(--danger-50)] p-3">
                <p className="text-xs uppercase tracking-wide text-[var(--danger-700)]">Motivo de cancelacion</p>
                <p className="mt-1 text-[var(--danger-700)]">{detailItem.cancellationReason}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </Card>
  );
}
