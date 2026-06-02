"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { watchTenantSettings } from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";
import { renderReciboPdf } from "@/features/finanzas/comprobante/recibo-pdf";
import { recordPayment } from "@/features/finanzas/use-payments";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BillingStatement, FiscalProfile, PaymentVoucher } from "@/types/domain";

const today = () => new Date().toISOString().slice(0, 10);

type RecordPaymentModalProps = {
  open: boolean;
  statement: BillingStatement | null;
  onClose: () => void;
};

export function RecordPaymentModal({ open, statement, onClose }: RecordPaymentModalProps) {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();

  const [fiscalProfile, setFiscalProfile] = useState<FiscalProfile | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [payerName, setPayerName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdVoucher, setCreatedVoucher] = useState<PaymentVoucher | null>(null);

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsub = watchTenantSettings(
      user.tenantId,
      (item) => setFiscalProfile(item?.fiscalProfile ?? null),
      () => setFiscalProfile(null),
    );
    return () => unsub();
  }, [user?.tenantId]);

  useEffect(() => {
    if (open && statement) {
      setAmount(String(statement.balance > 0 ? statement.balance : ""));
      setDate(today());
      setPayerName("");
      setCreatedVoucher(null);
    }
  }, [open, statement]);

  async function handleSubmit() {
    if (!user?.tenantId || !statement) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Ingresa un monto válido mayor a cero.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await recordPayment(user.tenantId, user.uid, {
        statement,
        amount: parsed,
        date,
        fiscalProfile,
        payerName: payerName.trim() || null,
      });
      setCreatedVoucher(result.voucher);
      toast.success(`Cobro registrado. Comprobante ${result.voucher.sequentialNumber}.`);
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!createdVoucher) return;
    try {
      await renderReciboPdf(createdVoucher, formatAmount);
    } catch (error) {
      toastFirebaseError(error);
    }
  }

  return (
    <Modal open={open} title="Registrar cobro" onClose={onClose}>
      {statement ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm">
            <p className="text-[var(--slate-700)]">
              Unidad <strong>{statement.unitLabel}</strong> · Período {statement.period}
            </p>
            <p className="mt-1 text-[var(--slate-500)]">Saldo actual: {formatAmount(statement.balance)}</p>
          </div>

          {createdVoucher ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-[var(--slate-200)] bg-white p-3 text-sm">
                <p className="text-[var(--slate-700)]">
                  Comprobante <strong>{createdVoucher.sequentialNumber}</strong> emitido por{" "}
                  {formatAmount(createdVoucher.amount)}.
                </p>
              </div>
              <div className="mobile-action-group">
                <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClose}>
                  Cerrar
                </Button>
                <Button className="w-full sm:w-auto" type="button" onClick={() => void handleDownload()}>
                  Descargar recibo
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">Monto del cobro</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">Fecha del cobro</label>
                <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">
                  Nombre del pagador (opcional)
                </label>
                <Input
                  value={payerName}
                  onChange={(event) => setPayerName(event.target.value)}
                  placeholder="Nombre del residente"
                />
              </div>
              <div className="mobile-action-group">
                <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSubmit()}
                >
                  {submitting ? "Registrando..." : "Registrar y emitir recibo"}
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
