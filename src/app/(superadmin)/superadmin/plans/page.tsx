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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  planCreateSchema,
  planUpdateSchema,
  type PlanCreateInput,
  type PlanUpdateInput,
} from "@/features/superadmin/schemas";
import {
  createPlanWorkspace,
  updatePlanWorkspace,
  watchPlans,
  type PlanWorkspaceItem,
} from "@/features/superadmin/services";

export default function SuperadminPlansPage() {
  const [plans, setPlans] = useState<PlanWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlanWorkspaceItem | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchFilter, setSearchFilter] = useState("");

  const createForm = useForm<PlanCreateInput>({
    resolver: zodResolver(planCreateSchema),
    defaultValues: {
      id: "",
      name: "",
      description: "",
      maxUnits: 120,
      maxNotificationsPerMonth: 500,
      slaLabel: "SLA base",
      isActive: true,
      featuresEnabledCsv: "",
    },
  });

  const editForm = useForm<PlanUpdateInput>({
    resolver: zodResolver(planUpdateSchema),
    defaultValues: {
      name: "",
      description: "",
      maxUnits: 120,
      maxNotificationsPerMonth: 500,
      slaLabel: "SLA base",
      isActive: true,
      featuresEnabledCsv: "",
    },
  });

  useEffect(() => {
    const unsubscribe = watchPlans(
      (items) => {
        setPlans(items);
        setLoading(false);
      },
      (message) => {
        toast.error(message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  function openEditPlan(plan: PlanWorkspaceItem) {
    setEditingPlan(plan);
    editForm.reset({
      name: plan.name,
      description: plan.description,
      maxUnits: plan.maxUnits,
      maxNotificationsPerMonth: plan.maxNotificationsPerMonth,
      slaLabel: plan.slaLabel,
      isActive: plan.isActive,
      featuresEnabledCsv: plan.featuresEnabled.join(", "),
    });
  }

  async function handleCreate(values: PlanCreateInput) {
    setSavingCreate(true);
    try {
      await createPlanWorkspace({
        id: values.id,
        name: values.name,
        description: values.description,
        maxUnits: values.maxUnits,
        maxNotificationsPerMonth: values.maxNotificationsPerMonth,
        slaLabel: values.slaLabel,
        isActive: values.isActive,
        featuresEnabled: values.featuresEnabledCsv
          ? values.featuresEnabledCsv.split(",").map((item) => item.trim()).filter(Boolean)
          : [],
      });
      toast.success("Plan creado correctamente.");
      setCreateOpen(false);
      createForm.reset();
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleEdit(values: PlanUpdateInput) {
    if (!editingPlan) return;
    setSavingEdit(true);
    try {
      await updatePlanWorkspace(editingPlan.id, {
        name: values.name,
        description: values.description,
        maxUnits: values.maxUnits,
        maxNotificationsPerMonth: values.maxNotificationsPerMonth,
        slaLabel: values.slaLabel,
        isActive: values.isActive,
        featuresEnabled: values.featuresEnabledCsv
          ? values.featuresEnabledCsv.split(",").map((item) => item.trim()).filter(Boolean)
          : [],
      });
      toast.success("Plan actualizado.");
      setEditingPlan(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleActive(plan: PlanWorkspaceItem) {
    const targetStatus = !plan.isActive;
    if (!window.confirm(`${targetStatus ? "Activar" : "Desactivar"} el plan ${plan.name}?`)) {
      return;
    }

    try {
      await updatePlanWorkspace(plan.id, {
        name: plan.name,
        description: plan.description,
        maxUnits: plan.maxUnits,
        maxNotificationsPerMonth: plan.maxNotificationsPerMonth,
        slaLabel: plan.slaLabel,
        isActive: targetStatus,
        featuresEnabled: plan.featuresEnabled,
      });
      toast.success("Estado de plan actualizado.");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  const filteredPlans = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return plans.filter((plan) => {
      const status = plan.isActive ? "active" : "inactive";
      const matchesStatus = statusFilter === "all" ? true : status === statusFilter;
      const matchesSearch =
        query.length === 0
          ? true
          : `${plan.id} ${plan.name} ${plan.description} ${plan.slaLabel}`.toLowerCase().includes(query);
      return matchesStatus && matchesSearch;
    });
  }, [plans, statusFilter, searchFilter]);

  const columns: DataTableColumn<PlanWorkspaceItem>[] = [
    {
      key: "name",
      header: "Plan",
      render: (plan) => (
        <div>
          <p className="font-medium text-[var(--slate-900)] capitalize">{plan.name}</p>
          <p className="text-xs text-[var(--slate-500)]">
            <span
              className="cursor-pointer hover:text-[var(--slate-700)]"
              title={plan.id}
              onClick={() => navigator.clipboard.writeText(plan.id)}
            >
              ID ···{plan.id.slice(-6)}
            </span>
          </p>
        </div>
      ),
    },
    {
      key: "description",
      header: "Descripcion",
      render: (plan) => <span className="text-[var(--slate-700)]">{plan.description}</span>,
      mobileHidden: true,
    },
    {
      key: "limits",
      header: "Limites",
      render: (plan) => (
        <span className="text-[var(--slate-700)]">
          Unidades: {plan.maxUnits} | Notif/mes: {plan.maxNotificationsPerMonth}
        </span>
      ),
    },
    {
      key: "sla",
      header: "SLA",
      render: (plan) => plan.slaLabel,
      mobileHidden: true,
    },
    {
      key: "status",
      header: "Estado",
      render: (plan) => (
        <Badge className={plan.isActive ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
          {plan.isActive ? "active" : "inactive"}
        </Badge>
      ),
    },
  ];

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Gestión de planes</CardTitle>
            <CardDescription className="mt-1">Editar limites, caracteristicas, SLA y estado de planes.</CardDescription>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>Crear plan</Button>
        </div>

        <div className="mt-3">
          <MobileFiltersPanel
            title="Filtros de planes"
            footer={
              <Button
                className="w-full md:w-auto"
                type="button"
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setSearchFilter("");
                }}
              >
                Limpiar filtros
              </Button>
            }
          >
            <label className="text-sm text-[var(--slate-700)]">
              Estado
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "inactive")}
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Buscar
              <Input
                className="mt-1"
                placeholder="ID, nombre, descripcion o SLA"
                value={searchFilter}
                onChange={(event) => setSearchFilter(event.target.value)}
              />
            </label>
          </MobileFiltersPanel>
        </div>
      </Card>

      <Card>
        <DataTable
          columns={columns}
          rows={filteredPlans}
          getRowKey={(plan) => plan.id}
          loading={loading}
          loadingText="Cargando planes..."
          emptyText="No hay planes con los filtros actuales."
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[800px] sm:min-w-[980px]"
          renderActions={(plan) => (
            <div className="space-y-2">
              <p className="text-xs text-[var(--slate-500)]">
                features: {plan.featuresEnabled.length > 0 ? plan.featuresEnabled.join(", ") : "ninguna"}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEditPlan(plan)}>
                  Editar
                </Button>
                <Button size="sm" variant={plan.isActive ? "danger" : "default"} onClick={() => void handleToggleActive(plan)}>
                  {plan.isActive ? "Desactivar" : "Activar"}
                </Button>
              </div>
            </div>
          )}
        />
      </Card>

      <Modal open={createOpen} title="Crear plan" onClose={() => setCreateOpen(false)}>
        <form className="space-y-3" onSubmit={createForm.handleSubmit((values) => void handleCreate(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">ID</label>
            <Input {...createForm.register("id")} placeholder="enterprise_plus" />
            {createForm.formState.errors.id ? <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.id.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre</label>
            <Input {...createForm.register("name")} />
            {createForm.formState.errors.name ? <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.name.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Descripcion</label>
            <Textarea {...createForm.register("description")} />
            {createForm.formState.errors.description ? <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.description.message}</p> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">maxUnits</label>
              <Input type="number" {...createForm.register("maxUnits")} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">maxNotificationsPerMonth</label>
              <Input type="number" {...createForm.register("maxNotificationsPerMonth")} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">SLA</label>
            <Input {...createForm.register("slaLabel")} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">featuresEnabled (separadas por coma)</label>
            <Input {...createForm.register("featuresEnabledCsv")} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--slate-700)]">
            <input type="checkbox" {...createForm.register("isActive")} />
            Activo
          </label>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingCreate}>
              {savingCreate ? "Guardando..." : "Guardar plan"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editingPlan)} title="Editar plan" onClose={() => setEditingPlan(null)}>
        <form className="space-y-3" onSubmit={editForm.handleSubmit((values) => void handleEdit(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre</label>
            <Input {...editForm.register("name")} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Descripcion</label>
            <Textarea {...editForm.register("description")} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">maxUnits</label>
              <Input type="number" {...editForm.register("maxUnits")} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">maxNotificationsPerMonth</label>
              <Input type="number" {...editForm.register("maxNotificationsPerMonth")} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">SLA</label>
            <Input {...editForm.register("slaLabel")} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">featuresEnabled (separadas por coma)</label>
            <Input {...editForm.register("featuresEnabledCsv")} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--slate-700)]">
            <input type="checkbox" {...editForm.register("isActive")} />
            Activo
          </label>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setEditingPlan(null)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingEdit}>
              {savingEdit ? "Guardando..." : "Actualizar plan"}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
