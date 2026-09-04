"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  FilterX,
  Plus,
  Receipt,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Modal } from "@/components/shared/modal";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { SectionIntro } from "@/components/shared/section-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import {
  createExpense,
  deleteExpense,
  updateExpense,
  watchExpenses,
} from "@/features/finanzas/use-expenses";
import { detectAmountAnomaly } from "@/features/finanzas/expense-anomaly";
import { expenseSchema, type ExpenseFormValues } from "@/features/finanzas/schemas";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { useVendors } from "@/features/finanzas/use-vendors";
import { VendorRegistryDialog } from "@/components/features/finanzas/VendorRegistryDialog";
import { RepartirEgresoModal } from "@/components/features/finanzas/RepartirEgresoModal";
import { CuotasDelEgresoPanel } from "@/components/features/finanzas/CuotasDelEgresoPanel";
import { PlanDeCuotasField } from "@/components/features/finanzas/PlanDeCuotasField";
import { pagadoDelEgreso, proximaCuota } from "@/features/finanzas/cuotas-del-egreso";
import { pendienteDelEgreso } from "@/lib/finanzas/nucleo-estado-financiero";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { saveExpensePlanCallable } from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { Expense, ExpenseCategory, ExpenseStatus } from "@/types/domain";

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  nomina: "Nómina",
  servicios_publicos: "Servicios públicos",
  mantenimiento: "Mantenimiento",
  proveedores: "Proveedores",
  administracion: "Administración",
  seguros: "Seguros",
  impuestos: "Impuestos",
  vigilancia: "Vigilancia y seguridad",
  otros: "Otros",
};

const STATUS_LABELS: Record<ExpenseStatus, string> = {
  registrado: "Registrado",
  pagado: "Pagado",
  anulado: "Anulado",
};

