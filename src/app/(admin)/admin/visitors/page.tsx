"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FilterX, PenSquare, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { visitorSchema, type VisitorInput } from "@/features/admin/schemas";
import {
  createVisitor,
  deleteVisitor,
  updateVisitor,
  watchUnits,
  watchVisitors,
  type UnitItem,
  type VisitorItem,
} from "@/features/admin/services";
import {
  combineDateAndTime,
  getMinAllowedDateTime,
  isDateTimeValid,
  isSameDay,
  toDateInputValue,
  toTimeInputValue,
} from "@/utils/datetimeValidation";

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

export default function AdminVisitorsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "tenant_admin";
  const [items, setItems] = useState<VisitorItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openModal, setOpenModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<VisitorItem | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "expired" | "cancelled">("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");

  const form = useForm<VisitorInput>({
    resolver: zodResolver(visitorSchema),
    defaultValues: {
      visitorName: "",
      visitorDocument: "",
      qrCode: `QR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      authorizationType: "puntual",
      visitorCategory: "familiar",
      unitId: "",
      authorizedBy: user?.fullName ?? "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      notes: "",
      status: "active",
    },
  });

  const authorizationType = form.watch("authorizationType");
  const selectedStartDate = form.watch("startDate");
  const selectedStartTime = form.watch("startTime");
  const nowDateTime = new Date();
  const minVisitorDateTime = getMinAllowedDateTime("visitor", nowDateTime);
  const minDateValue = toDateInputValue(nowDateTime);

  const visitorDateTimeError = useMemo(() => {
    if (!selectedStartDate || !selectedStartTime) return null;

    const selectedDateTime = combineDateAndTime(selectedStartDate, selectedStartTime);
    if (!selectedDateTime) {
      return "Debes seleccionar una hora futura";
    }

    if (!isDateTimeValid(selectedDateTime, "visitor", nowDateTime)) {
      return "La visita debe registrarse con al menos 15 minutos de anticipacion";
    }

    return null;
  }, [selectedStartDate, selectedStartTime, nowDateTime]);

  const minStartTimeValue = useMemo(() => {
    if (!selectedStartDate) return undefined;
    const selectedDateOnly = new Date(`${selectedStartDate}T00:00:00`);
    if (Number.isNaN(selectedDateOnly.getTime())) return undefined;
    return isSameDay(selectedDateOnly, nowDateTime) ? toTimeInputValue(minVisitorDateTime) : undefined;
  }, [selectedStartDate, nowDateTime, minVisitorDateTime]);

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }

    const unsubVisitors = watchVisitors(
      user.tenantId,
      (data) => {
        setItems(data);
        setError(null);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
        // Solo mostrar toast si el error no es de empty state
        if (message && !/no hay autorizaciones/i.test(message)) {
          toast.error(message);
        }
      },
    );

    const unsubUnits = watchUnits(
      user.tenantId,
      (data) => setUnits(data),
      (message) => toast.error(message),
    );

    return () => {
      unsubVisitors();
      unsubUnits();
    };
  }, [user?.tenantId]);

  const mappedItems = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        unitLabel: units.find((unit) => unit.id === item.unitId)?.displayName ?? item.unitId,
      })),
    [items, units],
  );

  const filteredItems = useMemo(() => {
    return mappedItems.filter((item) => {
      const statusOk = statusFilter === "all" ? true : item.status === statusFilter;
      const unitOk = unitFilter === "all" ? true : item.unitId === unitFilter;
      return statusOk && unitOk;
    });
  }, [mappedItems, statusFilter, unitFilter]);

  const columns: DataTableColumn<(typeof filteredItems)[number]>[] = [
    {
      key: "visitorName",
      header: "Nombre",
      render: (item) => <p className="font-medium text-[var(--slate-900)]">{item.visitorName}</p>,
    },
    {
      key: "unit",
      header: "Unidad",
      render: (item) => item.unitLabel,
    },
    {
      key: "visitorDocument",
      header: "Documento",
      render: (item) => item.visitorDocument,
    },
    {
      key: "authorizedBy",
      header: "Autorizado por",
      mobileLabel: "Autorizado",
      render: (item) => item.authorizedBy,
    },
    {
      key: "qrCode",
      header: "QR",
      render: (item) => item.qrCode,
    },
    {
      key: "authorizationType",
      header: "Tipo",
      render: (item) => item.authorizationType,
    },
    {
      key: "category",
      header: "Categoria",
      render: (item) => item.visitorCategory,
      mobileHidden: true,
    },
    {
      key: "start",
      header: "Inicio",
      render: (item) => asDateLabel(item.startDate),
      mobileHidden: true,
    },
    {
      key: "end",
      header: "Fin",
      render: (item) => asDateLabel(item.endDate),
      mobileHidden: true,
    },
    {
      key: "status",
      header: "Estado",
      render: (item) => <StatusBadge status={item.status} />,
    },
  ];

  function openCreate() {
    setEditingItem(null);
    form.reset({
      visitorName: "",
      visitorDocument: "",
      qrCode: `QR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      authorizationType: "puntual",
      visitorCategory: "familiar",
      unitId: units[0]?.id ?? "",
      authorizedBy: user?.fullName ?? "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      notes: "",
      status: "active",
    });
    setOpenModal(true);
  }

  function openEdit(item: VisitorItem) {
    setEditingItem(item);
    form.reset({
      visitorName: item.visitorName,
      visitorDocument: item.visitorDocument,
      qrCode: item.qrCode,
      authorizationType: item.authorizationType,
      visitorCategory: item.visitorCategory,
      unitId: item.unitId,
      authorizedBy: item.authorizedBy,
      startDate: item.startDate,
      startTime: item.startTime,
      endDate: item.endDate ?? "",
      endTime: item.endTime ?? "",
      notes: item.notes ?? "",
      status: item.status,
    });
    setOpenModal(true);
  }

  async function handleSave(values: VisitorInput) {
    if (!user?.tenantId) return;

    const selectedDateTime = combineDateAndTime(values.startDate, values.startTime);
    if (!selectedDateTime || !isDateTimeValid(selectedDateTime, "visitor")) {
      toast.error("La visita debe registrarse con al menos 15 minutos de anticipacion.");
      return;
    }

    setSaving(true);
    try {
      const payload: VisitorInput = {
        ...values,
        endDate: values.authorizationType === "puntual" ? values.startDate : values.endDate,
      };

      if (editingItem) {
        await updateVisitor(editingItem.id, user.uid, payload);
        toast.success("Visitante actualizado.");
      } else {
        await createVisitor(user.tenantId, user.uid, payload);
        toast.success("Visitante creado.");
      }
      setOpenModal(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar visitante.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: VisitorItem) {
    if (!window.confirm(`Eliminar autorizacion de ${item.visitorName}?`)) return;
    try {
      await deleteVisitor(item.id);
      toast.success("Visitante eliminado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible eliminar visitante.");
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Visitantes y acceso</CardTitle>
          <CardDescription className="mt-1">
            Autorizaciones puntuales o de larga duracion, con categoria y responsable de autorizacion.
          </CardDescription>
        </div>
        {canEdit ? (
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            <IconBadge tone="mint" className="mr-2">
              <Plus className="h-4 w-4" />
            </IconBadge>
            Crear autorizacion
          </Button>
        ) : null}
      </div>

      <div className="mt-4">
        <MobileFiltersPanel
          title="Filtros de visitantes"
          footer={
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setStatusFilter("all");
                setUnitFilter("all");
              }}
            >
              <IconBadge tone="sand" className="mr-2">
                <FilterX className="h-4 w-4" />
              </IconBadge>
              Limpiar filtros
            </Button>
          }
        >
          <label className="text-xs text-[var(--slate-600)]">
            Estado
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "expired" | "cancelled")}
            >
              <option value="all">Todos</option>
              <option value="active">Activo</option>
              <option value="expired">Expirado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </label>
          <label className="text-xs text-[var(--slate-600)]">
            Unidad
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={unitFilter}
              onChange={(event) => setUnitFilter(event.target.value)}
            >
              <option value="all">Todas</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.displayName}</option>
              ))}
            </select>
          </label>
        </MobileFiltersPanel>
      </div>

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={filteredItems}
          getRowKey={(item) => item.id}
          loading={loading}
          errorText={
            error === "Estamos terminando de configurar este modulo. Intenta nuevamente en unos minutos."
              ? "No pudimos cargar las autorizaciones de visitantes. Intenta nuevamente."
              : error
          }
          loadingText="Cargando visitantes..."
          emptyText="No hay autorizaciones registradas con los filtros actuales."
          tableMinWidthClassName="min-w-[760px] sm:min-w-[980px]"
          renderActions={canEdit ? (item) => (
            <div className="flex flex-wrap gap-2">
              <Button className="w-full sm:w-auto" size="sm" variant="outline" onClick={() => openEdit(item)}>
                <IconBadge tone="sky" className="mr-2">
                  <PenSquare className="h-4 w-4" />
                </IconBadge>
                Editar
              </Button>
              <Button className="w-full sm:w-auto" size="sm" variant="danger" onClick={() => void handleDelete(item)}>
                <IconBadge tone="peach" className="mr-2">
                  <Trash2 className="h-4 w-4" />
                </IconBadge>
                Eliminar
              </Button>
            </div>
          ) : undefined}
        />
      </div>

      <Modal open={openModal && canEdit} title={editingItem ? "Editar visitante" : "Crear visitante"} onClose={() => setOpenModal(false)}>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => void handleSave(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre visitante</label>
            <Input {...form.register("visitorName")} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Cedula visitante
              <Input {...form.register("visitorDocument")} />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Codigo QR
              <Input {...form.register("qrCode")} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-[var(--slate-700)]">
              Tipo autorizacion
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("authorizationType")}>
                <option value="puntual">Puntual</option>
                <option value="larga_duracion">Larga duracion</option>
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Categoria
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("visitorCategory")}>
                <option value="familiar">Familiar</option>
                <option value="servicio">Servicio</option>
                <option value="otro">Otro</option>
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Unidad
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("unitId")}>
                <option value="">Selecciona</option>
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>{unit.displayName}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Autorizado por
              <Input {...form.register("authorizedBy")} />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Estado
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("status")}>
                <option value="active">Activo</option>
                <option value="expired">Expirado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Fecha inicio
              <Input type="date" min={minDateValue} {...form.register("startDate")} />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Hora inicio
              <Input type="time" min={minStartTimeValue} {...form.register("startTime")} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {authorizationType === "larga_duracion" ? (
              <>
                <label className="text-sm text-[var(--slate-700)]">
                  Fecha fin
                  <Input type="date" min={selectedStartDate || minDateValue} {...form.register("endDate")} />
                </label>
                <label className="text-sm text-[var(--slate-700)]">
                  Hora fin
                  <Input type="time" {...form.register("endTime")} />
                </label>
              </>
            ) : (
              <div className="text-xs text-[var(--slate-500)]">Para autorizacion puntual se usa la misma fecha y hora de inicio.</div>
            )}
          </div>
          <label className="text-sm text-[var(--slate-700)]">
            Notas
            <Input {...form.register("notes")} />
          </label>
          {visitorDateTimeError ? <p className="text-xs text-[var(--danger-700)]">{visitorDateTimeError}</p> : null}
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setOpenModal(false)}>Cancelar</Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={saving || Boolean(visitorDateTimeError)}>{saving ? "Guardando..." : "Guardar"}</Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
