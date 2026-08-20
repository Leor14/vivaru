"use client";

import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { applyPaymentCallable } from "@/lib/firebase/callables";
import { createTenantDocument, subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { BillingStatement, FiscalProfile, PaymentVoucher } from "@/types/domain";

import { getComprobanteProvider } from "./comprobante/provider";
import { formatSequential, nextSequential } from "./financial-counters";

/** Calcula el saldo y estado de una cuota tras aplicar un pago acumulado. */
export function computeBalanceStatus(
  totalCharged: number,
  paidAmount: number,
  dueDate?: string,
): { balance: number; status: BillingStatement["status"] } {
  const rawBalance = totalCharged - paidAmount;
  const balance = rawBalance > 0 ? rawBalance : 0;
  const today = new Date().toISOString().slice(0, 10);
  const status: BillingStatement["status"] =
    rawBalance <= 0 ? "paid" : dueDate && dueDate < today ? "overdue" : "pending";
  return { balance, status };
}

/**
 * Suscripción a los comprobantes emitidos (admin: todos; residente: filtra por
 * unidad). El orden por secuencial se aplica del lado del cliente para no
 * exigir un índice compuesto en Firestore.
 */
export function watchPaymentVouchers(
  tenantId: string,
  onData: (items: PaymentVoucher[]) => void,
  onError: (message: string) => void,
  unitId?: string,
) {
  return (
    subscribeTenantCollection<PaymentVoucher>(
      "paymentVouchers",
      tenantId,
      (items) => onData([...items].sort((a, b) => (b.sequentialValue ?? 0) - (a.sequentialValue ?? 0))),
      onError,
      { equals: unitId ? [{ field: "payerUnitId", value: unitId }] : undefined },
    ) ?? (() => {})
  );
}

export type RecordPaymentInput = {
  statement: BillingStatement;
  amount: number;
  date: string;
  fiscalProfile?: FiscalProfile | null;
  payerName?: string | null;
  /** Cédula del condómino — obligatoria para el comprobante en Ecuador. */
  payerTaxId?: string | null;
  /**
   * Clave de idempotencia (`FIN-001`). **La genera la pantalla al abrir el
   * formulario y la conserva entre reintentos**: un doble clic o un reintento de
   * red con la misma clave aplica el pago una sola vez. Generar una nueva en
   * cada intento anula la protección.
   */
  operationKey: string;
};

/**
 * Registra un cobro sobre una cuota: actualiza la cartera, crea el asiento de
 * ingreso en el libro y emite el comprobante con secuencial. Devuelve el id del
 * comprobante para poder descargarlo enseguida.
 */
export async function recordPayment(
  tenantId: string,
  userId: string,
  input: RecordPaymentInput,
): Promise<{ voucherId: string; ledgerEntryId: string; voucher: PaymentVoucher }> {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  if (input.amount <= 0) {
    throw new Error("El monto del cobro debe ser mayor a cero.");
  }

  // En Ecuador el comprobante exige RUC del conjunto + cédula del condómino.
  if (input.fiscalProfile?.country === "EC") {
    if (!input.fiscalProfile.taxId?.trim()) {
      throw new Error(
        "Configura el RUC del conjunto en Configuración antes de emitir comprobantes en Ecuador.",
      );
    }
    if (!input.payerTaxId?.trim()) {
      throw new Error("La cédula del condómino es obligatoria para el comprobante en Ecuador.");
    }
  }

  const { statement } = input;
  const prevPaid = statement.paymentAmount ?? 0;
  const newPaid = prevPaid + input.amount;
  const totalCharged = statement.amount ?? 0;
  const { balance, status } = computeBalanceStatus(totalCharged, newPaid, statement.dueDate);

  const concept = `Pago de alícuota ${statement.period} — ${statement.unitLabel}`;

  // ── 1. Aplicar el pago: cuota + asiento, en UNA transacción de servidor ────
  //
  // `FIN-001`. Antes esto eran cuatro escrituras sueltas en este orden:
  // secuencial, asiento, comprobante y cuota. Un fallo entre la segunda y la
  // cuarta dejaba **el libro diciendo que entró dinero y la cartera diciendo
  // que se debe**, y el saldo lo calculaba este archivo, en el navegador.
  //
  // Ahora el servidor lee la cuota, calcula el saldo y escribe cuota y asiento
  // como una sola cosa. Ver `functions/src/payments.ts`.
  const aplicado = await applyPaymentCallable({
    tenantId,
    statementId: statement.id,
    amount: input.amount,
    date: input.date,
    operationKey: input.operationKey,
    source: "manual",
  });

  // ── 2. El comprobante, DESPUÉS de que el pago esté aplicado ────────────────
  //
  // El cambio de orden es deliberado y es lo único fiscal que toca esta ficha
  // —por decisión de no entrar en lo fiscal—. Antes el comprobante se emitía
  // antes de aplicar el pago, así que un fallo dejaba **un documento fiscal de
  // un pago inexistente**. Ahora un fallo deja un pago sin comprobante, que se
  // puede volver a emitir: se cambia un daño por una tarea pendiente.
  //
  // Lo que sigue abierto: si la emisión falla, el secuencial ya reservado deja
  // un hueco en la serie. Cerrarlo exige emitir dentro de la transacción, que es
  // meterse en lo fiscal — anotado en la ficha, no resuelto aquí.
  const seqValue = await nextSequential(tenantId, "ingreso");
  const seqNumber = formatSequential(seqValue, input.fiscalProfile?.voucherSeriesPrefix);

  const ledgerRef = { id: aplicado.ledgerEntryId };

  const provider = getComprobanteProvider(input.fiscalProfile?.country ?? null);
  const draft = provider.buildVoucher({
    type: "ingreso",
    sequentialValue: seqValue,
    sequentialNumber: seqNumber,
    issueDate: input.date,
    amount: input.amount,
    concept,
    payer: {
      name: input.payerName ?? null,
      taxId: input.payerTaxId ?? null,
      unitId: statement.unitId,
      unitLabel: statement.unitLabel,
    },
    issuer: {
      taxId: input.fiscalProfile?.taxId ?? null,
      legalName: input.fiscalProfile?.legalName ?? null,
      address: input.fiscalProfile?.address ?? null,
      country: input.fiscalProfile?.country ?? null,
    },
    sourceType: "billingStatement",
    sourceId: statement.id,
  });
  const voucherRef = await createTenantDocument("paymentVouchers", tenantId, userId, {
    ...draft,
    ledgerEntryId: ledgerRef.id,
    pdfUrl: null,
    pdfStoragePath: null,
  });

  // La cuota ya quedó actualizada dentro de la transacción del paso 1. Escribirla
  // aquí otra vez volvería a poner la aritmética en el navegador, que es
  // justamente lo que esta ficha quita.

  const voucher: PaymentVoucher = {
    id: voucherRef.id,
    tenantId,
    type: draft.type,
    sequentialNumber: draft.sequentialNumber,
    sequentialValue: draft.sequentialValue,
    issueDate: draft.issueDate,
    amount: draft.amount,
    concept: draft.concept,
    payerName: draft.payerName ?? undefined,
    payerTaxId: draft.payerTaxId ?? undefined,
    payerUnitId: draft.payerUnitId ?? undefined,
    payerUnitLabel: draft.payerUnitLabel ?? undefined,
    issuerTaxId: draft.issuerTaxId ?? undefined,
    issuerLegalName: draft.issuerLegalName ?? undefined,
    issuerAddress: draft.issuerAddress ?? undefined,
    issuerCountry: draft.issuerCountry ?? undefined,
    sourceType: draft.sourceType ?? undefined,
    sourceId: draft.sourceId ?? undefined,
    ledgerEntryId: ledgerRef.id,
    createdBy: userId,
  };

  return { voucherId: voucherRef.id, ledgerEntryId: ledgerRef.id, voucher };
}
