"use client";

import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, FileText, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { approveReceiptAndRegisterPayment, usePaymentReceipts, updateReceiptStatus } from "@/features/billing/use-payment-receipts";
import type { BillingStatement, PaymentReceipt } from "@/types/domain";

type Props = {
  tenantId?: string;
  reviewerId?: string;
  reviewerName?: string;
  statements?: BillingStatement[];
};

function formatMoney(value: number): string {
  return `$${Math.round(value).toLocaleString("es-CO")}`;
}

function formatUploadedAt(value: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("es-CO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PaymentReceiptsReviewPanel({ tenantId, reviewerId, reviewerName, statements }: Props) {
  const { items, loading, error } = usePaymentReceipts(tenantId);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const statementsById = useMemo(() => {
    const map = new Map<string, BillingStatement>();
    for (const s of statements ?? []) map.set(s.id, s);
    return map;
  }, [statements]);

  const pendingReceipts = useMemo(
    () => items.filter((receipt) => receipt.status === "pending"),
    [items],
  );

  function amountValue(receipt: PaymentReceipt): string {
    if (receipt.id in amounts) return amounts[receipt.id];
    const stmt = receipt.statementId ? statementsById.get(receipt.statementId) : undefined;
    return stmt ? String(stmt.balance ?? "") : "";
  }

  async function handleApproveAndRegister(receipt: PaymentReceipt) {
    if (!reviewerId || !receipt.statementId) return;
    const amount = parseFloat(amountValue(receipt).replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Ingresa el monto pagado para registrar.");
      return;
    }
    setPendingActionId(receipt.id);
    try {
      await approveReceiptAndRegisterPayment({
        receiptId: receipt.id,
        statementId: receipt.statementId,
        amount,
        reviewerId,
        reviewerName,
      });
      toast.success("Pago registrado y comprobante aprobado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo registrar el pago.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleApprove(receipt: PaymentReceipt) {
    if (!reviewerId) {
      toast.error("No se pudo identificar al revisor.");
      return;
    }
    setPendingActionId(receipt.id);
    try {
      await updateReceiptStatus(receipt.id, {
        status: "approved",
        reviewedBy: reviewerId,
        reviewedByName: reviewerName,
      });
      toast.success("Comprobante aprobado");
    } catch {
      toast.error("No se pudo aprobar el comprobante. Intenta de nuevo.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleConfirmReject(receipt: PaymentReceipt) {
    if (!reviewerId) {
      toast.error("No se pudo identificar al revisor.");
      return;
    }
    const reason = rejectionReason.trim();
    if (!reason) {
      toast.error("Indica el motivo del rechazo.");
      return;
    }
    setPendingActionId(receipt.id);
    try {
      await updateReceiptStatus(receipt.id, {
        status: "rejected",
        reviewedBy: reviewerId,
        reviewedByName: reviewerName,
        rejectedReason: reason,
      });
      toast.success("Comprobante rechazado");
      setRejectingId(null);
      setRejectionReason("");
    } catch {
      toast.error("No se pudo rechazar el comprobante. Intenta de nuevo.");
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <Card className="soft-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <CardTitle>Comprobantes por revisar</CardTitle>
          <CardDescription className="mt-1">
            Comprobantes de pago enviados por residentes que esperan tu aprobación.
          </CardDescription>
        </div>
        {pendingReceipts.length > 0 ? (
          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {pendingReceipts.length} {pendingReceipts.length === 1 ? "pendiente" : "pendientes"}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--danger-600)]/30 bg-red-50 px-3 py-2.5 text-sm text-[var(--danger-700)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>No pudimos cargar los comprobantes: {error}</span>
        </div>
      ) : null}

      <div className="mt-4">
        {loading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-[var(--slate-100)]" />
            ))}
          </div>
        ) : pendingReceipts.length === 0 ? (
          <EmptyState
            title="Sin comprobantes pendientes"
            description="Cuando un residente suba un comprobante de pago, aparecerá aquí para tu revisión."
          />
        ) : (
          <ul className="space-y-2">
            {pendingReceipts.map((receipt) => {
              const isBusy = pendingActionId === receipt.id;
              const isRejecting = rejectingId === receipt.id;
              const linkedStmt = receipt.statementId ? statementsById.get(receipt.statementId) : undefined;
              return (
                <li
                  key={receipt.id}
                  className="rounded-xl border border-[var(--slate-200)] bg-white px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[var(--slate-500)]" aria-hidden />
                        <p className="truncate text-sm font-semibold text-[var(--slate-900)]">
                          {receipt.fileName || "Comprobante sin nombre"}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-[var(--slate-600)]">
                        Unidad: <span className="font-medium text-[var(--slate-800)]">{receipt.unitId}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--slate-500)]">
                        Subido: {formatUploadedAt(receipt.uploadedAt)}
                      </p>
                      {linkedStmt ? (
                        <p className="mt-0.5 text-xs text-[var(--slate-600)]">
                          Cobro {linkedStmt.period} · Saldo{" "}
                          <span className="font-medium text-[var(--slate-800)]">{formatMoney(linkedStmt.balance ?? 0)}</span>
                        </p>
                      ) : (
                        <p className="mt-0.5 text-xs text-amber-700">Sin cobro vinculado — apruébalo y registra el pago manualmente.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={receipt.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-xl border border-[var(--slate-300)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--slate-700)] hover:bg-[var(--slate-100)]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                        Abrir archivo
                      </a>
                      {linkedStmt ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="decimal"
                            value={amountValue(receipt)}
                            onChange={(e) => setAmounts((prev) => ({ ...prev, [receipt.id]: e.target.value }))}
                            className="h-9 w-28 rounded-xl border border-[var(--slate-300)] bg-white px-2 text-sm text-[var(--slate-900)]"
                            placeholder="Monto"
                            aria-label="Monto pagado"
                          />
                          <Button
                            type="button"
                            onClick={() => handleApproveAndRegister(receipt)}
                            disabled={isBusy || isRejecting}
                            className="inline-flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            Aprobar y registrar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => handleApprove(receipt)}
                          disabled={isBusy || isRejecting}
                          className="inline-flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                          Aprobar
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setRejectingId(isRejecting ? null : receipt.id);
                          setRejectionReason("");
                        }}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 text-[var(--danger-700)] hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden />
                        Rechazar
                      </Button>
                    </div>
                  </div>

                  {isRejecting ? (
                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--slate-100)] pt-3">
                      <label className="flex-1 text-xs text-[var(--slate-700)]">
                        Motivo del rechazo
                        <input
                          type="text"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Ej. El comprobante no corresponde al monto cobrado."
                          className="mt-1 h-10 w-full rounded-xl border border-[var(--slate-300)] bg-white px-3 text-sm text-[var(--slate-900)]"
                          autoFocus
                        />
                      </label>
                      <Button
                        type="button"
                        onClick={() => handleConfirmReject(receipt)}
                        disabled={isBusy || rejectionReason.trim().length === 0}
                        className="bg-[var(--danger-600)] text-white hover:bg-[var(--danger-700)]"
                      >
                        Confirmar rechazo
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setRejectingId(null);
                          setRejectionReason("");
                        }}
                        disabled={isBusy}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
