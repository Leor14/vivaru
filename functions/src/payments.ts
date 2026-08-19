import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * `FIN-001` — aplicación de pagos: un solo comando, transaccional e idempotente.
 *
 * **Qué había antes, y por qué era grave.** Dos rutas aplicaban un pago y
 * producían efectos distintos:
 *
 * - `recordPayment` (cobro manual) hacía **cuatro escrituras sueltas sin
 *   transacción**: reservar secuencial, asiento del libro, comprobante y cuota.
 *   Un fallo entre la segunda y la cuarta dejaba **el libro diciendo que entró
 *   dinero y la cartera diciendo que se debe**.
 * - `approveReceiptAndRegisterPayment` (aprobación del comprobante del
 *   residente) actualizaba la cuota **y no escribía en el libro**: el dinero se
 *   movía en cartera y nunca llegaba a la contabilidad.
 *
 * Y las dos calculaban el saldo **en el navegador**, con reglas de Firestore que
 * aceptaban cualquier cifra que el cliente enviara. Nada comprobaba que
 * `balance = amount − paymentAmount`.
 *
 * **Tres decisiones que sostienen este módulo:**
 *
 * 1. **La aritmética es del servidor.** El cliente dice cuánto se pagó; el saldo
 *    y el estado los calcula esto, leyendo la cuota dentro de la transacción. Un
 *    cliente con un dato viejo ya no puede escribir un saldo incorrecto.
 * 2. **Todo o nada.** Cuota, asiento y comprobante-de-residente se escriben en
 *    una transacción. No existe el estado intermedio.
 * 3. **Idempotente por clave.** El llamante manda una `operationKey`; si llega
 *    dos veces —doble clic, reintento de red, reenvío— el pago se aplica **una
 *    sola vez** y la segunda llamada devuelve el mismo resultado.
 *
 * **Lo fiscal queda fuera a propósito** (decisión de David, 18 ago 2026: «no nos
 * metemos al tema fiscal de momento para ninguno de los países»). El comprobante
 * con secuencial lo sigue emitiendo el cobro manual desde el cliente, con dos
 * matices: **ya no se emite antes de aplicar el pago sino después**, así que un
 * fallo deja un pago sin comprobante —recuperable— en vez de un comprobante
 * fiscal de un pago inexistente; y la aprobación del residente **no emite
 * comprobante**, igual que hoy.
 */

// `initializeApp()` corre en index.ts y los imports se evalúan antes.
const db = () => getFirestore();

/** Estados de una cuota, espejo de `BillingStatement["status"]` en `src/`. */
type EstadoCuota = "paid" | "overdue" | "pending";

type CuotaDoc = {
  tenantId?: string;
  amount?: number;
  paymentAmount?: number;
  dueDate?: string;
  unitId?: string;
  unitLabel?: string;
  period?: string;
};

export type AplicarPagoInput = {
  tenantId: string;
  statementId: string;
  amount: number;
  /** ISO `YYYY-MM-DD`. La fecha contable del movimiento. */
  date: string;
  /** Clave de idempotencia. La genera el llamante y la repite en los reintentos. */
  operationKey: string;
  /** De dónde viene: cobro manual del administrador, o comprobante del residente. */
  source: "manual" | "receipt";
  /** Obligatorio cuando `source === "receipt"`. */
  receiptId?: string;
  reviewerName?: string;
};

export type AplicarPagoResultado = {
  ok: true;
  /** `true` si esta llamada aplicó el pago; `false` si ya estaba aplicado. */
  applied: boolean;
  ledgerEntryId: string;
  paymentAmount: number;
  balance: number;
  status: EstadoCuota;
};

/**
 * Saldo y estado a partir de lo cobrado y lo pagado.
 *
 * Espejo de `computeBalanceStatus` en `src/features/finanzas/use-payments.ts`,
 * duplicado a propósito: `src/` no puede importar de `functions/` sin romper el
 * build de App Hosting (ver CLAUDE.md). **Si cambias uno, cambia el otro** — y
 * el que manda es este, porque es el que escribe.
 */
