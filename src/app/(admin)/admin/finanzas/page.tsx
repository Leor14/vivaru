"use client";

import { ModulePreviewGate } from "@/components/shared/module-preview-gate";
import { ChartOfAccountsDialog } from "@/components/features/finanzas/ChartOfAccountsDialog";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  BookOpen,
  FileSpreadsheet,
  Plus,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { AdminVouchersCard } from "@/components/features/finanzas/AdminVouchersCard";
import { WidgetErrorBoundary } from "@/components/shared/widget-error-boundary";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MobileFiltersPanel } from "@/components/shared/mobile-filters-panel";
import { Modal } from "@/components/shared/modal";
import { SectionIntro } from "@/components/shared/section-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import { useFeatureFlag } from "@/lib/feature-flags/provider";
import { repartirRecaudo } from "@/lib/finanzas/conceptos-de-cargo";
import {
  computeFundPosition,
  createManualLedgerEntry,
  reverseLedgerEntry,
  watchLedger,
  movimientoEntraAlFondo,
} from "@/features/finanzas/use-ledger";
import { buildFinancialStatement, planParaInformes } from "@/features/finanzas/financial-statement";
import { useChartOfAccounts } from "@/features/finanzas/use-chart-of-accounts";
import { ledgerEntrySchema, type LedgerEntryFormValues } from "@/features/finanzas/schemas";
import { useAuth } from "@/features/auth/auth-context";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { revertPaymentCallable } from "@/lib/firebase/callables";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import { createDocumentRecord } from "@/features/admin/services";
import { RowActionsMenu } from "@/components/shared/row-actions-menu";
import { ensureSystemFolderCallable } from "@/lib/firebase/callables";
import { storage } from "@/lib/firebase/client";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import type { LedgerEntry } from "@/types/domain";

const today = () => new Date().toISOString().slice(0, 10);

