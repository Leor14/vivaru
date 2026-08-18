"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { toastFirebaseError } from "@/lib/utils/error-handler";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Modal } from "@/components/shared/modal";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
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
  convertTenantToCustomer,
  extendTrial,
  markTrialAsLost,
  setTenantStatus,
  updateTenantWorkspace,
  watchTenants,
  createTenantWorkspace,
  type TenantWorkspaceItem,
} from "@/features/superadmin/services";
import {
  watchOnboardingSummaries,
  type OnboardingSummary,
} from "@/features/onboarding/services";
import { useAuth } from "@/features/auth/auth-context";
import { watchSalesReps, type SalesRep } from "@/features/superadmin/sales-reps";
import { doc, getDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { CURRENCY_OPTIONS } from "@/lib/currency";
import {
  DEFAULT_MODULE_VARIANTS,
  MODULE_VARIANT_META,
  VARIANT_EDITABILITY,
} from "@/lib/config/module-variants";
import { VariantOptionPicker } from "@/components/shared/variant-option-picker";

const ONBOARDING_OPTIONS = ["not_started", "in_progress", "completed"] as const;
const TENANT_STATUS_OPTIONS = ["active", "trial", "suspended", "expired"] as const;

/** Etiqueta y tono por estado del ambiente (ver docs/plan-self-service-trial.md §8). */
const STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: "Cliente", className: "bg-emerald-100 text-emerald-700" },
  trial: { label: "En prueba", className: "bg-amber-100 text-amber-700" },
  expired: { label: "Vencido", className: "bg-red-100 text-red-700" },
  suspended: { label: "Suspendido", className: "bg-[var(--slate-200)] text-[var(--slate-700)]" },
};

/** Días que faltan para que venza la prueba (negativo = ya venció). */
function daysLeft(trialEndsAt?: string): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / 86400000);
}

