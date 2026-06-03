"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Modal } from "@/components/shared/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  adminCreateSchema,
  adminUpdateSchema,
  type AdminCreateInput,
  type AdminUpdateInput,
} from "@/features/superadmin/schemas";
import {
  createTenantAdminWorkspace,
  listTenantAdmins,
  updateTenantAdminWorkspace,
  watchTenants,
  type AdminWorkspaceItem,
  type TenantWorkspaceItem,
} from "@/features/superadmin/services";

export default function SuperadminAdminUsersPage() {
  const [admins, setAdmins] = useState<AdminWorkspaceItem[]>([]);
  const [tenants, setTenants] = useState<TenantWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<string>("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminWorkspaceItem | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [searchFilter, setSearchFilter] = useState("");

  const createForm = useForm<AdminCreateInput>({
    resolver: zodResolver(adminCreateSchema),
    mode: "onChange",
    defaultValues: {
      tenantId: "",
      fullName: "",
      email: "",
      status: "active",
    },
  });

  const editForm = useForm<AdminUpdateInput>({
    resolver: zodResolver(adminUpdateSchema),
    mode: "onChange",
    defaultValues: {
      uid: "",
      tenantId: "",
      fullName: "",
      email: "",
      status: "active",
    },
  });

  useEffect(() => {
    const unsubscribe = watchTenants(
      (items) => {
        setTenants(items);
      },
      (message) => toast.error(message),
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    void reloadAdmins(selectedTenant || undefined);
  }, [selectedTenant]);

  async function reloadAdmins(tenantId?: string) {
    setLoading(true);
    try {
      const items = await listTenantAdmins(tenantId);
      setAdmins(items);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setLoading(false);
    }
  }

  function openEditAdmin(admin: AdminWorkspaceItem) {
    setEditingAdmin(admin);
    editForm.reset({
      uid: admin.uid,
      tenantId: admin.tenantId,
      fullName: admin.fullName,
      email: admin.email,
      status: admin.status,
    });
  }

  async function handleCreate(values: AdminCreateInput) {
    if (savingCreate) return;
    setSavingCreate(true);
    try {
      const email = values.email.trim().toLowerCase();
      const normalized = {
        ...values,
        tenantId: values.tenantId.trim(),
        fullName: values.fullName.trim(),
        email,
      };

      await createTenantAdminWorkspace(normalized);

      // Onboarding por enlace: el admin define su propia contrasena via correo.
      try {
        if (auth) await sendPasswordResetEmail(auth, email);
        toast.success("Admin creado. Se le envió un correo para definir su contraseña.");
      } catch {
        toast.success("Admin creado. No se pudo enviar el correo automáticamente; usa “¿Olvidaste tu contraseña?” para reenviarlo.");
      }

      setCreateOpen(false);
      createForm.reset({
        tenantId: "",
        fullName: "",
        email: "",
        status: "active",
      });
      await reloadAdmins(selectedTenant || undefined);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[superadmin.admin-users] create admin failed", { values, error });
      }
      toastFirebaseError(error);
    } finally {
      setSavingCreate(false);
    }
  }

  async function handleEdit(values: AdminUpdateInput) {
    if (savingEdit) return;
    setSavingEdit(true);
    try {
      const normalized = {
        ...values,
        uid: values.uid.trim(),
        tenantId: values.tenantId.trim(),
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
      };

      await updateTenantAdminWorkspace(normalized);
      toast.success("Admin actualizado.");
      setEditingAdmin(null);
      await reloadAdmins(selectedTenant || undefined);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[superadmin.admin-users] update admin failed", { values, error });
      }
      toastFirebaseError(error);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleStatus(admin: AdminWorkspaceItem) {
    const targetStatus = admin.status === "active" ? "inactive" : "active";
    if (!window.confirm(`Confirmas ${targetStatus === "active" ? "activar" : "desactivar"} a ${admin.fullName}?`)) {
      return;
    }

    try {
      await updateTenantAdminWorkspace({
        uid: admin.uid,
        tenantId: admin.tenantId,
        fullName: admin.fullName,
        email: admin.email,
        status: targetStatus,
      });
      toast.success("Estado actualizado.");
      await reloadAdmins(selectedTenant || undefined);
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  const filteredAdmins = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return admins.filter((admin) => {
      const matchesTenant = selectedTenant ? admin.tenantId === selectedTenant : true;
      const matchesStatus = statusFilter === "all" ? true : admin.status === statusFilter;
      const matchesSearch =
        query.length === 0 ? true : `${admin.fullName} ${admin.email} ${admin.tenantId}`.toLowerCase().includes(query);
      return matchesTenant && matchesStatus && matchesSearch;
    });
  }, [admins, selectedTenant, statusFilter, searchFilter]);

  const columns: DataTableColumn<AdminWorkspaceItem>[] = [
    {
      key: "fullName",
      header: "Nombre",
      render: (admin) => <span className="font-medium text-[var(--slate-900)]">{admin.fullName}</span>,
    },
    {
      key: "email",
      header: "Correo",
      render: (admin) => admin.email,
    },
    {
      key: "tenant",
      header: "Tenant",
      render: (admin) => tenants.find((tenant) => tenant.id === admin.tenantId)?.name ?? admin.tenantId,
    },
    {
      key: "status",
      header: "Estado",
      render: (admin) => (
        <Badge className={admin.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
          {admin.status}
        </Badge>
      ),
    },
    {
      key: "lastLogin",
      header: "Ultimo login",
      render: (admin) => admin.lastLoginAt ?? "sin registro",
      mobileHidden: true,
    },
  ];

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Usuarios administradores</CardTitle>
            <CardDescription className="mt-1">Crear, editar, filtrar por tenant y activar/desactivar admins.</CardDescription>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>Crear admin</Button>
        </div>

        <div className="mt-3">
          <MobileFiltersPanel
            title="Filtros de administradores"
            footer={
              <Button
                className="w-full md:w-auto"
                type="button"
                variant="outline"
                onClick={() => {
                  setSelectedTenant("");
                  setStatusFilter("all");
                  setSearchFilter("");
                }}
              >
                Limpiar filtros
              </Button>
            }
          >
            <label className="text-sm text-[var(--slate-700)]">
              Tenant
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={selectedTenant}
                onChange={(event) => setSelectedTenant(event.target.value)}
              >
                <option value="">Todos los tenants</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </option>
                ))}
              </select>
            </label>
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
                placeholder="Nombre, correo o tenant"
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
          rows={filteredAdmins}
          getRowKey={(admin) => admin.uid}
          loading={loading}
          loadingText="Cargando admins..."
          emptyText="No hay admins para este filtro. Crea uno nuevo."
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[760px] sm:min-w-[920px]"
          renderActions={(admin) => (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => openEditAdmin(admin)}>
                Editar
              </Button>
              <Button
                size="sm"
                variant={admin.status === "active" ? "danger" : "default"}
                onClick={() => void handleToggleStatus(admin)}
              >
                {admin.status === "active" ? "Desactivar" : "Activar"}
              </Button>
            </div>
          )}
        />
      </Card>

      <Modal open={createOpen} title="Crear admin de tenant" onClose={() => setCreateOpen(false)}>
        <form className="space-y-3" onSubmit={createForm.handleSubmit((values) => void handleCreate(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Tenant</label>
            <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...createForm.register("tenantId")}>
              <option value="">Selecciona tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            {createForm.formState.errors.tenantId ? <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.tenantId.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre completo</label>
            <Input {...createForm.register("fullName")} />
            {createForm.formState.errors.fullName ? <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.fullName.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Correo</label>
            <Input type="email" {...createForm.register("email")} />
            {createForm.formState.errors.email ? <p className="mt-1 text-xs text-[var(--danger-700)]">{createForm.formState.errors.email.message}</p> : null}
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-3 text-sm text-[var(--slate-700)]">
            Al crear el admin se le enviará un correo para que defina su propia contraseña. No se asignan contraseñas manuales.
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Estado</label>
            <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...createForm.register("status")}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={savingCreate}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingCreate || !createForm.formState.isValid}>
              {savingCreate ? "Guardando..." : "Crear admin"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(editingAdmin)} title="Editar admin" onClose={() => setEditingAdmin(null)}>
        <form className="space-y-3" onSubmit={editForm.handleSubmit((values) => void handleEdit(values))}>
          <input type="hidden" {...editForm.register("uid")} />
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Tenant</label>
            <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...editForm.register("tenantId")}>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre completo</label>
            <Input {...editForm.register("fullName")} />
            {editForm.formState.errors.fullName ? <p className="mt-1 text-xs text-[var(--danger-700)]">{editForm.formState.errors.fullName.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Correo</label>
            <Input type="email" {...editForm.register("email")} />
            {editForm.formState.errors.email ? <p className="mt-1 text-xs text-[var(--danger-700)]">{editForm.formState.errors.email.message}</p> : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Estado</label>
            <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...editForm.register("status")}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setEditingAdmin(null)} disabled={savingEdit}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingEdit || !editForm.formState.isValid}>
              {savingEdit ? "Guardando..." : "Actualizar admin"}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
