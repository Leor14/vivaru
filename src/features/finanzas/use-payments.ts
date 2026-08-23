"use client";

import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase/client";
import { applyPaymentCallable } from "@/lib/firebase/callables";
import { subscribeTenantCollection } from "@/lib/firebase/realtime-helpers";
import type { BillingStatement, PaymentVoucher } from "@/types/domain";

/**
 * Calcula el saldo y estado de una cuota tras aplicar un pago acumulado.
 *
 * **Espejo de `calcularSaldo` en `functions/src/payments.ts`**, duplicado a
 * propósito porque `src/` no puede importar de `functions/`. **Si cambias uno,
 * cambia el otro** — y el que manda es el del servidor, porque es el que
 * escribe. Hay un guardián de texto que falla si los dos se separan.
 *
 * **Aviso para quien venga a usarla: hoy NO la llama nadie en producción.**
 * Medido el 23 de agosto de 2026 — solo la referencian su propia prueba y este
 * fichero. El saldo que se pinta sale del documento, que lo escribió el
 * servidor. Se mantiene al día igualmente por dos razones: `FLOW-002` la nombra
 * como el espejo del cliente, y **una función muerta con la aritmética
 * equivocada es peor que ninguna** — quien la cablee heredaría el defecto sin
 * saberlo.
 *
 * `advanceApplied` es obligatorio a propósito (R4): olvidarlo no compila. Es lo
 * cubierto con anticipos cruzados, que **no se suma a `paymentAmount`** pero sí
 * cuenta para saber si la cuota está saldada.
 */
export function computeBalanceStatus(
  totalCharged: number,
  paidAmount: number,
  advanceApplied: number,
  dueDate?: string,
): { balance: number; status: BillingStatement["status"] } {
  const rawBalance = totalCharged - paidAmount - advanceApplied;
  const balance = rawBalance > 0 ? rawBalance : 0;
  const today = new Date().toISOString().slice(0, 10);
  const status: BillingStatement["status"] =
    rawBalance <= 0 ? "paid" : dueDate && dueDate < today ? "overdue" : "pending";
  return { balance, status };
}

/**
 * Suscripción a los recibos emitidos (admin: todos; residente: filtra por
 * unidad). El orden se aplica del lado del cliente para no exigir un índice
 * compuesto en Firestore.
 *
 * **Ordena por fecha de emisión, no por secuencial** (20 ago 2026): al dejar de
 * ser un documento fiscal, el recibo dejó de llevar número correlativo. La fecha
 * es además lo que espera quien mira la lista — un residente busca «el recibo de
 * agosto», no el número 47.
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
      (items) =>
        onData(
          [...items].sort(
            (a, b) =>
              (b.issueDate ?? "").localeCompare(a.issueDate ?? "") ||
              (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
          ),
        ),
      onError,
      { equals: unitId ? [{ field: "payerUnitId", value: unitId }] : undefined },
    ) ?? (() => {})
  );
}

/**
 * Lee un recibo concreto. Lo usa la descarga del PDF.
 *
 * **Se lee en vez de arrastrarlo desde quien lo creó**: el servidor devuelve el
 * id y el código al registrar el cobro, y el papel se genera con lo que está
 * guardado. Así un recibo anulado sale marcado como tal aunque se descargue
 * desde una pantalla que se abrió antes de la anulación.
 */
export async function fetchPaymentVoucher(voucherId: string): Promise<PaymentVoucher | null> {
  if (!db) throw new Error("Firebase no esta configurado en este entorno.");
  const snap = await getDoc(doc(db, "paymentVouchers", voucherId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<PaymentVoucher, "id">) };
}

export type RecordPaymentInput = {
  statement: BillingStatement;
  amount: number;
  date: string;
  payerName?: string | null;
  /**
   * Documento de quien paga. **Opcional en los tres países** desde el 20 de
   * agosto de 2026: era obligatorio solo en Ecuador porque lo exigía el
   * documento del SRI, que salió del alcance.
   */
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
 * Registra un cobro sobre una cuota. **Una sola llamada**: el servidor actualiza
 * la cartera, escribe el asiento del libro y emite el recibo, todo dentro de la
 * misma transacción. Devuelve el recibo para poder descargarlo enseguida.
 *
 * **Qué hacía este archivo hasta el 20 de agosto de 2026 y ya no hace.** Después
 * de que el servidor aplicara el pago, reservaba aquí un secuencial, construía
 * el recibo y lo escribía por su cuenta. Si esa escritura fallaba —red, permiso,
 * pestaña cerrada—, **el pago quedaba aplicado y sin recibo**. El motivo escrito
 * para no meterlo en la transacción era que emitir ahí dentro «es meterse en lo
 * fiscal»; al salir lo fiscal del alcance dejó de serlo, y el hueco se cerró.
 *
 * Lo que se fue con ello: el contador de secuenciales —que serializaba todos los
 * pagos de un conjunto sobre un único documento— y los candados de Ecuador, que
 * exigían RUC del conjunto y cédula del condómino porque los pedía el SRI.
 */
export async function recordPayment(
  tenantId: string,
  userId: string,
  input: RecordPaymentInput,
): Promise<{
  voucherId: string;
  ledgerEntryId: string;
  voucherCode: string;
  /** R8 — el concepto no tenía cuenta y el asiento cayó en «Otros ingresos». */
  cayoEnOtrosIngresos: boolean;
}> {
  if (input.amount <= 0) {
    throw new Error("El monto del cobro debe ser mayor a cero.");
  }

  const aplicado = await applyPaymentCallable({
    tenantId,
    statementId: input.statement.id,
    amount: input.amount,
    date: input.date,
    operationKey: input.operationKey,
    source: "manual",
    payerName: input.payerName ?? null,
    payerTaxId: input.payerTaxId ?? null,
  });

  // El recibo llega del servidor. Si no viniera, el pago SÍ se aplicó —eso ya
  // está confirmado— y lo que falta es solo cómo llamarlo en pantalla; se avisa
  // en vez de fingir un id.
  if (!aplicado.voucherId || !aplicado.voucherCode) {
    throw new Error("El cobro se registró, pero el servidor no devolvió el recibo.");
  }

  return {
    voucherId: aplicado.voucherId,
    ledgerEntryId: aplicado.ledgerEntryId,
    voucherCode: aplicado.voucherCode,
    cayoEnOtrosIngresos: aplicado.cayoEnOtrosIngresos === true,
  };
}