export default function SuperadminTenantsPage() {
  const [tenants, setTenants] = useState<TenantWorkspaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWorkspaceItem | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);
  const [lockedAck, setLockedAck] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "trial" | "suspended" | "expired">("all");
  const [onboardingFilter, setOnboardingFilter] = useState<"all" | "not_started" | "in_progress" | "completed">("all");
  const [searchFilter, setSearchFilter] = useState("");
  // Conversión de prueba a cliente (acción central de la consola).
  const [convertTarget, setConvertTarget] = useState<TenantWorkspaceItem | null>(null);
  // Sin selector: Vivaru se contrata completo, no por planes ni por módulos.
  const convertPlan = "completo";
  // Quién VENDIÓ (REVOPS-001E) — distinto de quién ejecuta la conversión.
  // Se precarga con el dueño del lead cuando el ambiente nació de uno.
  const [convertVendedor, setConvertVendedor] = useState("");
  const [converting, setConverting] = useState(false);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const { user } = useAuth();

  const createForm = useForm<TenantCreateInput>({
    resolver: zodResolver(tenantCreateSchema),
    defaultValues: {
      name: "",
      city: "",
      planId: "starter",
      status: "trial",
      onboardingStatus: "not_started",
      currency: "COP",
      moduleVariants: DEFAULT_MODULE_VARIANTS,
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
      currency: "COP",
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

  useEffect(() => {
    const unsub = watchSalesReps(setReps, () => undefined);
    return () => unsub();
  }, []);

  const repById = useMemo(() => new Map(reps.map((r) => [r.id, r])), [reps]);

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
      currency: tenant.currency,
    });
  }

  async function handleCreate(values: TenantCreateInput) {
    setSavingCreate(true);
    try {
      // "expired" solo se alcanza venciendo una prueba, nunca al crear.
      const status = values.status === "expired" ? "trial" : values.status;
      await createTenantWorkspace({ ...values, status });
      toast.success("Tenant creado correctamente.");
      setCreateOpen(false);
      createForm.reset();
      setLockedAck(false);
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

  async function handleConvert() {
    if (!convertTarget || !user?.uid) return;
    setConverting(true);
    try {
      await convertTenantToCustomer({
        tenantId: convertTarget.id,
        planId: convertPlan,
        convertedByUid: user.uid,
        ...(convertVendedor ? { vendedorId: convertVendedor } : {}),
      });
      toast.success(`${convertTarget.name} ahora es cliente. Se conservó toda su configuración.`);
      setConvertTarget(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setConverting(false);
    }
  }

  async function handleLost(tenant: TenantWorkspaceItem) {
    const motivo = window.prompt(
      `¿Por qué se perdió ${tenant.name}? (precio, competencia, no era el perfil, sin respuesta…)`,
    );
    if (!motivo?.trim()) return;
    try {
      await markTrialAsLost({ tenantId: tenant.id, leadId: tenant.leadId, motivo: motivo.trim() });
      toast.success("Marcado como perdido.");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function handleExtend(tenant: TenantWorkspaceItem) {
    const raw = window.prompt(`¿Cuántos días extender la prueba de ${tenant.name}?`, "7");
    const days = Number(raw);
    if (!raw || !Number.isFinite(days) || days <= 0) return;
    try {
      await extendTrial(tenant.id, days);
      toast.success(`Prueba extendida ${days} días.`);
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

  const [onboardingByTenant, setOnboardingByTenant] = useState<Record<string, OnboardingSummary>>({});
  useEffect(() => watchOnboardingSummaries(setOnboardingByTenant), []);

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
      header: "Ciudad · Vendedor",
      render: (tenant) => {
        const rep = tenant.vendedorId ? repById.get(tenant.vendedorId) : undefined;
        return (
          <div>
            <p>{tenant.city}</p>
            <p className="text-xs text-[var(--slate-500)]">
              {rep ? rep.name : tenant.vendedorId ? `···${tenant.vendedorId.slice(-6)}` : "Sin vendedor"}
            </p>
          </div>
        );
      },
    },
    {
      key: "plan",
      header: "Plan",
      render: (tenant) => tenant.planId,
    },
    {
      key: "status",
      header: "Estado",
      render: (tenant) => {
        const meta = STATUS_META[tenant.status] ?? { label: tenant.status, className: "" };
        return <Badge className={meta.className}>{meta.label}</Badge>;
      },
    },
    {
      key: "vigencia",
      header: "Vigencia",
      // Semáforo de la prueba: verde >7 días, ámbar 3–7, rojo <3, gris vencido.
      render: (tenant) => {
        const left = daysLeft(tenant.trialEndsAt);
        if (tenant.status === "active") {
          return <span className="text-xs text-[var(--slate-500)]">{tenant.convertedAt ? "Convertido" : "—"}</span>;
        }
        if (left === null) return <span className="text-xs text-[var(--slate-400)]">—</span>;
        if (left < 0) return <span className="text-xs font-medium text-[var(--danger-700)]">Venció hace {Math.abs(left)} d</span>;
        const tone = left > 7 ? "text-emerald-700" : left >= 3 ? "text-amber-700" : "text-[var(--danger-700)]";
        return <span className={`text-xs font-medium ${tone}`}>{left} día{left === 1 ? "" : "s"}</span>;
      },
    },
    {
      key: "activacion",
      header: "Activación",
      // Cuánto avanzó el prospecto en la guía de puesta en marcha. Es la señal
      // más útil para priorizar a quién llamar: quien va 5 de 7 está enganchado;
      // quien lleva 0 al quinto día necesita una mano, no un correo automático.
      render: (tenant) => {
        const summary = onboardingByTenant[tenant.id];
        if (!summary || summary.activationTotal === 0) {
          return <span className="text-xs text-[var(--slate-400)]">Sin datos</span>;
        }
        const complete = summary.activationDone >= summary.activationTotal;
        const tone = complete
          ? "text-emerald-700"
          : summary.activationDone === 0
            ? "text-[var(--danger-700)]"
            : "text-amber-700";
        return (
          <div>
            <p className={`text-xs font-semibold ${tone}`}>
              {summary.activationDone} de {summary.activationTotal}
            </p>
            {summary.discoveryDone > 0 ? (
              <p className="text-xs text-[var(--slate-500)]">
                {summary.discoveryDone} módulos recorridos
              </p>
            ) : null}
          </div>
        );
      },
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
          <Button className="w-full sm:w-auto" onClick={() => { setLockedAck(false); setCreateOpen(true); }}>Crear tenant</Button>
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
          renderActions={(tenant) => {
            const enPrueba = tenant.status === "trial" || tenant.status === "expired";
            return (
              <div className="flex flex-wrap justify-end gap-2">
                {enPrueba ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setConvertVendedor("");
                      setConvertTarget(tenant);
                      // El caso normal: quien trabajó el lead es quien vendió.
                      if (tenant.leadId && db) {
                        void getDoc(doc(db, "leads", tenant.leadId))
                          .then((snap) => {
                            const ownerId = (snap.data() as { ownerId?: string } | undefined)?.ownerId;
                            if (ownerId) setConvertVendedor((prev) => prev || ownerId);
                          })
                          .catch(() => undefined);
                      }
                    }}
                  >
                    Convertir a cliente
                  </Button>
                ) : null}
                <Button size="sm" variant="outline" onClick={() => openEditTenant(tenant)}>
                  Editar
                </Button>
                <RowActionsMenu
                  ariaLabel={`Acciones para ${tenant.name}`}
                  items={[
                    ...(enPrueba
                      ? [
                          { key: "extend", label: "Extender prueba…", onSelect: () => void handleExtend(tenant) },
                          { key: "lost", label: "Marcar como perdido…", onSelect: () => void handleLost(tenant) },
                        ]
                      : []),
                    {
                      key: "toggle",
                      label: tenant.status === "suspended" ? "Reactivar" : "Suspender",
                      danger: tenant.status !== "suspended",
                      onSelect: () => void handleToggleStatus(tenant),
                    },
                  ]}
                />
              </div>
            );
          }}
        />
      </Card>

      {/* Conversión de prueba a cliente: la acción central de la consola.
          Se muestra explícitamente qué se conserva, porque el argumento de
          venta es justamente que NO se migra ni se pierde nada. */}
      <Modal
        open={convertTarget !== null}
        title="Convertir a cliente"
        onClose={() => (converting ? undefined : setConvertTarget(null))}
      >
        {convertTarget ? (
          <div className="space-y-3 text-sm text-[var(--slate-700)]">
            <p>
              Vas a convertir <strong>{convertTarget.name}</strong> ({convertTarget.city}) en cliente.
            </p>
            <ul className="list-disc space-y-1 rounded-xl bg-[var(--surface-soft)] p-3 pl-7 text-xs text-[var(--slate-600)]">
              <li>Se conserva <strong>todo</strong> lo que configuró: unidades, residentes y su operación.</li>
              <li>Queda con el <strong>servicio completo</strong>: se desbloquean todos los módulos que estaban en vista previa.</li>
              <li>Se elimina la fecha de vencimiento de la prueba.</li>
              <li>No se mueve ningún documento — por eso funciona igual con una prueba ya vencida.</li>
            </ul>
            <label className="block text-sm">
              Vendedor
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
                value={convertVendedor}
                onChange={(e) => setConvertVendedor(e.target.value)}
              >
                <option value="">Sin registrar (se puede corregir después… a mano)</option>
                {reps.filter((r) => r.active).map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-[var(--slate-500)]">
                Quién vendió este conjunto. En México el canal se lleva casi la mitad del precio:
                sin este dato la comisión no se reatribuye después.
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setConvertTarget(null)} disabled={converting}>
                Cancelar
              </Button>
              <Button onClick={() => void handleConvert()} disabled={converting}>
                {converting ? "Convirtiendo…" : "Convertir a cliente"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

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
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Moneda</label>
            <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...createForm.register("currency")}>
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--slate-50)] p-3">
            <p className="text-sm font-semibold text-[var(--slate-900)]">Modos de operación</p>
            <p className="mb-3 text-xs text-[var(--slate-600)]">
              Define cómo opera cada módulo. Finanzas y Gobernanza se fijan aquí al crear el conjunto.
            </p>
            <div className="space-y-5">
              {MODULE_VARIANT_META.map((mod) => (
                <VariantOptionPicker
                  key={mod.key}
                  meta={mod}
                  value={createForm.watch(`moduleVariants.${mod.key}`) ?? DEFAULT_MODULE_VARIANTS[mod.key]}
                  editability={VARIANT_EDITABILITY[mod.key]}
                  context="create"
                  onSelect={(value) =>
                    createForm.setValue(`moduleVariants.${mod.key}`, value as never, { shouldDirty: true })
                  }
                />
              ))}
            </div>
            <label className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-amber-300 accent-amber-600"
                checked={lockedAck}
                onChange={(e) => setLockedAck(e.target.checked)}
              />
              <span>
                Entiendo que <strong>Finanzas</strong> y <strong>Gobernanza</strong> se fijan al crear el
                conjunto y no se pueden cambiar después.
              </span>
            </label>
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingCreate || !lockedAck}>
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
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Moneda</label>
            <select className="h-11 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...editForm.register("currency")}>
              {CURRENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
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
