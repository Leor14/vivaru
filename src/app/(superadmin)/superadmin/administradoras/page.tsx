"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Modal } from "@/components/shared/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  managementCompanyCreateSchema,
  type ManagementCompanyInput,
} from "@/features/superadmin/schemas";
import {
  watchManagementCompanies,
  watchTenants,
  type ManagementCompanyItem,
  type TenantWorkspaceItem,
} from "@/features/superadmin/services";
import {
  saveManagementCompanyCallable,
  setTenantManagementCompanyCallable,
} from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";

/**
 * **Consola de empresas administradoras** — `PRD-V-PLAT-002` §7.1, paso 3.
 *
 * Solo superadmin, y no por interfaz: la colección está cerrada a todo lo demás
 * en las reglas, y las dos escrituras van por callable. Esta pantalla es el
 * único sitio donde se opera, porque G5 lo pone en el alta comercial.
 *
 * **Dos ejes que NO se mezclan.** Asociar un conjunto es comercial; dar acceso a
 * una persona es operativo (R6). Desde aquí solo se hace lo primero: asociar un
 * conjunto **no crea ni borra ninguna membresía**, y por eso no hay ningún botón
 * que lo sugiera.
 */
export default function SuperadminAdministradorasPage() {
  const [companies, setCompanies] = useState<ManagementCompanyItem[]>([]);
  const [tenants, setTenants] = useState<TenantWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagementCompanyItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [asociando, setAsociando] = useState<string | null>(null);

  const form = useForm<ManagementCompanyInput>({
    resolver: zodResolver(managementCompanyCreateSchema),
    defaultValues: { name: "", country: "CO", taxId: "", contactEmail: "", contactPhone: "", status: "active" },
  });

  useEffect(() => {
    const parar = watchManagementCompanies(
      (items) => {
        setCompanies(items);
        setLoading(false);
      },
      (mensaje) => {
        toast.error(mensaje);
        setLoading(false);
      },
    );
    return () => parar();
  }, []);

  useEffect(() => {
    const parar = watchTenants(setTenants, (mensaje) => toast.error(mensaje));
    return () => parar();
  }, []);

  /** Cuántos conjuntos lleva cada una. Es el número que dice si esto sirve. */
  const conjuntosPorAdministradora = useMemo(() => {
    const cuenta = new Map<string, TenantWorkspaceItem[]>();
    for (const t of tenants) {
      if (!t.managementCompanyId) continue;
      const lista = cuenta.get(t.managementCompanyId) ?? [];
      lista.push(t);
      cuenta.set(t.managementCompanyId, lista);
    }
    return cuenta;
  }, [tenants]);

  const sueltos = useMemo(() => tenants.filter((t) => !t.managementCompanyId), [tenants]);

  function abrirAlta() {
    setEditing(null);
    form.reset({ name: "", country: "CO", taxId: "", contactEmail: "", contactPhone: "", status: "active" });
    setFormOpen(true);
  }

  function abrirEdicion(item: ManagementCompanyItem) {
    setEditing(item);
    form.reset({
      name: item.name,
      country: item.country,
      taxId: item.taxId ?? "",
      contactEmail: item.contactEmail ?? "",
      contactPhone: item.contactPhone ?? "",
      status: item.status,
    });
    setFormOpen(true);
  }

  async function guardar(valores: ManagementCompanyInput) {
    setSaving(true);
    try {
      const r = await saveManagementCompanyCallable({ ...valores, id: editing?.id });
      // El renombrado se propaga a sus conjuntos, y decirlo importa: es una
      // escritura que la persona no pidió explícitamente.
      toast.success(
        r.conjuntosRenombrados > 0
          ? `Guardada. Se actualizó el nombre en ${r.conjuntosRenombrados} conjunto(s).`
          : "Administradora guardada.",
      );
      setFormOpen(false);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSaving(false);
    }
  }

  async function cambiarAsociacion(tenantId: string, managementCompanyId: string | null) {
    setAsociando(tenantId);
    try {
      await setTenantManagementCompanyCallable({ tenantId, managementCompanyId });
      toast.success(managementCompanyId ? "Conjunto asociado." : "Conjunto desasociado.");
    } catch (error) {
      // El rechazo de R5 llega con su mensaje escrito: «ya pertenece a otra
      // administradora, desasócialo primero». No se reescribe aquí.
      toastFirebaseError(error);
    } finally {
      setAsociando(null);
    }
  }

  const columnas: DataTableColumn<ManagementCompanyItem>[] = [
    { key: "name", header: "Administradora", render: (item) => <span className="font-medium">{item.name}</span> },
    { key: "country", header: "País", render: (item) => item.country },
    { key: "taxId", header: "Identificación", render: (item) => item.taxId ?? "—" },
    {
      key: "conjuntos",
      header: "Conjuntos",
      render: (item) => String((conjuntosPorAdministradora.get(item.id) ?? []).length),
    },
    {
      key: "status",
      header: "Estado",
      render: (item) => (
        <Badge className={item.status === "active" ? "" : "opacity-60"}>
          {item.status === "active" ? "Activa" : "Inactiva"}
        </Badge>
      ),
    },
    {
      key: "acciones",
      header: "Acciones",
      render: (item) => (
        <Button type="button" variant="outline" size="sm" onClick={() => abrirEdicion(item)}>
          Editar
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Empresas administradoras</CardTitle>
            <CardDescription>
              Una administradora agrupa varios conjuntos. Asociar uno es una decisión comercial:{" "}
              <strong>no da acceso a nadie</strong> — el acceso son las membresías de cada persona.
            </CardDescription>
          </div>
          <Button type="button" onClick={abrirAlta}>
            Nueva administradora
          </Button>
        </div>
      </Card>

      {!loading && companies.length === 0 ? (
        <EmptyState
          title="Todavía no hay administradoras"
          description="Los conjuntos funcionan sin ella: una administradora solo hace falta cuando la misma empresa lleva varios."
        />
      ) : (
        <DataTable
          rows={companies}
          columns={columnas}
          getRowKey={(item) => item.id}
          loading={loading}
          emptyText="Todavía no hay administradoras."
        />
      )}

      <Card className="p-5">
        <CardTitle>Conjuntos y su administradora</CardTitle>
        <CardDescription>
          Para mover un conjunto de una administradora a otra hay que desasociarlo primero. Es a
          propósito: pasar conjuntos de dueño no debería ser un descuido.
        </CardDescription>

        <div className="mt-4 space-y-2">
          {tenants.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--slate-200)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-[var(--slate-900)]">{t.name}</p>
                <p className="text-xs text-[var(--slate-500)]">
                  {t.managementCompanyName ?? "Conjunto suelto"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {t.managementCompanyId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={asociando === t.id}
                    onClick={() => void cambiarAsociacion(t.id, null)}
                  >
                    Desasociar
                  </Button>
                ) : (
                  <select
                    aria-label={`Asociar ${t.name} a una administradora`}
                    className="rounded-lg border border-[var(--slate-200)] px-2 py-1 text-sm"
                    disabled={asociando === t.id || companies.length === 0}
                    value=""
                    onChange={(evento) => {
                      if (evento.target.value) void cambiarAsociacion(t.id, evento.target.value);
                    }}
                  >
                    <option value="">Sin administradora</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ))}
          {sueltos.length === tenants.length && tenants.length > 0 ? (
            <p className="px-1 pt-1 text-xs text-[var(--slate-500)]">
              Ningún conjunto tiene administradora todavía, y eso es normal: funcionan igual sin ella.
            </p>
          ) : null}
        </div>
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar administradora" : "Nueva administradora"}
      >
        <form className="space-y-3" onSubmit={form.handleSubmit(guardar)}>
          <div>
            <label className="text-sm text-[var(--slate-700)]">Nombre</label>
            <Input {...form.register("name")} placeholder="Administra S.A." />
            <p className="text-xs text-[var(--danger-700)]">{form.formState.errors.name?.message}</p>
          </div>
          <div>
            <label className="text-sm text-[var(--slate-700)]">País (dos letras)</label>
            <Input {...form.register("country")} placeholder="CO" maxLength={2} />
            <p className="text-xs text-[var(--danger-700)]">{form.formState.errors.country?.message}</p>
          </div>
          <div>
            <label className="text-sm text-[var(--slate-700)]">Identificación fiscal (opcional)</label>
            <Input {...form.register("taxId")} />
          </div>
          <div>
            <label className="text-sm text-[var(--slate-700)]">Correo de contacto (opcional)</label>
            <Input {...form.register("contactEmail")} />
            <p className="text-xs text-[var(--danger-700)]">{form.formState.errors.contactEmail?.message}</p>
          </div>
          <div>
            <label className="text-sm text-[var(--slate-700)]">Teléfono de contacto (opcional)</label>
            <Input {...form.register("contactPhone")} />
          </div>
          <div>
            <label className="text-sm text-[var(--slate-700)]">Estado</label>
            <select
              className="w-full rounded-lg border border-[var(--slate-200)] px-2 py-2 text-sm"
              {...form.register("status")}
            >
              <option value="active">Activa</option>
              <option value="inactive">Inactiva</option>
            </select>
            {/* R4: dejarlo dicho aquí evita que alguien la desactive creyendo
                que con eso corta el servicio de sus conjuntos. */}
            <p className="mt-1 text-xs text-[var(--slate-500)]">
              Desactivarla <strong>no suspende sus conjuntos</strong>: cada uno conserva su propio estado.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
