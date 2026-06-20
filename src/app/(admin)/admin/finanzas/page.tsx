"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import * as XLSX from "xlsx";

import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { Modal } from "@/components/shared/modal";
import { SectionIntro } from "@/components/shared/section-intro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";
import { Input } from "@/components/ui/input";
import { useBillingStatements } from "@/features/billing/use-billing-statements";
import {
  computeFundPosition,
  createManualLedgerEntry,
  deleteLedgerEntry,
  watchLedger,
} from "@/features/finanzas/use-ledger";
import { buildFinancialStatement } from "@/features/finanzas/financial-statement";
import { ledgerEntrySchema, type LedgerEntryFormValues } from "@/features/finanzas/schemas";
import { useAuth } from "@/features/auth/auth-context";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { LedgerEntry } from "@/types/domain";

const today = () => new Date().toISOString().slice(0, 10);

export default function AdminFinanzasLibroPage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const { items: statements } = useBillingStatements(user?.tenantId);

  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<LedgerEntry | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  const cuotaIncome = useMemo(
    () => statements.reduce((sum, item) => sum + (item.paymentAmount ?? 0), 0),
    [statements],
  );

  const fundPosition = useMemo(
    () => computeFundPosition(entries, cuotaIncome),
    [entries, cuotaIncome],
  );

  function openCreate() {
    form.reset({ type: "ingreso", date: today(), concept: "", category: "", bankAccountId: "" });
    setCreateOpen(true);
  }

  function handleExportStatement() {
    const statement = buildFinancialStatement(entries, cuotaIncome);
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

  async function handleConfirmDelete() {
    if (!pendingDeletion) return;
    setDeleting(true);
    try {
      await deleteLedgerEntry(pendingDeletion.id);
      toast.success("Movimiento eliminado.");
      setPendingDeletion(null);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setDeleting(false);
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
      render: (item) => (
        <span className={item.type === "ingreso" ? "font-medium text-[#2f775f]" : "font-medium text-[#936b24]"}>
          {item.type === "ingreso" ? "+" : "−"}
          {formatAmount(item.amount)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionIntro
        storageKey="libro-fondos"
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
          <Button className="w-full sm:w-auto" onClick={openCreate}>
            <IconBadge tone="mint" className="mr-2">
              <Plus className="h-4 w-4" />
            </IconBadge>
            Registrar movimiento
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
          <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Saldo de fondos</p>
          <p className="mt-1 text-lg font-semibold text-[#2c648d]">{formatAmount(fundPosition.balance)}</p>
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

      <div className="mt-4">
        <DataTable
          columns={columns}
          rows={entries}
          getRowKey={(item) => item.id}
          loading={loading}
          loadingText="Cargando movimientos..."
          emptyText="Aún no hay movimientos registrados."
          errorText={errorMessage}
          actionsHeader="Acciones"
          tableMinWidthClassName="min-w-[640px] sm:min-w-[720px]"
          renderActions={(item) =>
            item.sourceType === "manual" ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  aria-label={`Eliminar ${item.concept}`}
                  onClick={() => setPendingDeletion(item)}
                >
                  <Trash2 className="h-4 w-4 text-[var(--danger-700)]" />
                </Button>
              </div>
            ) : (
              <span className="block text-right text-xs text-[var(--slate-400)]">Automático</span>
            )
          }
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

      <ConfirmDeleteDialog
        open={Boolean(pendingDeletion)}
        name={pendingDeletion?.concept ?? ""}
        description={pendingDeletion ? "Esta acción eliminará el movimiento del libro. No se puede deshacer." : null}
        loading={deleting}
        onCancel={() => (deleting ? undefined : setPendingDeletion(null))}
        onConfirm={() => void handleConfirmDelete()}
      />
      </Card>
    </div>
  );
}
