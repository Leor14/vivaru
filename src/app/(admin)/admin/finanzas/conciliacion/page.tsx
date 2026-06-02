"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Link2, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { createBankAccount, watchBankAccounts } from "@/features/finanzas/use-bank-accounts";
import { watchLedger } from "@/features/finanzas/use-ledger";
import {
  deleteBankStatementLine,
  importBankStatementLines,
  matchLine,
  unmatchLine,
  watchBankStatementLines,
} from "@/features/finanzas/use-reconciliation";
import { bankAccountSchema, type BankAccountFormValues } from "@/features/finanzas/schemas";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BankAccount, BankStatementLine, LedgerEntry } from "@/types/domain";

export default function AdminConciliacionPage() {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [lines, setLines] = useState<BankStatementLine[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);
  const [matchTarget, setMatchTarget] = useState<BankStatementLine | null>(null);

  const accountForm = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: { label: "", bankName: "", accountNumber: "", accountType: "corriente", currency: "COP", openingBalance: 0, active: true },
  });

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub = watchBankAccounts(
      user.tenantId,
      (data) => {
        setAccounts(data);
        setSelectedAccountId((prev) => prev || data.find((a) => a.active)?.id || data[0]?.id || "");
      },
      (message) => toast.error(message),
    );
    return () => unsub();
  }, [user?.tenantId]);

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsubLedger = watchLedger(user.tenantId, setLedger, () => undefined);
    return () => unsubLedger();
  }, [user?.tenantId]);

  useEffect(() => {
    if (!user?.tenantId || !selectedAccountId) {
      setLines([]);
      return;
    }
    const unsub = watchBankStatementLines(
      user.tenantId,
      (data) => {
        setLines(data);
        setErrorMessage(null);
      },
      (message) => setErrorMessage(message),
      selectedAccountId,
    );
    return () => unsub();
  }, [user?.tenantId, selectedAccountId]);

  const unreconciledLedger = useMemo(() => ledger.filter((entry) => !entry.reconciled), [ledger]);
  const summary = useMemo(() => {
    const reconciled = lines.filter((l) => l.reconciled).length;
    return { total: lines.length, reconciled, pending: lines.length - reconciled };
  }, [lines]);

  async function handleSaveAccount(values: BankAccountFormValues) {
    if (!user?.tenantId) return;
    setSavingAccount(true);
    try {
      await createBankAccount(user.tenantId, user.uid, values);
      toast.success("Cuenta bancaria creada.");
      setAccountModalOpen(false);
      accountForm.reset();
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleImport(file: File) {
    if (!user?.tenantId || !selectedAccountId) {
      toast.error("Selecciona o crea una cuenta bancaria primero.");
      return;
    }
    setImporting(true);
    try {
      const text = await file.text();
      const result = await importBankStatementLines(user.tenantId, user.uid, selectedAccountId, text);
      if (result.imported === 0) {
        toast.error("No se reconocieron líneas. Revisa que el CSV tenga columnas de fecha y monto.");
      } else {
        toast.success(`${result.imported} líneas importadas${result.skipped ? `, ${result.skipped} omitidas` : ""}.`);
      }
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleMatch(entry: LedgerEntry) {
    if (!matchTarget || !user?.uid) return;
    try {
      await matchLine(matchTarget, entry, user.uid);
      toast.success("Conciliado.");
      setMatchTarget(null);
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function handleUnmatch(line: BankStatementLine) {
    if (!user?.uid) return;
    try {
      await unmatchLine(line, user.uid);
      toast.success("Conciliación deshecha.");
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  async function handleDeleteLine(line: BankStatementLine) {
    if (!user?.uid) return;
    try {
      await deleteBankStatementLine(line, user.uid);
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  const matchCandidates = useMemo(() => {
    if (!matchTarget) return unreconciledLedger;
    const target = Math.abs(matchTarget.amount);
    return [...unreconciledLedger].sort((a, b) => {
      const da = Math.abs(Math.abs(a.amount) - target);
      const db2 = Math.abs(Math.abs(b.amount) - target);
      return da - db2;
    });
  }, [matchTarget, unreconciledLedger]);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle help="Importa el extracto bancario (CSV) y concilia cada línea con un movimiento del libro. Así verificas que lo registrado coincide con lo que efectivamente entró o salió del banco.">
            Conciliación bancaria
          </CardTitle>
          <CardDescription className="mt-1">Importa el extracto y cuádralo contra el libro.</CardDescription>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setAccountModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar cuenta
        </Button>
      </div>

      {accounts.length === 0 ? (
        <p className="mt-4 rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm text-[var(--slate-600)]">
          Aún no hay cuentas bancarias. Agrega una para empezar a conciliar.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-[var(--slate-700)]">
            Cuenta
            <select
              className="mt-1 h-10 w-full min-w-[220px] rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label} · {account.bankName}
                </option>
              ))}
            </select>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          <Button
            className="w-full sm:w-auto"
            disabled={importing || !selectedAccountId}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            {importing ? "Importando..." : "Importar extracto CSV"}
          </Button>
        </div>
      )}

      {errorMessage ? <p className="mt-2 text-xs text-[var(--danger-700)]">{errorMessage}</p> : null}

      {accounts.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Líneas importadas</p>
            <p className="mt-1 text-lg font-semibold text-[var(--slate-900)]">{summary.total}</p>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Conciliadas</p>
            <p className="mt-1 text-lg font-semibold text-[#2f775f]">{summary.reconciled}</p>
          </div>
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3">
            <p className="text-xs uppercase tracking-wide text-[var(--slate-500)]">Sin conciliar</p>
            <p className="mt-1 text-lg font-semibold text-[#936b24]">{summary.pending}</p>
          </div>
        </div>
      ) : null}

      {lines.length > 0 ? (
        <ul className="mt-4 divide-y divide-[var(--slate-100)]">
          {lines.map((line) => (
            <li key={line.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--slate-900)]">
                  {line.date} · {formatAmount(line.amount)}
                </p>
                <p className="truncate text-xs text-[var(--slate-500)]">{line.description || "Sin descripción"}</p>
              </div>
              <div className="flex items-center gap-2">
                {line.reconciled ? (
                  <>
                    <Badge className="text-[#2f775f]">
                      <Check className="mr-1 h-3 w-3" />
                      Conciliada
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => void handleUnmatch(line)}>
                      Deshacer
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setMatchTarget(line)}>
                    <Link2 className="mr-2 h-4 w-4" />
                    Conciliar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Eliminar línea"
                  onClick={() => void handleDeleteLine(line)}
                >
                  <Trash2 className="h-4 w-4 text-[var(--danger-700)]" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : accounts.length > 0 ? (
        <p className="mt-4 text-sm text-[var(--slate-500)]">
          Importa un extracto para ver las líneas a conciliar.
        </p>
      ) : null}

      {/* Modal: agregar cuenta bancaria */}
      <Modal open={accountModalOpen} title="Agregar cuenta bancaria" onClose={() => setAccountModalOpen(false)}>
        <form className="space-y-3" onSubmit={accountForm.handleSubmit((values) => void handleSaveAccount(values))}>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Nombre de la cuenta</label>
            <Input {...accountForm.register("label")} placeholder="Cuenta operativa" />
            {accountForm.formState.errors.label ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{accountForm.formState.errors.label.message}</p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--slate-700)]">Banco</label>
            <Input {...accountForm.register("bankName")} placeholder="Banco" />
            {accountForm.formState.errors.bankName ? (
              <p className="mt-1 text-xs text-[var(--danger-700)]">{accountForm.formState.errors.bankName.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Tipo
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...accountForm.register("accountType")}>
                <option value="corriente">Corriente</option>
                <option value="ahorros">Ahorros</option>
              </select>
            </label>
            <label className="text-sm text-[var(--slate-700)]">
              Moneda
              <select className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm" {...accountForm.register("currency")}>
                <option value="COP">COP</option>
                <option value="MXN">MXN</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-[var(--slate-700)]">
              Número de cuenta (opcional)
              <Input className="mt-1" {...accountForm.register("accountNumber")} placeholder="****1234" />
            </label>
            <div>
              <label className="mb-1 block text-sm text-[var(--slate-700)]">Saldo inicial</label>
              <Input type="number" step="0.01" {...accountForm.register("openingBalance", { valueAsNumber: true })} placeholder="0" />
            </div>
          </div>
          <div className="mobile-action-group">
            <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={() => setAccountModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="w-full sm:w-auto" type="submit" disabled={savingAccount}>
              {savingAccount ? "Guardando..." : "Guardar cuenta"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: conciliar línea con movimiento del libro */}
      <Modal open={Boolean(matchTarget)} title="Conciliar con un movimiento" onClose={() => setMatchTarget(null)}>
        {matchTarget ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm">
              <p className="text-[var(--slate-700)]">
                Línea del banco: <strong>{formatAmount(matchTarget.amount)}</strong> · {matchTarget.date}
              </p>
              <p className="text-xs text-[var(--slate-500)]">{matchTarget.description || "Sin descripción"}</p>
            </div>
            {matchCandidates.length === 0 ? (
              <p className="text-sm text-[var(--slate-500)]">
                No hay movimientos del libro sin conciliar. Registra el ingreso o egreso primero.
              </p>
            ) : (
              <ul className="max-h-[320px] space-y-2 overflow-y-auto">
                {matchCandidates.map((entry) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      className="w-full rounded-xl border border-[var(--slate-200)] p-3 text-left hover:border-[var(--brand-400)]"
                      onClick={() => void handleMatch(entry)}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-[var(--slate-900)]">{entry.concept}</span>
                        <span className={entry.type === "ingreso" ? "text-[#2f775f]" : "text-[#936b24]"}>
                          {entry.type === "ingreso" ? "+" : "−"}
                          {formatAmount(entry.amount)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-[var(--slate-500)]">{entry.date}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
