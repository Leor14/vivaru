"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeStatementStatus } from "@/features/billing/statement-status";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";

export type BillingEditRecord = {
  id: string;
  unitId: string;
  unitLabel: string;
  period: string;
  amount: number;
  paymentAmount: number;
  balance: number;
  dueDate?: string;
};

type BillingEditDrawerProps = {
  open: boolean;
  record: BillingEditRecord | null;
  saving: boolean;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRequestSubmit?: (submit: (() => Promise<boolean>) | null) => void;
  onSave: (input: {
    id: string;
    unitId: string;
    unitLabel: string;
    period: string;
    amount: number;
    paymentAmount: number;
    balance: number;
    dueDate?: string;
  }) => Promise<void>;
};

function parseCurrency(value: string) {
  const cleaned = value.replace(/[^0-9-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeStatus(balance: number, dueDate?: string, period?: string) {
  const status = computeStatementStatus(balance, { dueDate, period });
  return status === "paid" ? "Al dia" : status === "overdue" ? "En mora" : "Pendiente";
}

function logDebug(event: string, payload?: Record<string, unknown>) {
  if (process.env.NODE_ENV === "production") return;
  if (payload) {
    console.info(event, payload);
    return;
  }
  console.info(event);
}

export function BillingEditDrawer({ open, record, saving, onClose, onDirtyChange, onRequestSubmit, onSave }: BillingEditDrawerProps) {
  const { formatAmount } = useTenantCurrency();
  const [mounted, setMounted] = useState(open);
  const [isVisible, setIsVisible] = useState(open);
  const [unitLabel, setUnitLabel] = useState("");
  const [period, setPeriod] = useState("");
  const [amount, setAmount] = useState("0");
  const [paymentAmount, setPaymentAmount] = useState("0");
  const [dueDate, setDueDate] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDiscardChanges, setShowDiscardChanges] = useState(false);

  useEffect(() => {
    logDebug("billing:effect:mount-visibility", { open });
    if (open) {
      setMounted(true);
      const timer = window.setTimeout(() => setIsVisible(true), 10);
      return () => window.clearTimeout(timer);
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 220);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    logDebug("billing:effect:sync-record-form", { open, id: record?.id ?? null });
    if (!open || !record) return;
    setUnitLabel(record.unitLabel || "");
    setPeriod(record.period || "");
    setAmount(String(record.amount || 0));
    setPaymentAmount(String(record.paymentAmount || 0));
    setDueDate(record.dueDate || "");
    setErrorMessage(null);
    setShowDiscardChanges(false);
  }, [open, record]);

  const initialValues = useMemo(() => {
    if (!record) {
      return {
        unitLabel: "",
        period: "",
        amount: 0,
        paymentAmount: 0,
        dueDate: "",
      };
    }

    return {
      unitLabel: (record.unitLabel || "").trim(),
      period: record.period || "",
      amount: record.amount || 0,
      paymentAmount: record.paymentAmount || 0,
      dueDate: record.dueDate || "",
    };
  }, [record]);

  const parsedAmount = useMemo(() => parseCurrency(amount), [amount]);
  const parsedPayment = useMemo(() => parseCurrency(paymentAmount), [paymentAmount]);
  const computedBalance = Math.max(parsedAmount - parsedPayment, 0);
  const computedStatus = computeStatus(computedBalance, dueDate || undefined, period);
  const isDirty =
    unitLabel.trim() !== initialValues.unitLabel ||
    period !== initialValues.period ||
    parsedAmount !== initialValues.amount ||
    parsedPayment !== initialValues.paymentAmount ||
    dueDate !== initialValues.dueDate;

  useEffect(() => {
    logDebug("billing:effect:dirty-change", { open, isDirty });
    onDirtyChange?.(open ? isDirty : false);
  }, [isDirty, onDirtyChange, open]);

  const requestClose = useCallback(() => {
    if (saving) return;

    if (isDirty) {
      setShowDiscardChanges(true);
      return;
    }

    setShowDiscardChanges(false);
    onClose();
  }, [isDirty, onClose, saving]);

  const handleConfirmDiscard = useCallback(() => {
    setShowDiscardChanges(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, requestClose]);

  const submitCurrent = useCallback(async () => {
    logDebug("billing:edit:start", { id: record?.id ?? null });
    if (!record) return false;

    if (!unitLabel.trim() || !period.trim()) {
      setErrorMessage("Completa los campos obligatorios antes de guardar.");
      return false;
    }

    setErrorMessage(null);
    try {
      await onSave({
        id: record.id,
        unitId: record.unitId,
        unitLabel: unitLabel.trim(),
        period,
        amount: parsedAmount,
        paymentAmount: parsedPayment,
        balance: computedBalance,
        dueDate: dueDate || undefined,
      });
      logDebug("billing:edit:success", { id: record.id });
      setShowDiscardChanges(false);
      onClose();
      return true;
    } catch (saveError) {
      logDebug("billing:edit:error", {
        id: record.id,
        message: saveError instanceof Error ? saveError.message : "unknown",
      });
      setErrorMessage(saveError instanceof Error ? saveError.message : "No fue posible actualizar el registro.");
      return false;
    }
  }, [computedBalance, onClose, onSave, parsedAmount, parsedPayment, period, record, dueDate, unitLabel]);

  useEffect(() => {
    logDebug("billing:effect:register-submit", { open, id: record?.id ?? null });
    if (!onRequestSubmit) return;

    if (open && record) {
      onRequestSubmit(() => submitCurrent());
      return;
    }

    onRequestSubmit(null);
  }, [onRequestSubmit, open, record, submitCurrent]);

  useEffect(() => {
    return () => onRequestSubmit?.(null);
  }, [onRequestSubmit]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitCurrent();
  }

  if (!mounted || !record) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Editar registro de cartera">
      <button
        type="button"
        aria-label="Cerrar panel"
        className={`absolute inset-0 bg-black/25 transition-opacity duration-200 md:bg-black/10 ${isVisible ? "opacity-100" : "opacity-0"}`}
        onClick={requestClose}
      />

      <aside className={`absolute right-0 top-0 flex h-full w-full flex-col border-l border-[var(--slate-200)] bg-white shadow-2xl transition-transform duration-200 ease-out sm:w-[92vw] md:w-[480px] ${isVisible ? "translate-x-0" : "translate-x-full"}`}>
        <header className="flex items-start justify-between gap-3 border-b border-[var(--slate-200)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--slate-900)]">Editar registro de cartera</h2>
            <p className="mt-1 text-sm text-[var(--slate-600)]">Apartamento: <strong>{record.unitLabel || "-"}</strong></p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={requestClose} disabled={saving}>
            Cerrar
          </Button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {errorMessage ? (
              <div className="rounded-xl border border-[var(--danger-300)] bg-[var(--danger-50)] px-3 py-2 text-sm text-[var(--danger-700)]">
                {errorMessage}
              </div>
            ) : null}

            <label className="block text-sm text-[var(--slate-700)]">
              Apartamento
              <Input
                key={`billing-edit-first-field-${record.id}`}
                autoFocus
                className="mt-1"
                value={unitLabel}
                onChange={(event) => setUnitLabel(event.target.value)}
                placeholder="T1-101"
              />
            </label>

            <label className="block text-sm text-[var(--slate-700)]">
              Fecha
              <Input
                type="month"
                className="mt-1"
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
              />
            </label>

            <label className="block text-sm text-[var(--slate-700)]">
              Monto
              <Input className="mt-1" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>

            <label className="block text-sm text-[var(--slate-700)]">
              Abono
              <Input className="mt-1" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
            </label>

            <label className="block text-sm text-[var(--slate-700)]">
              Saldo
              <Input className="mt-1" value={formatAmount(computedBalance)} readOnly />
            </label>

            <label className="block text-sm text-[var(--slate-700)]">
              Fecha limite
              <Input
                type="date"
                className="mt-1"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            <label className="block text-sm text-[var(--slate-700)]">
              Estado
              <Input className="mt-1" value={computedStatus} readOnly />
            </label>
          </div>

          <footer className="border-t border-[var(--slate-200)] bg-white px-5 py-4">
            {showDiscardChanges ? (
              <div className="mb-3 rounded-xl border border-[var(--amber-300)] bg-[var(--amber-50)] p-3 text-sm text-[var(--amber-800)]">
                <p className="font-medium">Tienes cambios sin guardar.</p>
                <p className="mt-1">Si cierras ahora, perderas la edicion en curso.</p>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowDiscardChanges(false)}>
                    Seguir editando
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={handleConfirmDiscard}>
                    Descartar cambios
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={requestClose} disabled={saving}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}