export function calcularSaldo(
  totalCobrado: number,
  pagado: number,
  vencimiento: string | undefined,
  hoy: string,
): { balance: number; status: EstadoCuota } {
  const bruto = totalCobrado - pagado;
  const balance = bruto > 0 ? bruto : 0;
  const status: EstadoCuota =
    bruto <= 0 ? "paid" : vencimiento && vencimiento < hoy ? "overdue" : "pending";
  return { balance, status };
}

function texto(valor: unknown, campo: string): string {
  const out = typeof valor === "string" ? valor.trim() : "";
  if (!out) throw new HttpsError("invalid-argument", `Falta ${campo}.`);
  return out;
}

/**
 * Quién puede aplicar un pago: administración del conjunto o superadmin.
 *
 * **No** se acepta al residente aunque el pago nazca de su comprobante: subirlo
 * es una solicitud, aprobarlo es una decisión de la administración.
 */
function assertPuedeCobrar(role: unknown, tokenTenant: unknown, tenantId: string) {
  const rol = typeof role === "string" ? role : "";
  if (rol === "superadmin" || rol === "super_admin") return;
  const esAdmin = rol === "tenant_admin" || rol === "admin_tenant";
  if (!esAdmin || tokenTenant !== tenantId) {
    throw new HttpsError("permission-denied", "No tienes permiso para registrar cobros en este conjunto.");
  }
}

/**
 * Aplica un pago sobre una cuota. Transaccional e idempotente.
 *
 * El orden de lectura importa: Firestore exige **todas las lecturas antes de
 * cualquier escritura** dentro de una transacción, así que primero se leen la
 * marca de idempotencia, la cuota y —si aplica— el comprobante del residente.
 */
