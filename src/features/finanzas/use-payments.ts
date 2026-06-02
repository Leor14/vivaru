"use client";

import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
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

/** Suscripción a los comprobantes emitidos (admin: todos; residente: filtra por unidad). */
export function watchPaymentVouchers(
  tenantId: string,
  onData: (items: PaymentVoucher[]) => void,
  onError: (message: string) => void,
  unitId?: string,
) {
  return (
    subscribeTenantCollection<PaymentVoucher>("paymentVouchers", tenantId, onData, onError, {
      orderByField: "sequentialValue",
      orderDirection: "desc",
      equals: unitId ? [{ field: "payerUnitId", value: unitId }] : undefined,
    }) ?? (() => {})
  );
}

export type RecordPaymentInput = {
  statement: BillingStatement;
  amount: number;
  date: string;
  fiscalProfile?: FiscalProfile | null;
  payerName?: string | null;
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
): Promise<{ voucherId: string; ledgerEntryId: string }> {
  if (!db) {
    throw new Error("Firebase no esta configurado en este entorno.");
  }
  if (input.amount <= 0) {
    throw new Error("El monto del cobro debe ser mayor a cero.");
  }

  const { statement } = input;
  const prevPaid = statement.paymentAmount ?? 0;
  const newPaid = prevPaid + input.amount;
  const totalCharged = statement.amount ?? 0;
  const { balance, status } = computeBalanceStatus(totalCharged, newPaid, statement.dueDate);

  const concept = `Pago de alícuota ${statement.period} — ${statement.unitLabel}`;

  // 1. Reservar secuencial atómico.
  const seqValue = await nextSequential(tenantId, "ingreso");
  const seqNumber = formatSequential(seqValue, input.fiscalProfile?.voucherSeriesPrefix);

  // 2. Asiento de ingreso en el libro.
  const ledgerRef = await createTenantDocument("ledgerEntries", tenantId, userId, {
    type: "ingreso",
    date: input.date,
    amount: input.amount,
    concept,
    category: "alicuota",
    bankAccountId: null,
    sourceType: "billingStatement",
    sourceId: statement.id,
    reconciled: false,
  });

  // 3. Comprobante (recibo genérico en F1; provider por país).
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

  // 4. Actualizar la cuota en cartera.
  await updateDoc(doc(db, "billingStatements", statement.id), {
    paymentAmount: newPaid,
    balance,
    status,
    lastPaymentAt: input.date,
    updatedBy: userId,
    updatedAt: serverTimestamp(),
  });

  return { voucherId: voucherRef.id, ledgerEntryId: ledgerRef.id };
}
