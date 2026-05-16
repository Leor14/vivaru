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
  uploadAmenityPhoto,
  watchAmenities,
  watchReservations,
  watchUnits,
  type AmenityItem,
  type AmenityPhoto,
  type ReservationItem,
  type UnitItem,
} from "@/features/admin/services";
import { AmenityPhotoManager } from "@/components/features/reservations/AmenityPhotoManager";

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
  const [amenityPanelOpen, setAmenityPanelOpen] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);

  // Create amenity config state
  const [amenityOperatingStart, setAmenityOperatingStart] = useState("");
  const [amenityOperatingEnd, setAmenityOperatingEnd] = useState("");
  const [amenitySlotDuration, setAmenitySlotDuration] = useState("");
  const [amenityWeekdays, setAmenityWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [amenityMaxPerSlot, setAmenityMaxPerSlot] = useState("");
  const [amenityMaxDuration, setAmenityMaxDuration] = useState("");
  const [amenityMaxPerMonth, setAmenityMaxPerMonth] = useState("");
  const [amenityUsageRules, setAmenityUsageRules] = useState("");
  // Edit amenity config state
  const [editAmenityOperatingStart, setEditAmenityOperatingStart] = useState("");
  const [editAmenityOperatingEnd, setEditAmenityOperatingEnd] = useState("");
  const [editAmenitySlotDuration, setEditAmenitySlotDuration] = useState("");
  const [editAmenityWeekdays, setEditAmenityWeekdays] = useState<number[]>([]);
  const [editAmenityMaxPerSlot, setEditAmenityMaxPerSlot] = useState("");
  const [editAmenityMaxDuration, setEditAmenityMaxDuration] = useState("");
  const [editAmenityMaxPerMonth, setEditAmenityMaxPerMonth] = useState("");
  const [editAmenityUsageRules, setEditAmenityUsageRules] = useState("");

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
      return "La reserva requiere al menos 30 minutos de anticipación";
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
      toast.error("La reserva requiere al menos 30 minutos de anticipación.");
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
      toast.error("No se pudo identificar el tenant de tu sesión.");
      return;
    }

    const cleanName = amenityName.trim();
    if (!cleanName) {
      toast.error("Ingresa un nombre válido para la amenidad.");
      return;
    }

    if (cleanName.length < 3) {
      toast.error("El nombre de la amenidad debe tener al menos 3 caracteres.");
      return;
    }

    if (savingAmenity) return;

    setSavingAmenity(true);
    try {
      const newAmenityId = await createAmenity(user.tenantId, user.uid, {
        name: cleanName,
        category: amenityCategory,
        status: "active",
        ...(amenityWeekdays.length > 0 && { availableWeekdays: amenityWeekdays }),
        ...(amenityOperatingStart && { operatingHoursStart: amenityOperatingStart }),
        ...(amenityOperatingEnd && { operatingHoursEnd: amenityOperatingEnd }),
        ...(amenitySlotDuration && { slotDurationMinutes: Number(amenitySlotDuration) }),
        ...(amenityMaxPerSlot && { maxReservationsPerSlot: Number(amenityMaxPerSlot) }),
        ...(amenityMaxDuration && { maxReservationDurationMinutes: Number(amenityMaxDuration) }),
        ...(amenityMaxPerMonth !== "" && { maxReservationsPerUnitPerMonth: Number(amenityMaxPerMonth) }),
        ...(amenityUsageRules.trim() && { usageRules: amenityUsageRules.trim() }),
      });
      if (pendingPhotos.length > 0) {
        for (const file of pendingPhotos) {
          await uploadAmenityPhoto(user.tenantId, newAmenityId, file);
        }
      }
      setAmenityName("");
      setAmenityOperatingStart("");
      setAmenityOperatingEnd("");
      setAmenitySlotDuration("");
      setAmenityWeekdays([0, 1, 2, 3, 4, 5, 6]);
      setAmenityMaxPerSlot("");
      setAmenityMaxDuration("");
      setAmenityMaxPerMonth("");
      setAmenityUsageRules("");
      setPendingPhotos([]);
      setAmenityPanelOpen(false);
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
    setEditAmenityWeekdays(item.availableWeekdays ?? []);
    setEditAmenityOperatingStart(item.operatingHoursStart ?? "");
    setEditAmenityOperatingEnd(item.operatingHoursEnd ?? "");
    setEditAmenitySlotDuration(item.slotDurationMinutes !== undefined ? String(item.slotDurationMinutes) : "");
    setEditAmenityMaxPerSlot(item.maxReservationsPerSlot !== undefined ? String(item.maxReservationsPerSlot) : "");
    setEditAmenityMaxDuration(item.maxReservationDurationMinutes !== undefined ? String(item.maxReservationDurationMinutes) : "");
    setEditAmenityMaxPerMonth(item.maxReservationsPerUnitPerMonth !== undefined ? String(item.maxReservationsPerUnitPerMonth) : "");
    setEditAmenityUsageRules(item.usageRules ?? "");
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
        availableWeekdays: editAmenityWeekdays,
        ...(editAmenityOperatingStart && { operatingHoursStart: editAmenityOperatingStart }),
        ...(editAmenityOperatingEnd && { operatingHoursEnd: editAmenityOperatingEnd }),
        ...(editAmenitySlotDuration && { slotDurationMinutes: Number(editAmenitySlotDuration) }),
        ...(editAmenityMaxPerSlot && { maxReservationsPerSlot: Number(editAmenityMaxPerSlot) }),
        ...(editAmenityMaxDuration && { maxReservationDurationMinutes: Number(editAmenityMaxDuration) }),
        ...(editAmenityMaxPerMonth !== "" && { maxReservationsPerUnitPerMonth: Number(editAmenityMaxPerMonth) }),
        usageRules: editAmenityUsageRules.trim() || undefined,
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
      header: "Unidad / Reservado por",
      render: (item) => {
        const displayName = units.find((unit) => unit.id === item.unitId)?.displayName ?? item.unitId;
        return (
          <span>
            <span className="block text-[var(--slate-900)]">{item.reservedBy || "—"}</span>
            <span className="block text-[11px] text-[var(--slate-500)]">{displayName}</span>
          </span>
        );
      },
    },
    {
      key: "date",
      header: "Fecha",
      render: (item) => {
        if (!item.date || typeof item.date !== "string") return asDateLabel(item.date);
        const [year, month, day] = item.date.split("-").map(Number);
        if (!year || !month || !day) return item.date;
        return new Date(year, month - 1, day).toLocaleDateString("es-CO", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      },
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
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[var(--slate-700)]">Amenidades</h3>
            <Button size="sm" onClick={() => setAmenityPanelOpen(true)}>+ Nueva amenidad</Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
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
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50",
                        isActive ? "bg-[var(--slate-900)]" : "bg-[var(--slate-300)]",
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
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

      <Drawer
        open={amenityPanelOpen}
        onClose={() => {
          if (savingAmenity) return;
          setAmenityPanelOpen(false);
          setAmenityName("");
          setAmenityCategory("social");
          setAmenityOperatingStart("");
          setAmenityOperatingEnd("");
          setAmenitySlotDuration("");
          setAmenityWeekdays([0, 1, 2, 3, 4, 5, 6]);
          setAmenityMaxPerSlot("");
          setAmenityMaxDuration("");
          setAmenityMaxPerMonth("");
          setAmenityUsageRules("");
          setPendingPhotos([]);
        }}
        title="Nueva amenidad"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { setAmenityPanelOpen(false); setPendingPhotos([]); }} disabled={savingAmenity}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreateAmenity()} disabled={savingAmenity || !amenityName.trim()}>
              {savingAmenity ? "Agregando..." : "Agregar +"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
            <Input value={amenityName} onChange={(event) => setAmenityName(event.target.value)} placeholder="Nombre de amenidad" />
            <select className="h-10 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" value={amenityCategory} onChange={(event) => setAmenityCategory(event.target.value as AmenityItem["category"])}>
              <option value="social">Social</option>
              <option value="sports">Deportes</option>
              <option value="wellness">Bienestar</option>
              <option value="business">Negocios</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div className="space-y-3 rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Horario y disponibilidad</p>
            <div>
              <p className="mb-1.5 text-sm text-[var(--slate-700)]">Días disponibles</p>
              <div className="flex flex-wrap gap-3">
                {(["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const).map((label, idx) => (
                  <label key={idx} className="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--slate-700)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--slate-300)]"
                      checked={amenityWeekdays.includes(idx)}
                      onChange={() => setAmenityWeekdays((prev) => prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort((a, b) => a - b))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--slate-700)]">
                Hora de apertura
                <Input type="time" value={amenityOperatingStart} onChange={(e) => setAmenityOperatingStart(e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm text-[var(--slate-700)]">
                Hora de cierre
                <Input type="time" value={amenityOperatingEnd} onChange={(e) => setAmenityOperatingEnd(e.target.value)} />
              </label>
            </div>
            <label className="grid gap-1 text-sm text-[var(--slate-700)]">
              Duración de bloque
              <select
                className="h-10 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={amenitySlotDuration}
                onChange={(e) => setAmenitySlotDuration(e.target.value)}
              >
                <option value="">Sin duración fija</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--slate-700)]">
                Aforo simultáneo
                <Input type="number" min={1} placeholder="Ej: 2" value={amenityMaxPerSlot} onChange={(e) => setAmenityMaxPerSlot(e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm text-[var(--slate-700)]">
                Duración máxima (min)
                <Input type="number" min={1} placeholder="Ej: 120" value={amenityMaxDuration} onChange={(e) => setAmenityMaxDuration(e.target.value)} />
              </label>
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Cuotas</p>
            <label className="grid gap-1 text-sm text-[var(--slate-700)]">
              Reservas por unidad al mes
              <Input type="number" min={0} placeholder="0 = sin límite" value={amenityMaxPerMonth} onChange={(e) => setAmenityMaxPerMonth(e.target.value)} />
              <span className="text-xs text-[var(--slate-500)]">Escribe 0 para no aplicar límite mensual</span>
            </label>
          </div>
          <div className="space-y-3 rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Reglas de uso</p>
            <label className="grid gap-1 text-sm text-[var(--slate-700)]">
              Reglas
              <textarea
                className="min-h-[80px] w-full resize-none rounded-xl border border-[var(--slate-300)] bg-white px-3 py-2 text-sm"
                maxLength={1000}
                placeholder="Ej: Uso obligatorio de ropa deportiva. Prohibido introducir alimentos..."
                value={amenityUsageRules}
                onChange={(e) => setAmenityUsageRules(e.target.value)}
              />
            </label>
          </div>
          <div className="space-y-3 rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Fotos (opcional)</p>
            {pendingPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {pendingPhotos.map((file, i) => (
                  <div key={i} className="relative h-20 w-20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(file)}
                      alt=""
                      className="h-20 w-20 rounded-md object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPendingPhotos((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pendingPhotos.length < 8 && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--slate-600)] hover:text-[var(--slate-900)]">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    setPendingPhotos((prev) => [...prev, ...files].slice(0, 8));
                    e.target.value = "";
                  }}
                />
                <span>+ Agregar fotos</span>
                <span className="text-xs text-[var(--slate-400)]">{pendingPhotos.length}/8</span>
              </label>
            )}
          </div>
        </div>
      </Drawer>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle help="Controla el uso de las amenidades del conjunto: salón comunal, piscina, gimnasio y más. Define horarios, límites mensuales y requisitos de pago para que el acceso sea ordenado y equitativo para todos los residentes.">Reservas de zonas comunes</CardTitle>
          <CardDescription className="mt-1">Creación, edición y cancelación con refresco inmediato en tabla.</CardDescription>
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
          <div className="space-y-3 rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Horario y disponibilidad</p>
            <div>
              <p className="mb-1.5 text-sm text-[var(--slate-700)]">Días disponibles</p>
              <div className="flex flex-wrap gap-3">
                {(["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const).map((label, idx) => (
                  <label key={idx} className="flex cursor-pointer items-center gap-1.5 text-sm text-[var(--slate-700)]">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[var(--slate-300)]"
                      checked={editAmenityWeekdays.includes(idx)}
                      onChange={() => setEditAmenityWeekdays((prev) => prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort((a, b) => a - b))}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--slate-700)]">
                Hora de apertura
                <Input type="time" value={editAmenityOperatingStart} onChange={(e) => setEditAmenityOperatingStart(e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm text-[var(--slate-700)]">
                Hora de cierre
                <Input type="time" value={editAmenityOperatingEnd} onChange={(e) => setEditAmenityOperatingEnd(e.target.value)} />
              </label>
            </div>
            <label className="grid gap-1 text-sm text-[var(--slate-700)]">
              Duración de bloque
              <select
                className="h-10 rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={editAmenitySlotDuration}
                onChange={(e) => setEditAmenitySlotDuration(e.target.value)}
              >
                <option value="">Sin duración fija</option>
                <option value="30">30 min</option>
                <option value="60">60 min</option>
                <option value="90">90 min</option>
                <option value="120">120 min</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm text-[var(--slate-700)]">
                Aforo simultáneo
                <Input type="number" min={1} placeholder="Ej: 2" value={editAmenityMaxPerSlot} onChange={(e) => setEditAmenityMaxPerSlot(e.target.value)} />
              </label>
              <label className="grid gap-1 text-sm text-[var(--slate-700)]">
                Duración máxima (min)
                <Input type="number" min={1} placeholder="Ej: 120" value={editAmenityMaxDuration} onChange={(e) => setEditAmenityMaxDuration(e.target.value)} />
              </label>
            </div>
          </div>
          <div className="space-y-3 rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Cuotas</p>
            <label className="grid gap-1 text-sm text-[var(--slate-700)]">
              Reservas por unidad al mes
              <Input type="number" min={0} placeholder="0 = sin límite" value={editAmenityMaxPerMonth} onChange={(e) => setEditAmenityMaxPerMonth(e.target.value)} />
              <span className="text-xs text-[var(--slate-500)]">Escribe 0 para no aplicar límite mensual</span>
            </label>
          </div>
          <div className="space-y-3 rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">Reglas de uso</p>
            <label className="grid gap-1 text-sm text-[var(--slate-700)]">
              Reglas
              <textarea
                className="min-h-[80px] w-full resize-none rounded-xl border border-[var(--slate-300)] bg-white px-3 py-2 text-sm"
                maxLength={1000}
                placeholder="Ej: Uso obligatorio de ropa deportiva. Prohibido introducir alimentos..."
                value={editAmenityUsageRules}
                onChange={(e) => setEditAmenityUsageRules(e.target.value)}
              />
            </label>
          </div>
          {editingAmenity && user?.tenantId ? (
            <div className="space-y-2">
              <div className="border-t border-[var(--slate-200)] pt-3" />
              <AmenityPhotoManager
                amenityId={editingAmenity.id}
                tenantId={user.tenantId}
                photos={editingAmenity.photos ?? []}
                onChange={(newPhotos: AmenityPhoto[]) =>
                  setEditingAmenity((prev) => (prev ? { ...prev, photos: newPhotos } : prev))
                }
              />
            </div>
          ) : null}
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
                <p className="text-xs uppercase tracking-wide text-[var(--danger-700)]">Motivo de cancelación</p>
                <p className="mt-1 text-[var(--danger-700)]">{detailItem.cancellationReason}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </Card>
  );
}
