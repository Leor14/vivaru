"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { ConjuntosConAcceso } from "@/components/features/superadmin/ConjuntosConAcceso";
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
  buscarCuentaPorCorreo,
  conjuntosDeAdministrador,
  createTenantAdminWorkspace,
  listTenantAdmins,
  setTenantAdminAccessWorkspace,
  updateTenantAdminWorkspace,
  watchTenants,
  type AdminWorkspaceItem,
  type TenantWorkspaceItem,
} from "@/features/superadmin/services";
import type { PlanDeAccesoDeAdministrador } from "@/lib/firebase/callables";

/**
 * Un cambio de conjuntos que el servidor ya PLANEÓ (`simular`) y espera la confirmación
 * del superadmin. El aviso sale del plan: lo que se lee aquí lo escribe el mismo sitio que
 * decide (`PRD-V-PLAT-002` §16.5).
 */
type Confirmacion = {
  origen: "crear" | "editar";
  uid: string;
  tenantIds: string[];
  titulo: string;
  detalle: string[];
  aviso: string | null;
  boton: string;
  confirmarCambioDeRol: boolean;
};

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
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [aplicando, setAplicando] = useState(false);

  const createForm = useForm<AdminCreateInput>({
    resolver: zodResolver(adminCreateSchema),
    mode: "onChange",
    defaultValues: { tenantIds: [], fullName: "", email: "", status: "active" },
  });

  const editForm = useForm<AdminUpdateInput>({
    resolver: zodResolver(adminUpdateSchema),
    mode: "onChange",
    defaultValues: { uid: "", tenantIds: [], fullName: "", email: "", status: "active" },
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

  const nombreDe = (id: string) => tenants.find((tenant) => tenant.id === id)?.name ?? id;

  function resumirPlan(plan: PlanDeAccesoDeAdministrador): string[] {
    const lineas: string[] = [];
    const nuevos = [...plan.crear, ...plan.convertir];
    if (nuevos.length > 0) lineas.push(`Se le da acceso a: ${nuevos.map(nombreDe).join(", ")}.`);
    if (plan.quitar.length > 0) lineas.push(`Se le quita el acceso a: ${plan.quitar.map(nombreDe).join(", ")}.`);
    if (plan.devolverAResidente.length > 0) {
      lineas.push(`Vuelve a ser residente en: ${plan.devolverAResidente.map(nombreDe).join(", ")}.`);
    }
    return lineas;
  }

  function botonPara(plan: PlanDeAccesoDeAdministrador): string {
    if (plan.rolFinal === "resident") return "Entiendo, que vuelva a residente";
    if (plan.requiereConfirmacion) return "Entiendo, darle acceso";
    return "Confirmar";
  }

  function cerrarCreacion() {
    setCreateOpen(false);
    setConfirmacion(null);
    createForm.reset({ tenantIds: [], fullName: "", email: "", status: "active" });
  }

  function cerrarEdicion() {
    setEditingAdmin(null);
    setConfirmacion(null);
  }

  function openEditAdmin(admin: AdminWorkspaceItem) {
    setEditingAdmin(admin);
    setConfirmacion(null);
    editForm.reset({
      uid: admin.uid,
      tenantIds: admin.tenantIds,
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
      const fullName = values.fullName.trim();
      const tenantIds = [...new Set(values.tenantIds)];
      const existente = await buscarCuentaPorCorreo(email);

      if (!existente) {
        await createTenantAdminWorkspace({ tenantIds, fullName, email, status: values.status });
        // El backend genera el enlace y envía el correo (Resend, marca Vivaru).
        toast.success(
          tenantIds.length > 1
            ? `Admin creado con acceso a ${tenantIds.length} conjuntos. Se le envió un correo para definir su contraseña.`
            : "Admin creado. Se le envió un correo para definir su contraseña.",
        );
        cerrarCreacion();
        await reloadAdmins(selectedTenant || undefined);
        return;
      }

      // `PLAT-002` entrega 2: el correo ya tiene cuenta y no se crea otra. A un admin se le
      // SUMAN los marcados a los suyos; un residente pasa por el aviso; portería y
      // superadmin los rechaza el servidor al simular, con su motivo.
      const esAdmin = existente.role === "tenant_admin" || existente.role === "admin_tenant";
      const actuales = esAdmin ? await conjuntosDeAdministrador(existente.uid) : [];
      const pedidos = [...new Set([...actuales, ...tenantIds])];
      const { plan } = await setTenantAdminAccessWorkspace({ uid: existente.uid, tenantIds: pedidos, simular: true });
      const detalle = resumirPlan(plan);
      if (detalle.length === 0) {
        toast.info(`${existente.fullName || email} ya tiene acceso a esos conjuntos.`);
        return;
      }
      setConfirmacion({
        origen: "crear",
        uid: existente.uid,
        tenantIds: pedidos,
        titulo: esAdmin
          ? `Ese correo ya administra ${actuales.map(nombreDe).join(", ")}. ¿Darle también acceso a los marcados?`
          : `Ese correo ya tiene cuenta: ${existente.fullName || email}.`,
        detalle,
        aviso: plan.aviso,
        boton: esAdmin && !plan.requiereConfirmacion ? "Darle también acceso" : botonPara(plan),
        confirmarCambioDeRol: plan.requiereConfirmacion,
      });
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
    if (savingEdit || !editingAdmin) return;
    setSavingEdit(true);
    try {
      const admin = editingAdmin;
      const datos = {
        uid: admin.uid,
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        status: values.status,
      };
      const cambianDatos = datos.fullName !== admin.fullName || datos.email !== admin.email || datos.status !== admin.status;
      const pedidos = [...new Set(values.tenantIds)];
      const cambianConjuntos =
        pedidos.length !== admin.tenantIds.length || pedidos.some((id) => !admin.tenantIds.includes(id));

      if (cambianDatos) {
        await updateTenantAdminWorkspace(datos);
      }

      if (cambianConjuntos) {
        const { plan } = await setTenantAdminAccessWorkspace({ uid: admin.uid, tenantIds: pedidos, simular: true });
        // Añadir un conjunto a un admin va directo. Quitar, devolver a residente o cambiar
        // de rol se confirman sobre el plan del servidor.
        const debeConfirmar = plan.requiereConfirmacion || plan.quitar.length > 0 || plan.devolverAResidente.length > 0;
        if (debeConfirmar) {
          if (cambianDatos) toast.success("Datos guardados. Falta confirmar el cambio de conjuntos.");
          setConfirmacion({
            origen: "editar",
            uid: admin.uid,
            tenantIds: pedidos,
            titulo: `Cambiar los conjuntos de ${datos.fullName}`,
            detalle: resumirPlan(plan),
            aviso: plan.aviso,
            boton: botonPara(plan),
            confirmarCambioDeRol: plan.requiereConfirmacion,
          });
          return;
        }
        await setTenantAdminAccessWorkspace({ uid: admin.uid, tenantIds: pedidos });
      }

      toast.success(cambianDatos || cambianConjuntos ? "Admin actualizado." : "Sin cambios.");
      cerrarEdicion();
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

  async function aplicarConfirmacion() {
    if (!confirmacion || aplicando) return;
    setAplicando(true);
    try {
      await setTenantAdminAccessWorkspace({
        uid: confirmacion.uid,
        tenantIds: confirmacion.tenantIds,
        confirmarCambioDeRol: confirmacion.confirmarCambioDeRol,
      });
      toast.success("Conjuntos actualizados.");
      if (confirmacion.origen === "crear") cerrarCreacion();
      else cerrarEdicion();
      await reloadAdmins(selectedTenant || undefined);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setAplicando(false);
    }
  }

  async function handleToggleStatus(admin: AdminWorkspaceItem) {
    const targetStatus = admin.status === "active" ? "inactive" : "active";
    const cuantos = admin.tenantIds.length;
    const pregunta =
      targetStatus === "inactive"
        ? `¿Desactivar a ${admin.fullName}? Pierde el acceso a todos sus conjuntos${cuantos > 1 ? ` (${cuantos})` : ""}.`
        : `¿Activar a ${admin.fullName}?`;
    if (!window.confirm(pregunta)) {
      return;
    }

    try {
      await updateTenantAdminWorkspace({
        uid: admin.uid,
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
      const matchesTenant = selectedTenant ? admin.tenantIds.includes(selectedTenant) : true;
      const matchesStatus = statusFilter === "all" ? true : admin.status === statusFilter;
      const conjuntos = admin.tenantIds.map((id) => tenants.find((tenant) => tenant.id === id)?.name ?? id).join(" ");
      const matchesSearch =
        query.length === 0 ? true : `${admin.fullName} ${admin.email} ${conjuntos}`.toLowerCase().includes(query);
      return matchesTenant && matchesStatus && matchesSearch;
    });
  }, [admins, selectedTenant, statusFilter, searchFilter, tenants]);

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
      header: "Conjuntos",
      render: (admin) => (admin.tenantIds.length > 0 ? admin.tenantIds.map(nombreDe).join(", ") : "—"),
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

  function panelDeConfirmacion(actual: Confirmacion) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-[var(--slate-900)]">{actual.titulo}</p>
        {actual.detalle.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--slate-700)]">
            {actual.detalle.map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
        ) : null}
        {actual.aviso ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{actual.aviso}</div>
        ) : null}
        <div className="mobile-action-group">
          <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setConfirmacion(null)} disabled={aplicando}>
            Volver
          </Button>
          <Button className="w-full sm:w-auto" type="button" onClick={() => void aplicarConfirmacion()} disabled={aplicando}>
            {aplicando ? "Aplicando..." : actual.boton}
          </Button>
        </div>
      </div>
    );
  }

  const marcadosAlCrear = createForm.watch("tenantIds");
  const marcadosAlEditar = editForm.watch("tenantIds");

  return (
    <section className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Usuarios administradores</CardTitle>
            <CardDescription className="mt-1">
              Crear, editar, dar acceso a uno o varios conjuntos y activar/desactivar admins.
            </CardDescription>
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
              Conjunto
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={selectedTenant}
                onChange={(event) => setSelectedTenant(event.target.value)}
              >
                <option value="">Todos los conjuntos</option>
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
                placeholder="Nombre, correo o conjunto"
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
                {admin.status === "active" ? "Desactivar (todos sus conjuntos)" : "Activar"}
              </Button>
            </div>
          )}
        />
      </Card>

      <Modal open={createOpen} title="Crear admin" onClose={cerrarCreacion}>
        {confirmacion?.origen === "crear" ? (
          panelDeConfirmacion(confirmacion)
        ) : (
          <form className="space-y-3" onSubmit={createForm.handleSubmit((values) => void handleCreate(values))}>
            <ConjuntosConAcceso
              conjuntos={tenants}
              marcados={marcadosAlCrear}
              onChange={(ids) => createForm.setValue("tenantIds", ids, { shouldValidate: true })}
              disabled={savingCreate}
            />
            {createForm.formState.errors.tenantIds ? (
              <p className="text-xs text-[var(--danger-700)]">{createForm.formState.errors.tenantIds.message}</p>
            ) : null}
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
              Al crear el admin se le enviará un correo para que defina su propia contraseña. Si el correo ya tiene
              cuenta, no se crea otra: te diremos qué se le cambia antes de hacerlo.
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Estado</label>
              <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...createForm.register("status")}>
                <option value="active">active</option>
                <option value="inactive">inactive</option>
              </select>
            </div>
            <div className="mobile-action-group">
              <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={cerrarCreacion} disabled={savingCreate}>
                Cancelar
              </Button>
              <Button className="w-full sm:w-auto" type="submit" disabled={savingCreate || !createForm.formState.isValid}>
                {savingCreate ? "Guardando..." : "Crear admin"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(editingAdmin)} title="Editar admin" onClose={cerrarEdicion}>
        {confirmacion?.origen === "editar" ? (
          panelDeConfirmacion(confirmacion)
        ) : (
          <form className="space-y-3" onSubmit={editForm.handleSubmit((values) => void handleEdit(values))}>
            <input type="hidden" {...editForm.register("uid")} />
            <ConjuntosConAcceso
              conjuntos={tenants}
              marcados={marcadosAlEditar}
              onChange={(ids) => editForm.setValue("tenantIds", ids, { shouldValidate: true, shouldDirty: true })}
              disabled={savingEdit}
            />
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
                <option value="inactive">inactive — pierde el acceso a todos sus conjuntos</option>
              </select>
            </div>
            <div className="mobile-action-group">
              <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={cerrarEdicion} disabled={savingEdit}>
                Cancelar
              </Button>
              <Button className="w-full sm:w-auto" type="submit" disabled={savingEdit || !editForm.formState.isValid}>
                {savingEdit ? "Guardando..." : "Actualizar admin"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}
