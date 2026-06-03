"use client";

import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { watchPeople, watchTenantSettings, type PersonItem } from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";
import { retransmitVoucherCallable } from "@/lib/firebase/callables";
import { db } from "@/lib/firebase/client";
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
  const [people, setPeople] = useState<PersonItem[]>([]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [payerName, setPayerName] = useState("");
  const [payerTaxId, setPayerTaxId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdVoucher, setCreatedVoucher] = useState<PaymentVoucher | null>(null);
  const [liveFiscalStatus, setLiveFiscalStatus] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const isEcuador = fiscalProfile?.country === "EC";
  const missingRuc = isEcuador && !fiscalProfile?.taxId?.trim();

  useEffect(() => {
    if (!user?.tenantId) return;
    const unsubSettings = watchTenantSettings(
      user.tenantId,
      (item) => setFiscalProfile(item?.fiscalProfile ?? null),
      () => setFiscalProfile(null),
    );
    const unsubPeople = watchPeople(user.tenantId, setPeople, () => setPeople([]));
    return () => {
      unsubSettings();
      unsubPeople();
    };
  }, [user?.tenantId]);

  useEffect(() => {
    if (open && statement) {
      setAmount(String(statement.balance > 0 ? statement.balance : ""));
      setDate(today());
      // Prellenar nombre y cédula desde el residente de la unidad (prioriza propietario).
      const unitPeople = people.filter((p) => p.unitId === statement.unitId);
      const holder = unitPeople.find((p) => p.roleType === "owner_occupant") ?? unitPeople[0];
      setPayerName(holder?.fullName ?? "");
      setPayerTaxId(holder?.documentNumber ?? "");
      setCreatedVoucher(null);
      setLiveFiscalStatus(null);
    }
  }, [open, statement, people]);

  // Estado de transmisión al SRI en vivo (solo Ecuador), tras emitir el comprobante.
  useEffect(() => {
    if (!createdVoucher || !isEcuador || !db) return;
    const unsub = onSnapshot(doc(db, "paymentVouchers", createdVoucher.id), (snap) => {
      setLiveFiscalStatus((snap.data()?.fiscalStatus as string | undefined) ?? null);
    });
    return () => unsub();
  }, [createdVoucher, isEcuador]);

  async function handleSubmit() {
    if (!user?.tenantId || !statement) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Ingresa un monto válido mayor a cero.");
      return;
    }
    if (isEcuador && !payerTaxId.trim()) {
      toast.error("La cédula del condómino es obligatoria en Ecuador.");
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
        payerTaxId: payerTaxId.trim() || null,
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

  async function handleRetry() {
    if (!createdVoucher) return;
    setRetrying(true);
    try {
      await retransmitVoucherCallable({ voucherId: createdVoucher.id });
      toast.success("Reintentando transmisión al SRI.");
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setRetrying(false);
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
              {isEcuador ? (
                <div className="rounded-xl border border-[var(--slate-200)] bg-[var(--surface-soft)] p-3 text-sm">
                  <p className="text-[var(--slate-700)]">
                    Transmisión al SRI:{" "}
                    <strong>
                      {liveFiscalStatus === "transmitted"
                        ? "Transmitido"
                        : liveFiscalStatus === "error"
                          ? "Error"
                          : "Pendiente..."}
                    </strong>
                  </p>
                  {liveFiscalStatus === "error" ? (
                    <Button
                      className="mt-2"
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={retrying}
                      onClick={() => void handleRetry()}
                    >
                      {retrying ? "Reintentando..." : "Reintentar transmisión"}
                    </Button>
                  ) : null}
                </div>
              ) : null}
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
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">
                  Cédula del condómino{isEcuador ? "" : " (opcional)"}
                </label>
                <Input
                  value={payerTaxId}
                  onChange={(event) => setPayerTaxId(event.target.value)}
                  placeholder="Documento de identidad"
                />
                {isEcuador ? (
                  <p className="mt-1 text-xs text-[var(--slate-500)]">
                    Obligatoria en Ecuador: el comprobante se emite con el RUC del conjunto y la cédula del condómino.
                  </p>
                ) : null}
              </div>
              {missingRuc ? (
                <p className="rounded-xl border border-[var(--danger-300)] bg-[var(--danger-50)] px-3 py-2 text-xs text-[var(--danger-700)]">
                  Configura el RUC del conjunto en Configuración → Datos fiscales antes de emitir comprobantes en Ecuador.
                </p>
              ) : null}
              <div className="mobile-action-group">
                <Button className="w-full sm:w-auto" type="button" variant="outline" onClick={onClose}>
                  Cancelar
                </Button>
                <Button
                  className="w-full sm:w-auto"
                  type="button"
                  disabled={submitting || missingRuc}
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