const STATUS_CLASSES: Record<ExpenseStatus, string> = {
  registrado: "text-[var(--tinte-ambar-texto-1)]",
  pagado: "text-[var(--tinte-verde-texto-1)]",
  anulado: "text-[var(--slate-500)]",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transferencia: "Transferencia",
  cheque: "Cheque",
  efectivo: "Efectivo",
  otro: "Otro",
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_DEFAULTS: Partial<ExpenseFormValues> = {
  category: "proveedores",
  description: "",
  vendorId: "",
  vendorName: "",
  vendorTaxId: "",
  issueDate: today(),
  dueDate: "",
  status: "registrado",
  paymentMethod: "",
  checkNumber: "",
  bankAccountId: "",
};

export default function AdminEgresosPage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();

  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"all" | ExpenseStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | ExpenseCategory>("all");
  const [searchFilter, setSearchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const registroProveedores = useFeatureFlag("producto-registro-proveedores");
  const prorrateoDeGastos = useFeatureFlag("producto-prorrateo-de-gastos");
  // `PRD-V-FLOW-008`. **Apagada en los nueve**: sin ella no se puede declarar un
  // plan, así que `paidAmount` es siempre cero y la deuda es la de siempre.
  const egresosEnCuotas = useFeatureFlag("producto-egresos-en-cuotas");
  const [repartiendo, setRepartiendo] = useState<Expense | null>(null);
  const { vendors } = useVendors(registroProveedores ? user?.tenantId : undefined);
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false);

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: EMPTY_DEFAULTS,
  });
  const watchedMethod = form.watch("paymentMethod");

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    const unsub = watchExpenses(
      user.tenantId,
      (data) => {
        setItems(data);
        setErrorMessage(null);
        setLoading(false);
      },
      (message) => {
        setErrorMessage(message);
        toast.error(message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [user?.tenantId]);

  function openCreate() {
    setEditingItem(null);
    form.reset({ ...EMPTY_DEFAULTS, issueDate: today() });
    setCreateOpen(true);
  }

  function openEdit(item: Expense) {
    setEditingItem(item);
    form.reset({
      category: item.category,
      description: item.description,
      vendorId: item.vendorId ?? "",
      vendorName: item.vendorName ?? "",
      vendorTaxId: item.vendorTaxId ?? "",
      amount: item.amount,
      issueDate: item.issueDate,
      dueDate: item.dueDate ?? "",
      status: item.status,
      paymentMethod: item.paymentMethod ?? "",
      checkNumber: item.checkNumber ?? "",
      bankAccountId: item.bankAccountId ?? "",
      // Solo las cuotas, sin lo que sella el servidor: el formulario no reenvía
      // el estado ni el asiento de una cuota.
      installments: item.installments?.map((c) => ({
        number: c.number,
        dueDate: c.dueDate,
        amount: c.amount,
      })),
    });
    setCreateOpen(true);
  }

  async function handleSave(values: ExpenseFormValues) {
    if (!user?.tenantId) return;

    // Advertencia suave de monto atípico (VIV-1201): compara contra la mediana
    // del histórico de la misma categoría — atrapa el cero de más o de menos.
    const categoryHistory = items
      .filter((item) => item.category === values.category && item.id !== editingItem?.id)
      .map((item) => item.amount);
    const anomaly = detectAmountAnomaly(categoryHistory, values.amount);
    if (anomaly) {
      const ok = window.confirm(
        `El monto ${formatAmount(values.amount)} es inusualmente ${anomaly.direction === "low" ? "BAJO" : "ALTO"} para esta categoría (histórico típico: ${formatAmount(anomaly.median)}). ¿Registrar de todas formas?`,
      );
      if (!ok) return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    try {
      /**
       * **`PRD-V-FLOW-008` · `R8` · el plan va SIEMPRE por la callable.**
       *
       * El egreso se guarda como toda la vida —escritura directa, que las reglas
       * protegen— y el calendario después, por `saveExpensePlan`. Son dos pasos
       * porque el array sostiene la deuda del conjunto y **un campo escribible
       * desde el cliente no puede sostener un invariante**.
       *
       * **Si el segundo paso fallara**, queda un egreso sin su plan: se ve, se
       * edita y se vuelve a intentar. Es el orden que menos duele — al revés
       * habría un plan sin factura, que no se puede ni mirar.
       */
      const conPlan = egresosEnCuotas && (values.installments?.length ?? 0) > 0;
      const teniaPlan = (editingItem?.installments?.length ?? 0) > 0;

      if (editingItem) {
        await updateExpense(editingItem, user.uid, values);
        if (conPlan || teniaPlan) {
          await saveExpensePlanCallable({
            tenantId: user.tenantId,
            expenseId: editingItem.id,
            installments: values.installments,
          });
        }
        toast.success("Egreso actualizado.");
      } else {
        const nuevoId = await createExpense(user.tenantId, user.uid, values);
        if (conPlan) {
          await saveExpensePlanCallable({
            tenantId: user.tenantId,
            expenseId: nuevoId,
            installments: values.installments,
          });
        }
        toast.success("Egreso registrado.");
      }
      setCreateOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No fue posible guardar el egreso.");
      toastFirebaseError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDeletion) return;
    setDeleting(true);
    try {
      await deleteExpense(pendingDeletion);
      toast.success("Egreso eliminado.");
      setPendingDeletion(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setDeleting(false);
    }
  }

  const filteredItems = useMemo(() => {
    const query = searchFilter.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
      const matchesCategory = categoryFilter === "all" ? true : item.category === categoryFilter;
      const matchesSearch =
        query.length === 0
          ? true
          : `${item.description} ${item.vendorName ?? ""}`.toLowerCase().includes(query);
      const matchesFrom = !dateFrom ? true : item.issueDate >= dateFrom;
      const matchesTo = !dateTo ? true : item.issueDate <= dateTo;
      return matchesStatus && matchesCategory && matchesSearch && matchesFrom && matchesTo;
    });
  }, [items, statusFilter, categoryFilter, searchFilter, dateFrom, dateTo]);

  /**
   * **`PRD-V-FLOW-008` · esto era un CUARTO cálculo de la deuda, y no llamaba a
   * la función compartida.** Sumaba `item.amount` en un bucle propio, así que con
   * una factura en cuotas seguía enseñando el importe entero: pagada una cuota de
   * once, «Por pagar» no bajaba. Lo cazó mirar la pantalla en staging, después de
   * pagar de verdad.
   *
   * La ficha había contado **tres** consumidores —los que llaman a
   * `sumarDeudaAProveedores`— y esa medición encuentra **quién llama a la
   * función, no quién la duplica sin llamarla**.
   */
  const totals = useMemo(() => {
    let porPagar = 0;
    let pagado = 0;
    for (const item of filteredItems) {
      if (item.status === "anulado") continue;
      porPagar += pendienteDelEgreso(item);
      pagado += pagadoDelEgreso(item);
    }
    return { registrado: porPagar, pagado, porPagar };
  }, [filteredItems]);

  const activeFiltersCount =
    (statusFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (searchFilter.trim() ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const columns: DataTableColumn<Expense>[] = [
    {
      key: "description",
      header: "Descripción",
      render: (item) => (
        <div>
          <span className="font-medium text-[var(--slate-900)]">{item.description}</span>
          {item.vendorName ? (
            <span className="block text-xs text-[var(--slate-500)]">{item.vendorName}</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "category",
      header: "Categoría",
      render: (item) => <span className="text-[var(--slate-700)]">{CATEGORY_LABELS[item.category]}</span>,
    },
    {
      key: "amount",
      header: "Monto",
      className: "text-right",
      headerClassName: "text-right",
      render: (item) => <span className="font-medium text-[var(--slate-900)]">{formatAmount(item.amount)}</span>,
    },
    {
      key: "issueDate",
      header: "Emisión",
      render: (item) => <span className="text-[var(--slate-700)]">{item.issueDate}</span>,
    },
    {
      key: "dueDate",
      header: "Vence",
      /*
        `PRD-V-FLOW-008` · con plan, la fecha que importa **no es la de la
        factura: es la de la próxima cuota sin pagar**. Enseñar el `dueDate` de
        una póliza de once cuotas no dice nada de lo que hay que pagar este mes,
        que es lo único que se viene a mirar aquí.
      */
      render: (item) => {
        const proxima = egresosEnCuotas ? proximaCuota(item.installments) : undefined;
        if (!proxima) {
          return <span className="text-[var(--slate-700)]">{item.dueDate || "-"}</span>;
        }
        const total = item.installments?.length ?? 0;
        const pagadas = item.installments?.filter((c) => c.status === "pagada").length ?? 0;
        return (
          <span className="text-[var(--slate-700)]">
            {proxima.dueDate}
            <span className="ml-1.5 text-xs text-[var(--slate-500)]">
              cuota {proxima.number} de {total}
              {pagadas > 0 ? ` · ${pagadas} pagada${pagadas === 1 ? "" : "s"}` : ""}
            </span>
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Estado",
      render: (item) => <Badge className={STATUS_CLASSES[item.status]}>{STATUS_LABELS[item.status]}</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <SectionIntro
        storageKey="egresos"
            icon={Receipt}
            tone="lavender"
        purpose="Las cuentas por pagar y los pagos del conjunto: nómina, servicios públicos, mantenimiento y proveedores."
        how="Registras cada egreso y, al marcarlo como pagado, entra automáticamente como salida en el Libro y fondos."
      />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Egresos</CardTitle>
          <CardDescription className="mt-1">Cuentas por pagar y pagos del conjunto.</CardDescription>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {registroProveedores ? (
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => setVendorDialogOpen(true)}>
            Proveedores
          </Button>
        ) : null}
        <Button className="w-full sm:w-auto" onClick={openCreate}>
          <IconBadge tone="mint" className="mr-2">
            <Plus className="h-4 w-4" />
          </IconBadge>
          Registrar egreso
        </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Por pagar</p>
          <p className="mt-1 text-lg font-semibold text-[var(--tinte-ambar-texto-1)]">{formatAmount(totals.porPagar)}</p>
        </div>
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Pagado</p>
          <p className="mt-1 text-lg font-semibold text-[var(--tinte-verde-texto-1)]">{formatAmount(totals.pagado)}</p>
        </div>
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Egresos (filtro)</p>
          <p className="mt-1 text-lg font-semibold text-[var(--slate-900)]">{filteredItems.length}</p>
        </div>
      </div>

      {errorMessage ? <p className="mt-2 text-xs text-[var(--danger-700)]">{errorMessage}</p> : null}

      <div className="mt-4 space-y-3">
        <MobileFiltersPanel
          title="Filtros de egresos"
          collapsibleOnDesktop
          defaultOpen={false}
          openLabel="Filtros de egresos"
          closeLabel="Ocultar filtros"
          activeFiltersCount={activeFiltersCount}
          footer={
            <Button
              className="w-full md:w-auto"
              type="button"
              variant="outline"
              onClick={() => {
                setStatusFilter("all");
                setCategoryFilter("all");
                setSearchFilter("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              <IconBadge tone="sand" className="mr-2">
                <FilterX className="h-4 w-4" />
              </IconBadge>
              Limpiar filtros
            </Button>
          }
        >
          <label className="text-sm text-[var(--slate-700)]">
            Buscar
            <Input
              className="mt-1"
              placeholder="Descripción o proveedor"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
            />
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Estado
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | ExpenseStatus)}
            >
              <option value="all">Todos</option>
              <option value="registrado">Registrado</option>
              <option value="pagado">Pagado</option>
              <option value="anulado">Anulado</option>
            </select>
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Categoría
            <select
              className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as "all" | ExpenseCategory)}
            >
              <option value="all">Todas</option>
              {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Emisión desde
            <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} />
          </label>
          <label className="text-sm text-[var(--slate-700)]">
            Emisión hasta
            <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} />
          </label>
        </MobileFiltersPanel>

        <DataTable
          columns={columns}
          rows={filteredItems}
          getRowKey={(item) => item.id}
          loading={loading}
          loadingText="Cargando egresos..."
          emptyText="No hay egresos con los filtros actuales."
          errorText={errorMessage}
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[680px] sm:min-w-[760px]"
          onRowClick={(item) => openEdit(item)}
          renderActions={(item) => (
            <div className="flex justify-end">
              <RowActionsMenu
                ariaLabel={`Acciones para ${item.description}`}
                onView={() => openEdit(item)}
                onEdit={() => openEdit(item)}
                onDelete={() => setPendingDeletion(item)}
                extraItems={
                  // `FLOW-001` R1 · un egreso anulado no se reparte, y por eso
                  // no se ofrece: el servidor lo rechaza igualmente, pero
                  // enseñar una acción que siempre falla no es una guarda, es
                  // una trampa.
                  prorrateoDeGastos && item.status !== "anulado"
                    ? [
                        {
                          key: "repartir",
                          label: "Repartir entre unidades",
                          onSelect: () => setRepartiendo(item),
                        },
                      ]
                    : []
                }
              />
            </div>
          )}
        />
      </div>

      <RepartirEgresoModal
        open={repartiendo !== null}
        expense={repartiendo}
        tenantId={user?.tenantId ?? ""}
        formatAmount={formatAmount}
        onClose={() => setRepartiendo(null)}
      />

      <Modal open={createOpen} title={editingItem ? "Editar egreso" : "Registrar egreso"} onClose={() => setCreateOpen(false)}>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => void handleSave(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Descripción</label>
            <Input {...form.register("description")} placeholder="Pago de energía áreas comunes" />
            {form.formState.errors.description ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.description.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Categoría
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" {...form.register("category")}>
                {(Object.keys(CATEGORY_LABELS) as ExpenseCategory[]).map((key) => (
                  <option key={key} value={key}>
                    {CATEGORY_LABELS[key]}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Monto</label>
              <Input type="number" step="0.01" min="0" {...form.register("amount", { valueAsNumber: true })} placeholder="0" />
              {form.formState.errors.amount ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.amount.message}</p>
              ) : null}
            </div>
          </div>
          {registroProveedores ? (
            <label className="block text-sm text-[var(--slate-700)]">
              Beneficiario del registro
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm"
                value={form.watch("vendorId") ?? ""}
                onChange={(e) => {
                  const vendorId = e.target.value;
                  form.setValue("vendorId", vendorId);
                  const vendor = vendors.find((v) => v.id === vendorId);
                  if (vendor) {
                    // R2: el egreso congela nombre e identificación tal como
                    // están HOY en el registro. Editar el proveedor después no
                    // reescribe este egreso.
                    form.setValue("vendorName", vendor.legalName);
                    form.setValue("vendorTaxId", vendor.taxId ?? "");
                    if (vendor.defaultCategory) form.setValue("category", vendor.defaultCategory);
                  }
                }}
              >
                <option value="">Sin registro — escribir a mano</option>
                {vendors
                  .filter((v) => v.status === "active" || v.id === form.watch("vendorId"))
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.legalName}
                      {v.taxId ? ` — ${v.taxId}` : ""}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Proveedor
              <Input {...form.register("vendorName")} placeholder="Nombre del proveedor" />
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Identificación del proveedor
              <Input {...form.register("vendorTaxId")} placeholder="RUC / NIT / RFC" />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Fecha de emisión</label>
              <Input type="date" {...form.register("issueDate")} />
              {form.formState.errors.issueDate ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.issueDate.message}</p>
              ) : null}
            </div>
            <label className="text-sm text-[var(--slate-700)]">
              Vencimiento
              <Input type="date" {...form.register("dueDate")} />
            </label>
          </div>
          {/*
            `PRD-V-FLOW-008` · el calendario de pagos, detrás de su bandera.
            Con la bandera apagada el campo no existe, así que ningún egreso
            puede nacer con plan y la deuda a proveedores es la de siempre.
          */}
          {egresosEnCuotas && (
            <PlanDeCuotasField
              cuotas={form.watch("installments")}
              total={form.watch("amount")}
              onChange={(c) => form.setValue("installments", c, { shouldValidate: true })}
              formatAmount={formatAmount}
              disabled={submitting}
            />
          )}
          {/*
            **El error del esquema NO se pinta aquí, y no es un olvido.**
            `PlanDeCuotasField` ya enseña los problemas mientras se escribe, y con
            el formato de moneda del conjunto. Pintarlos otra vez daba el mismo
            aviso DUPLICADO —«faltan $ 1.000» y debajo «faltan 1.000», la segunda
            sin símbolo— porque el mensaje del esquema no conoce el formateador.
            Lo cazó mirar la pantalla en staging.

            El esquema **sigue guardando**: su `superRefine` invalida el
            formulario e impide guardar. Lo que se retira es la segunda copia del
            texto, no la protección.
          */}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Estado
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" {...form.register("status")}>
                <option value="registrado">Registrado</option>
                <option value="pagado">Pagado</option>
                <option value="anulado">Anulado</option>
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Método de pago
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-[var(--surface-strong)] px-3 text-sm" {...form.register("paymentMethod")}>
                <option value="">Sin definir</option>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {watchedMethod === "cheque" ? (
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Número de cheque</label>
              <Input {...form.register("checkNumber")} placeholder="No. de cheque" />
              {form.formState.errors.checkNumber ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.checkNumber.message}</p>
              ) : null}
            </div>
          ) : null}
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
        {/*
          `PRD-V-FLOW-008` entrega 2 · pagar y anular cuotas.

          **Va FUERA del `<form>` a propósito.** Cada cuota se paga por su cuenta,
          por callable, y no al guardar el egreso: meterlo dentro haría que el
          botón «Guardar» del formulario pareciera confirmar también los pagos.
          Y solo con el egreso YA guardado: no se paga una cuota de una factura
          que todavía no existe.
        */}
        {egresosEnCuotas && editingItem?.installments?.length ? (
          <div className="mt-4">
            <CuotasDelEgresoPanel
              egreso={items.find((e) => e.id === editingItem.id) ?? editingItem}
              formatAmount={formatAmount}
            />
          </div>
        ) : null}
      </Modal>

      {user?.tenantId && user.uid ? (
        <VendorRegistryDialog
          open={vendorDialogOpen}
          tenantId={user.tenantId}
          userId={user.uid}
          vendors={vendors}
          onClose={() => setVendorDialogOpen(false)}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={Boolean(pendingDeletion)}
        name={pendingDeletion?.description ?? ""}
        description={pendingDeletion ? "Esta acción eliminará el egreso del registro. No se puede deshacer." : null}
        loading={deleting}
        onCancel={() => (deleting ? undefined : setPendingDeletion(null))}
        onConfirm={() => void handleConfirmDelete()}
      />
      </Card>
    </div>
  );
}
