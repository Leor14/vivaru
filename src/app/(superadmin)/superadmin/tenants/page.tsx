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
import {
  tenantCreateSchema,
  tenantUpdateSchema,
  type TenantCreateInput,
  type TenantUpdateInput,
} from "@/features/superadmin/schemas";
import {
  setTenantStatus,
  updateTenantWorkspace,
  watchTenants,
  createTenantWorkspace,
  type TenantWorkspaceItem,
} from "@/features/superadmin/services";

const ONBOARDING_OPTIONS = ["not_started", "in_progress", "completed"] as const;
const TENANT_STATUS_OPTIONS = ["active", "trial", "suspended"] as const;

export default function SuperadminTenantsPage() {
  const [tenants, setTenants] = useState<TenantWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWorkspaceItem | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "trial" | "suspended">("all");
  const [onboardingFilter, setOnboardingFilter] = useState<"all" | "not_started" | "in_progress" | "completed">("all");
  const [searchFilter, setSearchFilter] = useState("");

  const createForm = useForm<TenantCreateInput>({
    resolver: zodResolver(tenantCreateSchema),
    defaultValues: {
      name: "",
      city: "",
      planId: "starter",
      status: "trial",
      onboardingStatus: "not_started",
    },
  });

  const editForm = useForm<TenantUpdateInput>({
    resolver: zodResolver(tenantUpdateSchema),
    defaultValues: {
      name: "",
      city: "",
      planId: "starter",
      status: "active",
      onboardingStatus: "not_started",
    },
  });

  useEffect(() => {
    const unsubscribe = watchTenants(
      (items) => {
        setTenants(items);
        setLoading(false);
      },
      (message) => {
        toast.error(message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const onboardingPendingCount = useMemo(
    () => tenants.filter((tenant) => tenant.onboardingStatus !== "completed").length,
    [tenants],
  );

  function openEditTenant(tenant: TenantWorkspaceItem) {
    setEditingTenant(tenant);
    editForm.reset({
      name: tenant.name,
      city: tenant.city,
      planId: tenant.planId,
      status: tenant.status,
      onboardingStatus: tenant.onboardingStatus,
    });
  }

  async function handleCreate(values: TenantCreateInput) {
    setSavingCreate(true);
    try {
      await createTenantWorkspace(values);
      toast.success("Tenant creado correctamente.");
      setCreateOpen(false);
      createForm.reset();
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleEdit(values: TenantUpdateInput) {
    if (!editingTenant) return;
    setSavingEdit(true);
    try {
      await updateTenantWorkspace(editingTenant.id, values);
      toast.success("Tenant actualizado.");
      setEditingTenant(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleStatus(tenant: TenantWorkspaceItem) {
    const targetStatus = tenant.status === "suspended" ? "active" : "suspended";
    const actionLabel = targetStatus === "suspended" ? "suspender" : "activar";
    if (!window.confirm(`Confirmas ${actionLabel} el tenant ${tenant.name}?`)) {
      return;
    }

    try {
      await setTenantStatus(tenant.id, targetStatus);
      toast.success(`Tenant ${actionLabel}do correctamente.`);
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  const filteredTenants = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return tenants.filter((tenant) => {
      const matchesStatus = statusFilter === "all" ? true : tenant.status === statusFilter;
      const matchesOnboarding = onboardingFilter === "all" ? true : tenant.onboardingStatus === onboardingFilter;
      const matchesSearch =
        query.length === 0 ? true : `${tenant.name} ${tenant.id} ${tenant.city} ${tenant.planId}`.toLowerCase().includes(query);
      return matchesStatus && matchesOnboarding && matchesSearch;
    });
  }, [tenants, statusFilter, onboardingFilter, searchFilter]);

  const columns: DataTableColumn<TenantWorkspaceItem>[] = [
    {
      key: "name",
      header: "Tenant",
      render: (tenant) => (
        <div>
          <p className="font-medium text-[var(--slate-900)]">{tenant.name}</p>
          <p className="text-xs text-[var(--slate-500)]">
            <span
              className="cursor-pointer hover:text-[var(--slate-700)]"
              title={tenant.id}
              onClick={() => navigator.clipboard.writeText(tenant.id)}
            >
              ID ···{tenant.id.slice(-6)}
            </span>
          </p>
        </div>
      ),
    },
    {
      key: "city",
      header: "Ciudad",
      render: (tenant) => tenant.city,
    },
    {
      key: "plan",
      header: "Plan",
      render: (tenant) => tenant.planId,
    },
    {
      key: "status",
      header: "Estado",
      render: (tenant) => <Badge>{tenant.status}</Badge>,
    },
    {
      key: "onboarding",
      header: "Onboarding",
      render: (tenant) => <Badge className="bg-[var(--brand-100)] text-[var(--brand-900)]">{tenant.onboardingStatus}</Badge>,
    },
  ];

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Gestión de tenants</CardTitle>
            <CardDescription className="mt-1">Workspace operativo para crear, editar, suspender y cambiar onboarding.</CardDescription>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>Crear tenant</Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs text-[var(--slate-500)] uppercase">Total tenants</p>
            <p className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{tenants.length}</p>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs text-[var(--slate-500)] uppercase">Activos</p>
            <p className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{tenants.filter((tenant) => tenant.status === "active").length}</p>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] p-3">
            <p className="text-xs text-[var(--slate-500)] uppercase">Onboarding pendiente</p>
            <p className="mt-1 text-xl font-semibold text-[var(--slate-900)]">{onboardingPendingCount}</p>
          </div>
        </div>

        <div className="mt-3">
          <MobileFiltersPanel
            title="Filtros de tenants"
            footer={
              <Button
                className="w-full md:w-auto"
                type="button"
                variant="outline"
                onClick={() => {
                  setStatusFilter("all");
                  setOnboardingFilter("all");
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
                onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "trial" | "suspended")}
              >
                <option value="all">Todos</option>
                {TENANT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Onboarding
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={onboardingFilter}
                onChange={(event) =>
                  setOnboardingFilter(event.target.value as "all" | "not_started" | "in_progress" | "completed")
                }
              >
                <option value="all">Todos</option>
                {ONBOARDING_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Buscar
              <Input
                className="mt-1"
                placeholder="Nombre, ID, ciudad o plan"
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
          rows={filteredTenants}
          getRowKey={(tenant) => tenant.id}
          loading={loading}
          loadingText="Cargando tenants..."
          emptyText="No hay tenants con los filtros actuales."
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[760px] sm:min-w-[920px]"
          renderActions={(tenant) => (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openEditTenant(tenant)}>
                Editar
              </Button>
              <Button size="sm" variant={tenant.status === "suspended" ? "default" : "danger"} onClick={() => void handleToggleStatus(tenant)}>
                {tenant.status === "suspended" ? "Activar" : "Suspender"}
              </Button>
            </div>
          )}
        />
      </Card>

      <Modal open={createOpen} title="Crear tenant" onClose={() => setCreateOpen(false)}>
        <form className="space-y-3" onSubmit={createForm.handleSubmit((values) => void handleCreate(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre</label>
            <Input {...createForm.register("name")} />
            {createForm.formState.errors.name ? <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.name.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Ciudad</label>
            <Input {...createForm.register("city")} />
            {createForm.formState.errors.city ? <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.city.message}</p> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Plan</label>
              <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...createForm.register("planId")}>
                <option value="starter">starter</option>
                <option value="plus">plus</option>
                <option value="premium">premium</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Estado</label>
              <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...createForm.register("status")}>
                {TENANT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Onboarding</label>
            <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...createForm.register("onboardingStatus")}>
              {ONBOARDING_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingCreate}>
              {savingCreate ? "Guardando..." : "Guardar tenant"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editingTenant)} title="Editar tenant" onClose={() => setEditingTenant(null)}>
        <form className="space-y-3" onSubmit={editForm.handleSubmit((values) => void handleEdit(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre</label>
            <Input {...editForm.register("name")} />
            {editForm.formState.errors.name ? <p className="mt-1 text-xs text-[var(--danger-700)]">{editForm.formState.errors.name.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Ciudad</label>
            <Input {...editForm.register("city")} />
            {editForm.formState.errors.city ? <p className="mt-1 text-xs text-[var(--danger-700)]">{editForm.formState.errors.city.message}</p> : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Plan</label>
              <Input {...editForm.register("planId")} />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Estado</label>
              <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...editForm.register("status")}>
                {TENANT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Onboarding</label>
            <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...editForm.register("onboardingStatus")}>
              {ONBOARDING_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setEditingTenant(null)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingEdit}>
              {savingEdit ? "Guardando..." : "Actualizar tenant"}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