export async function aplicarPago(
  input: AplicarPagoInput,
  uid: string,
  role: unknown,
  tokenTenant: unknown,
): Promise<AplicarPagoResultado> {
  const tenantId = texto(input.tenantId, "el conjunto");
  const statementId = texto(input.statementId, "la cuota");
  const operationKey = texto(input.operationKey, "la clave de operación");
  const fecha = texto(input.date, "la fecha");

  assertPuedeCobrar(role, tokenTenant, tenantId);

  const monto = typeof input.amount === "number" ? input.amount : NaN;
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new HttpsError("invalid-argument", "El monto del cobro debe ser mayor a cero.");
  }
  if (input.source !== "manual" && input.source !== "receipt") {
    throw new HttpsError("invalid-argument", "Origen de pago inválido.");
  }
  if (input.source === "receipt" && !input.receiptId) {
    throw new HttpsError("invalid-argument", "Falta el comprobante que origina el pago.");
  }

  const firestore = db();
  const opRef = firestore.collection("paymentOperations").doc(operationKey);
  const cuotaRef = firestore.collection("billingStatements").doc(statementId);
  const reciboRef = input.receiptId
    ? firestore.collection("paymentReceipts").doc(input.receiptId)
    : null;

  const hoy = new Date().toISOString().slice(0, 10);

  return firestore.runTransaction(async (tx) => {
    // ── Lecturas, todas antes de escribir ────────────────────────────────────
    const opSnap = await tx.get(opRef);
    if (opSnap.exists) {
      // Ya se aplicó con esta clave. Se devuelve el mismo resultado sin volver a
      // tocar nada: es lo que convierte un reintento en algo inofensivo.
      const prev = opSnap.data() as Partial<AplicarPagoResultado> & { ledgerEntryId?: string };
      return {
        ok: true as const,
        applied: false,
        ledgerEntryId: prev.ledgerEntryId ?? "",
        paymentAmount: prev.paymentAmount ?? 0,
        balance: prev.balance ?? 0,
        status: (prev.status as EstadoCuota) ?? "pending",
      };
    }

    const cuotaSnap = await tx.get(cuotaRef);
    if (!cuotaSnap.exists) {
      throw new HttpsError("not-found", "El cobro vinculado ya no existe.");
    }
    const cuota = cuotaSnap.data() as CuotaDoc;

    // El conjunto de la cuota manda sobre el que diga el llamante: si no
    // coinciden, alguien está intentando cobrar en un conjunto ajeno.
    if (cuota.tenantId && cuota.tenantId !== tenantId) {
      throw new HttpsError("permission-denied", "Esa cuota pertenece a otro conjunto.");
    }

    let reciboYaAprobado = false;
    if (reciboRef) {
      const reciboSnap = await tx.get(reciboRef);
      if (!reciboSnap.exists) {
        throw new HttpsError("not-found", "El comprobante ya no existe.");
      }
      const recibo = reciboSnap.data() as { status?: string; tenantId?: string };
      if (recibo.tenantId && recibo.tenantId !== tenantId) {
        throw new HttpsError("permission-denied", "Ese comprobante pertenece a otro conjunto.");
      }
      // Un comprobante ya aprobado no se vuelve a cobrar. Es la segunda red
      // contra el doble pago, además de la clave de idempotencia: protege
      // también del caso en que alguien apruebe dos veces con claves distintas.
      reciboYaAprobado = recibo.status === "approved";
      if (reciboYaAprobado) {
        throw new HttpsError("failed-precondition", "Ese comprobante ya fue aprobado.");
      }
    }

    // ── Aritmética, en el servidor ───────────────────────────────────────────
    const cobrado = typeof cuota.amount === "number" ? cuota.amount : 0;
    const pagadoAntes = typeof cuota.paymentAmount === "number" ? cuota.paymentAmount : 0;
    const pagadoDespues = pagadoAntes + monto;
    const { balance, status } = calcularSaldo(cobrado, pagadoDespues, cuota.dueDate, hoy);

    // ── Escrituras ───────────────────────────────────────────────────────────
    const ledgerRef = firestore.collection("ledgerEntries").doc();
    const concepto = `Pago de alícuota ${cuota.period ?? ""} — ${cuota.unitLabel ?? ""}`.trim();

    tx.set(ledgerRef, {
      tenantId,
      type: "ingreso",
      date: fecha,
      amount: monto,
      concept: concepto,
      category: "alicuota",
      bankAccountId: null,
      sourceType: "billingStatement",
      sourceId: statementId,
      reconciled: false,
      // Deja ver de qué ruta vino sin tener que cruzar colecciones.
      paymentSource: input.source,
      ...(input.receiptId ? { receiptId: input.receiptId } : {}),
      createdBy: uid,
      updatedBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(cuotaRef, {
      paymentAmount: pagadoDespues,
      balance,
      status,
      lastPaymentAt: fecha,
      ...(input.receiptId ? { lastReceiptId: input.receiptId } : {}),
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (reciboRef) {
      tx.update(reciboRef, {
        status: "approved",
        registeredAmount: monto,
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: uid,
        ...(input.reviewerName ? { reviewedByName: input.reviewerName } : {}),
        rejectedReason: null,
      });
    }

    // La marca de idempotencia se escribe DENTRO de la transacción: si algo
    // falla, tampoco queda ella, y el reintento vuelve a aplicar de verdad.
    tx.set(opRef, {
      tenantId,
      statementId,
      amount: monto,
      source: input.source,
      ...(input.receiptId ? { receiptId: input.receiptId } : {}),
      ledgerEntryId: ledgerRef.id,
      paymentAmount: pagadoDespues,
      balance,
      status,
      actorUid: uid,
      createdAt: Timestamp.now(),
    });

    return {
      ok: true as const,
      applied: true,
      ledgerEntryId: ledgerRef.id,
      paymentAmount: pagadoDespues,
      balance,
      status,
    };
  });
}