function AdminFinanzasLibroPageContent() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const { items: statements } = useBillingStatements(user?.tenantId);

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<LedgerEntry | null>(null);
  // FIN-001. Revertir un PAGO no es lo mismo que anular un asiento: hay que
  // deshacer también la cuota y el comprobante, y eso solo lo puede hacer el
  // servidor en una transacción. Por eso va por su propia vía y no por
  // `reverseLedgerEntry`, que solo tocaría el libro y dejaría la cartera
  // diciendo que la cuota está pagada.
  const [pendingReversal, setPendingReversal] = useState<LedgerEntry | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [reverting, setReverting] = useState(false);
  // Una clave por reversión, generada al ABRIR el diálogo y no en cada envío:
  // si se regenerara al reintentar, la idempotencia no protegería de nada.
  const [reversalKey, setReversalKey] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [monthFilter, setMonthFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Filtro de movimientos por mes o rango (el rango tiene prioridad). Solo afecta la
  // tabla; el saldo de fondos sigue siendo acumulado.
  const monthOptions = useMemo(() => {
    const set = new Set(entries.map((e) => (e.date ?? "").slice(0, 7)).filter(Boolean));
    return Array.from(set).sort((a, b) => (a < b ? 1 : -1));
  }, [entries]);
  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      const d = e.date ?? "";
      if (dateFrom || dateTo) {
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      }
      if (monthFilter !== "all" && d.slice(0, 7) !== monthFilter) return false;
      return true;
    });
  }, [entries, monthFilter, dateFrom, dateTo]);
  const libroActiveFilters = (monthFilter !== "all" ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const form = useForm<LedgerEntryFormValues>({
    resolver: zodResolver(ledgerEntrySchema),
    defaultValues: { type: "ingreso", date: today(), concept: "", category: "", bankAccountId: "" },
  });

  useEffect(() => {
    if (!user?.tenantId) {
      setLoading(false);
      return;
    }
    const unsub = watchLedger(
      user.tenantId,
      (data) => {
        setEntries(data);
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

  // Entrega 1b-iii. Con la bandera apagada, `cuota` es el número de siempre y el
  // estado financiero enseña una sola línea de «Cuotas de administración».
  // Encendida, es el MISMO total repartido por concepto, y cada uno tiene su
  // línea. La suma no cambia (CA11): son los mismos cargos, solo agrupados.
  const conceptoAlLibro = useFeatureFlag("producto-concepto-al-libro");

  // Entrega 2. La bandera gobierna SOLO la edición: el plan sembrado sigue ahí y
  // los informes lo seguirán usando aunque esté apagada (ver `alApagar` en el
  // catálogo).
  //
  // La suscripción va FUERA de la bandera, y esto cambió al llegar R9: el
  // estado financiero agrupa por cuenta y saca las etiquetas del nombre de la
  // cuenta, así que el plan hace falta aunque la EDICIÓN esté apagada. Es lo que
  // dice el catálogo en `alApagar`: «el plan sembrado sigue ahí y los informes
  // lo siguen usando; solo desaparece la edición».
  const planDeCuentas = useFeatureFlag("producto-plan-de-cuentas");
  const { accounts: chartAccounts } = useChartOfAccounts(user?.tenantId);
  // Sin plan sembrado es `undefined`, y el estado se comporta como siempre.
  const planInformes = useMemo(() => planParaInformes(chartAccounts), [chartAccounts]);
  const recaudo = useMemo(() => repartirRecaudo(statements), [statements]);
  const cuotaIncome = recaudo.total;
  const cuotaParaEstado = conceptoAlLibro ? recaudo : recaudo.total;

  const fundPosition = useMemo(
    () => computeFundPosition(entries, cuotaIncome),
    [entries, cuotaIncome],
  );

  function openCreate() {
    form.reset({ type: "ingreso", date: today(), concept: "", category: "", bankAccountId: "" });
    setCreateOpen(true);
  }

  function handleExportStatement() {
    const statement = buildFinancialStatement(entries, cuotaParaEstado, 0, planInformes);
    const rows: (string | number)[][] = [
      ["Estado de ingresos y egresos"],
      [],
      ["INGRESOS"],
      ...statement.incomeByCategory.map((item) => [item.label, item.amount]),
      ["Total ingresos", statement.totalIncome],
      [],
      ["EGRESOS"],
      ...statement.expenseByCategory.map((item) => [item.label, item.amount]),
      ["Total egresos", statement.totalExpenses],
      [],
      ["Resultado del período", statement.netResult],
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Estado financiero");
    const movRows: (string | number)[][] = [
      ["Fecha", "Tipo", "Concepto", "Categoría", "Monto"],
      ...entries.map((entry) => [entry.date, entry.type, entry.concept, entry.category ?? "", entry.amount]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(movRows), "Movimientos");
    XLSX.writeFile(wb, `estado-financiero-${today()}.xlsx`);
  }

  const [savingLedgerDoc, setSavingLedgerDoc] = useState(false);
  async function handleSaveLedgerPeriod() {
    const tid = user?.tenantId;
    const uid = user?.uid;
    if (!tid || !uid || !storage) return;
    if (filteredEntries.length === 0) {
      toast.error("No hay movimientos con el filtro actual.");
      return;
    }
    const st = storage;
    const label = dateFrom || dateTo ? `${dateFrom || "inicio"}_a_${dateTo || "hoy"}` : monthFilter !== "all" ? monthFilter : "todos";
    setSavingLedgerDoc(true);
    try {
      const ingresos = filteredEntries.filter((e) => e.type === "ingreso").reduce((a, e) => a + (e.amount ?? 0), 0);
      const egresos = filteredEntries.filter((e) => e.type === "egreso").reduce((a, e) => a + (e.amount ?? 0), 0);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Fecha", "Tipo", "Concepto", "Categoría", "Monto"],
        ...filteredEntries.map((e) => [e.date, e.type, e.concept, e.category ?? "", e.amount]),
      ]), "Movimientos");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Resumen del período", label], [],
        ["Total ingresos", ingresos], ["Total egresos", egresos], ["Resultado neto", ingresos - egresos],
      ]), "Resumen");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const path = `tenants/${tid}/ledger-history/${label}-${Date.now()}.xlsx`;
      const sref = storageRef(st, path);
      await uploadBytes(sref, blob);
      const fileUrl = await getDownloadURL(sref);
      const { folderId } = await ensureSystemFolderCallable({ tenantId: tid, systemKey: "ledger_history" });
      await createDocumentRecord({
        tenantId: tid, userId: uid, userName: user?.fullName,
        fileName: `Libro-${label}.xlsx`, fileUrl, storagePath: path, fileSize: blob.size, contentType: blob.type,
        category: "financiero", description: `Libro — ${label}`, source: "ledger_period", sourceId: label, folderId,
      });
      toast.success("Período guardado en Documentos → “Histórico del libro”.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingLedgerDoc(false);
    }
  }

  async function handleSave(values: LedgerEntryFormValues) {
    if (!user?.tenantId) return;
    setSubmitting(true);
    try {
      await createManualLedgerEntry(user.tenantId, user.uid, values);
      toast.success("Movimiento registrado.");
      setCreateOpen(false);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReverse() {
    if (!pendingDeletion || !user?.tenantId) return;
    setDeleting(true);
    try {
      // Convención contable: el movimiento no se borra — se crea su asiento
      // inverso y el original queda anulado pero visible (trazabilidad).
      await reverseLedgerEntry(user.tenantId, user.uid, pendingDeletion);
      toast.success("Movimiento anulado: se creó el asiento inverso.");
      setPendingDeletion(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setDeleting(false);
    }
  }

  function abrirReversionDePago(item: LedgerEntry) {
    setPendingReversal(item);
    setReversalReason("");
    setReversalKey(`revert:${item.operationKey}:${crypto.randomUUID()}`);
  }

  async function handleConfirmRevertPayment() {
    if (!pendingReversal?.operationKey || !user?.tenantId) return;
    const motivo = reversalReason.trim();
    if (!motivo) {
      toast.error("Indica el motivo de la reversión.");
      return;
    }
    setReverting(true);
    try {
      const res = await revertPaymentCallable({
        tenantId: user.tenantId,
        operationKey: pendingReversal.operationKey,
        reversalKey,
        reason: motivo,
      });
      if (res.reversed) {
        // El recibo se anula solo, dentro de la misma transacción, desde el 20
        // de agosto de 2026. Antes esto avisaba de que había que emitir una nota
        // de crédito a mano — un paso que nadie perseguía.
        toast.success(
          res.voucherAnuladoId
            ? "Pago revertido: la cuota y el libro quedaron al día, y el recibo quedó anulado."
            : "Pago revertido: la cuota y el libro quedaron al día.",
        );
      } else {
        toast.info("Ese pago ya estaba revertido.");
      }
      setPendingReversal(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setReverting(false);
    }
  }

  const columns: DataTableColumn<LedgerEntry>[] = [
    {
      key: "date",
      header: "Fecha",
      render: (item) => <span className="text-[var(--slate-700)]">{item.date}</span>,
    },
    {
      key: "type",
      header: "Tipo",
      render: (item) => (
        <Badge className={item.type === "ingreso" ? "text-[#2f775f]" : "text-[#936b24]"}>
          {item.type === "ingreso" ? "Ingreso" : "Egreso"}
        </Badge>
      ),
    },
    {
      key: "concept",
      header: "Concepto",
      render: (item) => (
        <div>
          <span className="font-medium text-[var(--slate-900)]">{item.concept}</span>
          {item.sourceType === "expense" ? (
            <span className="block text-xs text-[var(--slate-500)]">Egreso pagado</span>
          ) : null}
        </div>
      ),
    },
    {
      key: "amount",
      header: "Monto",
      render: (item) => {
        // El signo y el color salen de si el movimiento ENTRA o SALE, no del
        // tipo: un reverso conserva el tipo y lleva monto negativo, así que
        // derivarlo del tipo pintaba «+-$430.000» en verde. Se muestra el valor
        // absoluto porque el signo ya lo pone esta línea.
        const entra = movimientoEntraAlFondo(item.type, item.amount);
        return (
          <span className={entra ? "font-medium text-[#2f775f]" : "font-medium text-[#936b24]"}>
            {entra ? "+" : "−"}
            {formatAmount(Math.abs(item.amount))}
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <SectionIntro
        storageKey="libro-fondos"
            icon={BookOpen}
            tone="lavender"
        title="Libro y fondos"
        purpose="El libro de ingresos y egresos y el saldo de fondos del conjunto."
        how="El recaudo de cuotas viene de Cartera y los egresos pagados entran automáticamente; aquí agregas movimientos manuales (saldo inicial, otros ingresos) y exportas el estado financiero."
      />
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>Libro y fondos</CardTitle>
          <CardDescription className="mt-1">Movimientos de ingresos y egresos del conjunto.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="w-full sm:w-auto" variant="outline" onClick={handleExportStatement}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Estado financiero
          </Button>
          {planDeCuentas ? (
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => setPlanOpen(true)}>
              <BookOpen className="mr-2 h-4 w-4" />
              Plan de cuentas
            </Button>
          ) : null}
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            <IconBadge tone="mint" className="mr-2">
              <Plus className="h-4 w-4" />
            </IconBadge>
            Registrar movimiento
          </Button>
        </div>
      </div>

      {fundPosition.balance < 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#e2b6b6] bg-[#FCEBEB] px-4 py-3 text-sm text-[#791F1F]">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden />
          <span>
            <strong>Fondo insuficiente.</strong> El saldo de fondos es negativo ({formatAmount(fundPosition.balance)}). Revisa los ingresos pendientes y evita registrar nuevos egresos hasta regularizarlo.
          </span>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          className={
            fundPosition.balance < 0
              ? "rounded-xl border border-[#e2b6b6] bg-[#FCEBEB] p-3"
              : "rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3"
          }
        >
          <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Saldo de fondos</p>
          <p className={`mt-1 text-lg font-semibold ${fundPosition.balance < 0 ? "text-[#A32D2D]" : "text-[#2c648d]"}`}>
            {formatAmount(fundPosition.balance)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Ingresos por cuotas</p>
          <p className="mt-1 text-lg font-semibold text-[#2f775f]">{formatAmount(fundPosition.cuotaIncome)}</p>
        </div>
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Otros ingresos</p>
          <p className="mt-1 text-lg font-semibold text-[#2f775f]">{formatAmount(fundPosition.ledgerIncome)}</p>
        </div>
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Egresos</p>
          <p className="mt-1 text-lg font-semibold text-[#936b24]">{formatAmount(fundPosition.expenses)}</p>
        </div>
      </div>

      {errorMessage ? <p className="mt-2 text-xs text-[var(--danger-700)]">{errorMessage}</p> : null}

      <div className="mt-4 space-y-3">
        <MobileFiltersPanel
          title="Filtros del libro"
          collapsibleOnDesktop
          defaultOpen={false}
          openLabel="Filtros del libro"
          closeLabel="Ocultar filtros"
          activeFiltersCount={libroActiveFilters}
          helpText="Filtra los movimientos por mes o por un rango de fechas (el rango tiene prioridad). No cambia el saldo de fondos, que es acumulado."
          footer={
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => { setMonthFilter("all"); setDateFrom(""); setDateTo(""); }}>
              Limpiar filtros
            </Button>
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm text-[var(--slate-700)]">
              Mes
              <select
                className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm disabled:opacity-60"
                value={monthFilter}
                disabled={Boolean(dateFrom || dateTo)}
                onChange={(e) => setMonthFilter(e.target.value)}
              >
                <option value="all">Todos</option>
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </label>
            <Input label="Desde" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input label="Hasta" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </MobileFiltersPanel>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-[var(--slate-500)]">
            {libroActiveFilters > 0 ? `${filteredEntries.length} de ${entries.length} movimientos` : `${entries.length} movimientos`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={savingLedgerDoc || filteredEntries.length === 0}
            onClick={() => void handleSaveLedgerPeriod()}
          >
            {savingLedgerDoc ? "Guardando..." : "Guardar período en Documentos"}
          </Button>
        </div>

        <DataTable
          columns={columns}
          rows={filteredEntries}
          getRowKey={(item) => item.id}
          loading={loading}
          loadingText="Cargando movimientos..."
          emptyText={libroActiveFilters > 0 ? "No hay movimientos con los filtros actuales." : "Aún no hay movimientos registrados."}
          errorText={errorMessage}
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[640px] sm:min-w-[720px]"
          renderActions={(item) => {
            if (item.sourceType === "reversal") {
              return <span className="block text-right text-xs text-[var(--slate-500)]">Reverso</span>;
            }
            if (item.reversedByEntryId) {
              return <span className="block text-right text-xs text-[var(--slate-500)]">Anulado</span>;
            }
            if (item.sourceType === "billingStatement" && item.operationKey) {
              return (
                <div className="flex justify-end">
                  <RowActionsMenu
                    ariaLabel={`Acciones para ${item.concept}`}
                    items={[
                      {
                        key: "revert-payment",
                        label: "Revertir pago",
                        icon: <Undo2 className="h-4 w-4" />,
                        danger: true,
                        onSelect: () => abrirReversionDePago(item),
                      },
                    ]}
                  />
                </div>
              );
            }
            if (item.sourceType === "manual") {
              return (
                <div className="flex justify-end">
                  <RowActionsMenu
                    ariaLabel={`Acciones para ${item.concept}`}
                    items={[
                      {
                        key: "reverse",
                        label: "Reversar movimiento",
                        icon: <Undo2 className="h-4 w-4" />,
                        danger: true,
                        onSelect: () => setPendingDeletion(item),
                      },
                    ]}
                  />
                </div>
              );
            }
            return <span className="block text-right text-xs text-[var(--slate-500)]">Automático</span>;
          }}
        />
      </div>

      <Modal open={createOpen} title="Registrar movimiento" onClose={() => setCreateOpen(false)}>
        <form className="space-y-3" onSubmit={form.handleSubmit((values) => void handleSave(values))}>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Tipo
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...form.register("type")}>
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
            </label>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Fecha</label>
              <Input type="date" {...form.register("date")} />
              {form.formState.errors.date ? (
                <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.date.message}</p>
              ) : null}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Concepto</label>
            <Input {...form.register("concept")} placeholder="Saldo inicial / Otros ingresos" />
            {form.formState.errors.concept ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.concept.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Monto</label>
            <Input type="number" step="0.01" min="0" {...form.register("amount", { valueAsNumber: true })} placeholder="0" />
            {form.formState.errors.amount ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{form.formState.errors.amount.message}</p>
            ) : null}
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={submitting}>
              {submitting ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingReversal)}
        title="Revertir pago"
        onClose={() => (reverting ? undefined : setPendingReversal(null))}
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--slate-700)]">
            Se creará el asiento inverso y la cuota volverá a quedar con saldo. Si el pago
            vino de un comprobante del residente, ese comprobante quedará rechazado con
            este motivo.
          </p>
          <p className="text-sm text-[var(--slate-700)]">
            El comprobante fiscal, si lo hubo, <strong>no se anula aquí</strong>: eso pide
            una nota de crédito.
          </p>
          <label className="block text-sm text-[var(--slate-700)]">
            Motivo de la reversión
            <textarea
              className="mt-1 min-h-20 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 py-2 text-sm"
              value={reversalReason}
              onChange={(event) => setReversalReason(event.target.value)}
              placeholder="Por ejemplo: se registró en la unidad equivocada."
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={reverting}
              onClick={() => setPendingReversal(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={reverting || !reversalReason.trim()}
              onClick={() => void handleConfirmRevertPayment()}
            >
              {reverting ? "Revirtiendo..." : "Revertir pago"}
            </Button>
          </div>
        </div>
      </Modal>

      {planDeCuentas && user?.tenantId && user?.uid ? (
        <ChartOfAccountsDialog
          open={planOpen}
          tenantId={user.tenantId}
          userId={user.uid}
          accounts={chartAccounts}
          onClose={() => setPlanOpen(false)}
        />
      ) : null}

      <ConfirmDeleteDialog
        open={Boolean(pendingDeletion)}
        name={pendingDeletion?.concept ?? ""}
        title={pendingDeletion ? `Reversar "${pendingDeletion.concept}"` : undefined}
        confirmLabel="Reversar movimiento"
        description={
          pendingDeletion
            ? `Se creará un asiento inverso por ${pendingDeletion.amount.toLocaleString("es-CO")} y el movimiento original quedará anulado pero visible en el libro. Los registros contables no se eliminan, para conservar la trazabilidad ante auditorías.`
            : null
        }
        loading={deleting}
        onCancel={() => (deleting ? undefined : setPendingDeletion(null))}
        onConfirm={() => void handleConfirmReverse()}
      />
      </Card>

      {/*
        Los recibos emitidos, para la administración. Van aquí y no en Cartera
        porque son el registro del dinero que entró, igual que el libro — y
        porque la columna «Comprobante» de Cartera ya significa otra cosa: el
        archivo que SUBE el residente como prueba de pago.

        Envuelto porque el error boundary de la ruta convierte cualquier fallo
        de un widget en la pantalla de «No pudimos cargar el workspace»: sin
        esto, un tropiezo leyendo recibos tumbaría el libro entero.
      */}
      <WidgetErrorBoundary label="los recibos emitidos">
        <AdminVouchersCard />
      </WidgetErrorBoundary>
    </div>
  );
}

/**
 * Durante la prueba este módulo es VISTA PREVIA: se explora con datos de
 * ejemplo pero no se opera (ver src/lib/config/trial-modules.ts). Para un
 * cliente activo, el gate es transparente.
 */
export default function AdminFinanzasLibroPage() {
  return (
    <ModulePreviewGate module="finanzas">
      <AdminFinanzasLibroPageContent />
    </ModulePreviewGate>
  );
}
