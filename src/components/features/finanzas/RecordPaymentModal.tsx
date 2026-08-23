"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { watchPeople, type PersonItem } from "@/features/admin/services";
import { useAuth } from "@/features/auth/auth-context";
import { renderReciboPdf } from "@/features/finanzas/comprobante/recibo-pdf";
import { fetchPaymentVoucher, recordPayment } from "@/features/finanzas/use-payments";
import { useTenantCurrency } from "@/features/tenant/use-tenant-currency";
import { toastFirebaseError } from "@/lib/utils/error-handler";
import type { BillingStatement } from "@/types/domain";

const today = () => new Date().toISOString().slice(0, 10);

type RecordPaymentModalProps = {
  open: boolean;
  statement: BillingStatement | null;
  onClose: () => void;
};

export function RecordPaymentModal({ open, statement, onClose }: RecordPaymentModalProps) {
  const { user } = useAuth();
  const { formatAmount } = useTenantCurrency();

  const [people, setPeople] = useState<PersonItem[]>([]);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today());
  const [payerName, setPayerName] = useState("");
  const [payerTaxId, setPayerTaxId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /**
   * Clave de idempotencia del cobro (`FIN-001`).
   *
   * Se genera **una vez por apertura del formulario**, no en cada envío: esa es
   * toda la gracia. Con la misma clave, un doble clic o un reintento tras un
   * timeout aplican el pago una sola vez; con una clave nueva por intento, la
   * protección no existiría. Se renueva al abrir para un cobro distinto.
   */
  const operationKey = useRef<string>("");
  const [createdVoucher, setCreatedVoucher] = useState<{ id: string; code: string } | null>(null);


  // Ya no se escucha el perfil fiscal del conjunto: desde el 20 de agosto de
  // 2026 lo lee el servidor al emitir el recibo, que es donde debe leerse. Esta
  // pantalla solo necesita a las personas, para prellenar quién paga.
  useEffect(() => {
    if (!user?.tenantId) return;
    return watchPeople(user.tenantId, setPeople, () => setPeople([]));
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
    }
  }, [open, statement, people]);


  useEffect(() => {
    if (open) operationKey.current = crypto.randomUUID();
  }, [open, statement?.id]);

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
        payerName: payerName.trim() || null,
        payerTaxId: payerTaxId.trim() || null,
        operationKey: operationKey.current,
      });
      setCreatedVoucher({ id: result.voucherId, code: result.voucherCode });
      toast.success(`Cobro registrado. Recibo ${result.voucherCode}.`);
      // R8. Va DESPUÉS del éxito y como aviso, no como error: el cobro se
      // aplicó y el dinero no se perdió —cayó en «Otros ingresos»—. Decirlo
      // como fallo haría dudar de un pago que está bien.
      if (result.cayoEnOtrosIngresos) {
        toast.warning(
          "El concepto de este cargo no tiene cuenta en el plan, así que el ingreso quedó en «Otros ingresos». Créale su cuenta si vas a cobrarlo seguido.",
        );
      }
    } catch (error) {
      toastFirebaseError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!createdVoucher) return;
    try {
      // Se lee el recibo guardado en vez de armar el PDF con lo que tiene esta
      // pantalla: el papel debe salir de lo que está escrito.
      const voucher = await fetchPaymentVoucher(createdVoucher.id);
      if (!voucher) {
        toast.error("No encontramos el recibo. Vuelve a abrir la lista de recibos.");
        return;
      }
      await renderReciboPdf(voucher, formatAmount);
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
                  Recibo <strong>{createdVoucher.code}</strong> emitido por{" "}
                  {formatAmount(Number(amount) || 0)}.
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
              <div>
                <label className="mb-1 block text-sm text-[var(--slate-700)]">
                  Cédula del condómino (opcional)
                </label>
                <Input
                  value={payerTaxId}
                  onChange={(event) => setPayerTaxId(event.target.value)}
                  placeholder="Documento de identidad"
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
