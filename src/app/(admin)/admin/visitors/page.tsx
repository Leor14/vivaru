"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FilterX, PenSquare, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { Modal } from "@/components/shared/modal";
import { Dialog } from "@/components/ui/dialog";
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
import { useVisitorPasses } from "@/features/visitors/use-visitor-passes";
import { resolveIdentityCell } from "@/lib/utils/identity";
import type { VisitorPass } from "@/types/domain";

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
  const [activeTab, setActiveTab] = useState<"authorizations" | "passes">("authorizations");
  const { items: passes, loading: passesLoading } = useVisitorPasses(user?.tenantId);
  const [selectedPass, setSelectedPass] = useState<VisitorPass | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VisitorItem | null>(null);

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
      return "La visita debe registrarse con al menos 15 minutos de anticipación";
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
      header: "Unidad / Residente",
      render: (item) => {
        const identity = resolveIdentityCell({ unitLabel: item.unitLabel, personName: item.authorizedBy });
        return (
          <span>
            <span className="block text-[var(--slate-900)]">{identity.primary}</span>
            {identity.secondary ? (
              <span className="block text-[11px] text-[var(--slate-500)]">{identity.secondary}</span>
            ) : null}
          </span>
        );
      },
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
      render: (item) => item.authorizationType === "larga_duracion"
        ? "Larga duración"
        : "Puntual",
    },
    {
      key: "category",
      header: "Categoría",
      render: (item) => {
        const map: Record<string, string> = { familiar: "Familiar", servicio: "Servicio", otro: "Otro" };
        return map[item.visitorCategory] ?? item.visitorCategory;
      },
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
      toast.error("La visita debe registrarse con al menos 15 minutos de anticipación.");
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
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(item: VisitorItem) {
    setDeleteTarget(item);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteVisitor(deleteTarget.id);
      toast.success("Autorización eliminada.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setDeleteTarget(null);
    }
  }

  function resolvePassStatus(pass: VisitorPass): string {
    if (pass.status === "inside") return "Dentro";
    if (pass.status === "completed") return "Finalizado";
    if (pass.status === "scheduled") {
      const dt = pass.date && pass.scheduledTime
        ? new Date(`${pass.date}T${pass.scheduledTime}`)
        : null;
      if (dt && dt.getTime() < Date.now()) return "Expirado";
      return "Programado";
    }
    return pass.status;
  }

  function resolvePassStatusClass(label: string): string {
    if (label === "Dentro") return "bg-sky-100 text-sky-700";
    if (label === "Finalizado") return "bg-slate-100 text-slate-700";
    if (label === "Expirado") return "bg-rose-100 text-rose-700";
    return "bg-amber-100 text-amber-700";
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle help="Controla el ingreso de visitantes al conjunto mediante pases autorizados por los propios residentes. Un registro de visitas activo disuade accesos no autorizados y ofrece trazabilidad ante cualquier incidente de seguridad.">Visitantes y acceso</CardTitle>
          <CardDescription className="mt-1">
            Autorizaciones puntuales o de larga duración, con categoría y responsable de autorización.
          </CardDescription>
        </div>
        {canEdit ? (
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            <IconBadge tone="mint" className="mr-2">
              <Plus className="h-4 w-4" />
            </IconBadge>
            Crear autorización
          </Button>
        ) : null}
      </div>

      <div className="mt-5 flex w-full gap-1 rounded-xl bg-[var(--slate-100)] p-1">
        <button
          type="button"
          onClick={() => setActiveTab("authorizations")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "authorizations"
              ? "bg-white text-[var(--slate-900)] shadow-sm"
              : "text-[var(--slate-500)] hover:text-[var(--slate-700)]"
          }`}
        >
          Autorizaciones
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("passes")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            activeTab === "passes"
              ? "bg-white text-[var(--slate-900)] shadow-sm"
              : "text-[var(--slate-500)] hover:text-[var(--slate-700)]"
          }`}
        >
          Registros operativos
        </button>
      </div>

      {activeTab === "authorizations" && (<>
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
              ? "No pudimos cargar las autorizaciónes de visitantes. Intenta nuevamente."
              : error
          }
          loadingText="Cargando visitantes..."
          emptyText="No hay autorizaciónes registradas con los filtros actuales."
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
      </>)}

      {activeTab === "passes" && (
        <div className="mt-4">
          {passesLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-[var(--slate-200)] p-3">
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-32 animate-pulse rounded bg-[var(--slate-200)]" />
                    <div className="h-3 w-48 animate-pulse rounded bg-[var(--slate-100)]" />
                  </div>
                  <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--slate-100)]" />
                </div>
              ))}
            </div>
          ) : passes.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[var(--slate-300)] px-4 py-6 text-center text-sm text-[var(--slate-600)]">
              No hay registros de visitas operativas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[var(--slate-200)]">
              <table className="min-w-[760px] w-full text-sm">
                <thead className="bg-[var(--slate-50)]">
                  <tr className="border-b border-[var(--slate-200)] text-left">
                    {["Visitante","Documento","Unidad","Fecha","Hora","Estado","Entrada","Salida","Notas portería","Acciones"].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--slate-100)]">
                  {[...passes]
                    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
                    .map((pass) => {
                      const statusLabel = resolvePassStatus(pass);
                      return (
                        <tr key={pass.id} className="hover:bg-[var(--slate-50)]">
                          <td className="px-4 py-3 font-medium text-[var(--slate-900)]">
                            {pass.visitorName}
                          </td>
                          <td className="px-4 py-3 text-[var(--slate-600)]">
                            {pass.documentNumber || "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--slate-600)]">
                            {pass.unitLabel || "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--slate-600)]">
                            {pass.date || "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--slate-600)]">
                            {pass.scheduledTime?.slice(0, 5) || "-"}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${resolvePassStatusClass(statusLabel)}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-[var(--slate-600)]">
                            {pass.checkInAt
                              ? new Date(pass.checkInAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--slate-600)]">
                            {pass.checkOutAt
                              ? new Date(pass.checkOutAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })
                              : "-"}
                          </td>
                          <td className="px-4 py-3 text-[var(--slate-600)]">
                            {(pass.guardNotes?.length ?? 0) > 0
                              ? `${pass.guardNotes!.length} nota${pass.guardNotes!.length !== 1 ? "s" : ""}`
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedPass(pass)}
                            >
                              Ver detalle
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {selectedPass ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
            aria-label="Cerrar detalle"
            onClick={() => setSelectedPass(null)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-[var(--slate-200)] bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">
                  Detalle de visita
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--slate-900)]">
                  {selectedPass.visitorName}
                </h2>
              </div>
              <Button type="button" variant="outline" onClick={() => setSelectedPass(null)}>
                Cerrar
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <section className="rounded-xl border border-[var(--slate-200)] p-4 space-y-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                  Información del visitante
                </p>
                <p className="text-[var(--slate-700)]">
                  Documento: <span className="font-medium text-[var(--slate-900)]">{selectedPass.documentNumber || "-"}</span>
                </p>
                <p className="text-[var(--slate-700)]">
                  Unidad: <span className="font-medium text-[var(--slate-900)]">{selectedPass.unitLabel || "-"}</span>
                </p>
                <p className="text-[var(--slate-700)]">
                  Residente anfitrión: <span className="font-medium text-[var(--slate-900)]">{selectedPass.hostResidentName || "-"}</span>
                </p>
                <p className="text-[var(--slate-700)]">
                  Fecha programada:{" "}
                  <span className="font-medium text-[var(--slate-900)]">
                    {selectedPass.date
                      ? new Date(`${selectedPass.date}T12:00:00`).toLocaleDateString("es-CO", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "-"}
                  </span>
                </p>
                <p className="text-[var(--slate-700)]">
                  Hora: <span className="font-medium text-[var(--slate-900)]">{selectedPass.scheduledTime?.slice(0, 5) || "-"}</span>
                </p>
              </section>

              <section className="rounded-xl border border-[var(--slate-200)] p-4 space-y-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                  Estado operativo
                </p>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${resolvePassStatusClass(resolvePassStatus(selectedPass))}`}>
                    {resolvePassStatus(selectedPass)}
                  </span>
                </div>
                <p className="text-[var(--slate-700)]">
                  Entrada: <span className="font-medium text-[var(--slate-900)]">
                    {selectedPass.checkInAt
                      ? new Date(selectedPass.checkInAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
                      : "-"}
                  </span>
                </p>
                <p className="text-[var(--slate-700)]">
                  Salida: <span className="font-medium text-[var(--slate-900)]">
                    {selectedPass.checkOutAt
                      ? new Date(selectedPass.checkOutAt).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })
                      : "-"}
                  </span>
                </p>
              </section>

              <section className="rounded-xl border border-[var(--slate-200)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--slate-500)]">
                  Notas de portería
                </p>
                {(selectedPass.guardNotes?.length ?? 0) > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {selectedPass.guardNotes!.map((n, i) => (
                      <li key={i} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm">
                        <p className="text-[var(--slate-800)]">{n.text}</p>
                        <p className="mt-1 text-xs text-[var(--slate-500)]">
                          {n.guardName ?? "Guardia"} ·{" "}
                          {new Date(n.createdAt).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-[var(--slate-500)]">Sin notas registradas.</p>
                )}
              </section>
            </div>
          </aside>
        </div>
      ) : null}

      <Dialog open={deleteTarget !== null} onClose={() => setDeleteTarget(null)} className="max-w-sm p-6">
        <h2 className="text-base font-semibold text-[var(--slate-900)]">Eliminar autorización</h2>
        <p className="mt-2 text-sm text-[var(--slate-600)]">
          ¿Confirmas que deseas eliminar la autorización de{" "}
          <span className="font-medium text-[var(--slate-900)]">{deleteTarget?.visitorName}</span>? Esta acción no se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void confirmDelete()}>
            Eliminar
          </Button>
        </div>
      </Dialog>

      <Modal open={openModal && canEdit} title={editingItem ? "Editar visitante" : "Crear visitante"} onClose={() => setOpenModal(false)}>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => void handleSave(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre visitante</label>
            <Input {...form.register("visitorName")} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Cédula visitante
              <Input {...form.register("visitorDocument")} />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Código QR
              <Input {...form.register("qrCode")} />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-[var(--slate-700)]">
              Tipo autorización
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("authorizationType")}>
                <option value="puntual">Puntual</option>
                <option value="larga_duracion">Larga duración</option>
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Categoría
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
              <div className="text-xs text-[var(--slate-500)]">Para autorización puntual se usa la misma fecha y hora de inicio.</div>
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
