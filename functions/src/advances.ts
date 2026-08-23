import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import { assertFeatureEnabled } from "./feature-flags";
import { calcularSaldo } from "./payments";

/**
 * `PRD-V-FLOW-002` — cruzar un anticipo contra un cargo, y deshacer el cruce.
 *
 * **La regla contable de este fichero cabe en una frase: cruzar no mueve
 * dinero.** El ingreso se registró cuando el anticipo entró (R5), dentro de la
 * transacción del pago que lo generó. Cruzarlo solo cambia **a qué obligación
 * queda imputado**, así que aquí NO se escribe ni un asiento de libro (R4).
 *
 * **Y la mitad que la PRD no vio hasta la v1.2:** tampoco se toca
 * `paymentAmount`. `cuotaIncome` es exactamente la suma de esos `paymentAmount`
 * (`repartirRecaudo`, sin filtro de fecha), así que subirlo al cruzar contaría
 * el anticipo **dos veces sin crear ningún asiento** — el doble conteo no
 * pasaría por el libro, que es donde CA6 miraba, y el criterio habría pasado en
 * verde con el estado financiero mal. Lo cruzado vive en
 * `advanceAppliedAmount`, que solo escribe el servidor.
 *
 * Vive aparte de `payments.ts` porque aquello ya pasa de mil líneas, y porque
 * son dos operaciones distintas: una recibe dinero, esta lo imputa.
 */

const db = () => getFirestore();

export type CruzarAnticipoInput = {
  tenantId: string;
  advanceId: string;
  statementId: string;
  /** Cuánto del anticipo se aplica. Se limita al saldo del cargo (§5.3). */
  amount: number;
  /** ISO `YYYY-MM-DD`. */
  date: string;
  operationKey: string;
};

export type CruzarAnticipoResultado = {
  ok: true;
  /** `true` si esta llamada cruzó; `false` si ya estaba cruzado con esa clave. */
  applied: boolean;
  applicationId: string;
  /** Lo que de verdad se aplicó, que puede ser menos de lo pedido (§5.3). */
  appliedAmount: number;
  /** Lo que le queda al anticipo. */
  remaining: number;
  advanceStatus: "open" | "applied" | "cancelled";
  balance: number;
  status: "paid" | "overdue" | "pending";
};

export type DeshacerCruceInput = {
  tenantId: string;
  applicationId: string;
  /** Idempotencia de ESTA operación. Distinta de la del cruce. */
  operationKey: string;
  reason?: string;
};

export type DeshacerCruceResultado = {
  ok: true;
  reversed: boolean;
  remaining: number;
  advanceStatus: "open" | "applied" | "cancelled";
  balance: number;
  status: "paid" | "overdue" | "pending";
};

type AdvanceDoc = {
  tenantId?: string;
  unitId?: string;
  amount?: number;
  remaining?: number;
  status?: string;
};

type CuotaDoc = {
  tenantId?: string;
  unitId?: string;
  amount?: number;
  paymentAmount?: number;
  advanceAppliedAmount?: number;
  dueDate?: string;
};

function texto(valor: unknown, campo: string): string {
  const out = typeof valor === "string" ? valor.trim() : "";
  if (!out) throw new HttpsError("invalid-argument", `Falta ${campo}.`);
  return out;
}

/**
 * Quién cruza un anticipo: la administración, o el superadmin.
 *
 * **El residente no, y no es desconfianza.** Cruzar mueve dinero entre
 * obligaciones; que lo haga quien responde de la contabilidad del conjunto, no
 * quien la paga (§3, CF6). Es la misma frontera que `assertPuedeCobrar`.
 */
function assertPuedeOperarAnticipos(role: unknown, tokenTenant: unknown, tenantId: string) {
  const rol = typeof role === "string" ? role : "";
  if (rol === "superadmin" || rol === "super_admin") return;
  const esAdmin = rol === "tenant_admin" || rol === "admin_tenant";
  if (!esAdmin || tokenTenant !== tenantId) {
    throw new HttpsError("permission-denied", "No tienes permiso para operar anticipos en este conjunto.");
  }
}

/** Cruza un anticipo contra un cargo. Transaccional e idempotente. */
export async function cruzarAnticipo(
  input: CruzarAnticipoInput,
  uid: string,
  role: unknown,
  tokenTenant: unknown,
): Promise<CruzarAnticipoResultado> {
  const tenantId = texto(input.tenantId, "el conjunto");
  const advanceId = texto(input.advanceId, "el anticipo");
  const statementId = texto(input.statementId, "el cargo");
  const operationKey = texto(input.operationKey, "la clave de operación");
  const fecha = texto(input.date, "la fecha");

  assertPuedeOperarAnticipos(role, tokenTenant, tenantId);
  await assertFeatureEnabled("producto-anticipos", tenantId);

  const pedido = typeof input.amount === "number" ? input.amount : NaN;
  if (!Number.isFinite(pedido) || pedido <= 0) {
    throw new HttpsError("invalid-argument", "El importe a cruzar debe ser mayor a cero.");
  }

  const firestore = db();
  const opRef = firestore.collection("paymentOperations").doc(`${tenantId}_${operationKey}`);

  return firestore.runTransaction(async (tx) => {
    // ── Lecturas, todas antes de escribir ────────────────────────────────────
    const opSnap = await tx.get(opRef);
    if (opSnap.exists) {
      const prev = opSnap.data() as Partial<CruzarAnticipoResultado>;
      return {
        ok: true as const,
        applied: false,
        applicationId: prev.applicationId ?? "",
        appliedAmount: prev.appliedAmount ?? 0,
        remaining: prev.remaining ?? 0,
        advanceStatus: prev.advanceStatus ?? "open",
        balance: prev.balance ?? 0,
        status: prev.status ?? "pending",
      };
    }

    const advanceRef = firestore.collection("advances").doc(advanceId);
    const advanceSnap = await tx.get(advanceRef);
    if (!advanceSnap.exists) throw new HttpsError("not-found", "Ese anticipo ya no existe.");
    const advance = advanceSnap.data() as AdvanceDoc;
    if (advance.tenantId && advance.tenantId !== tenantId) {
      throw new HttpsError("permission-denied", "Ese anticipo pertenece a otro conjunto.");
    }
    if (advance.status !== "open") {
      throw new HttpsError("failed-precondition", "Ese anticipo ya no tiene saldo por aplicar.");
    }

    const cuotaRef = firestore.collection("billingStatements").doc(statementId);
    const cuotaSnap = await tx.get(cuotaRef);
    if (!cuotaSnap.exists) throw new HttpsError("not-found", "Ese cargo ya no existe.");
    const cuota = cuotaSnap.data() as CuotaDoc;
    if (cuota.tenantId && cuota.tenantId !== tenantId) {
      throw new HttpsError("permission-denied", "Ese cargo pertenece a otro conjunto.");
    }

    // **R6 — un anticipo solo se cruza contra cargos de SU misma unidad.**
    //
    // No es una comprobación de higiene: sin ella, el saldo a favor de una
    // unidad podría pagar la deuda de otra, y el dinero de un residente acabaría
    // saldando la cuota de un vecino sin que ninguno de los dos se entere.
    if ((advance.unitId ?? "") !== (cuota.unitId ?? "")) {
      throw new HttpsError("permission-denied", "Ese anticipo es de otra unidad.");
    }

    // ── Aritmética ───────────────────────────────────────────────────────────
    const remanente = typeof advance.remaining === "number" ? advance.remaining : 0;
    const cobrado = typeof cuota.amount === "number" ? cuota.amount : 0;
    const pagado = typeof cuota.paymentAmount === "number" ? cuota.paymentAmount : 0;
    const cruzadoAntes = typeof cuota.advanceAppliedAmount === "number" ? cuota.advanceAppliedAmount : 0;
    const deuda = Math.max(cobrado - pagado - cruzadoAntes, 0);

    // §5.3: un cruce mayor que el saldo del cargo **se limita al saldo**, y el
    // resto sigue en el anticipo. No se rechaza: quien cruza suele querer «lo
    // que haga falta», y obligarle a calcular el importe exacto a mano es
    // pedirle que haga la aritmética que este servidor existe para hacer.
    const aplicado = Math.min(pedido, remanente, deuda);
    if (aplicado <= 0) {
      throw new HttpsError("failed-precondition", "Ese cargo no tiene saldo pendiente que cubrir.");
    }

    const cruzadoDespues = cruzadoAntes + aplicado;
    const remanenteDespues = remanente - aplicado;
    const { balance, status } = calcularSaldo(cobrado, pagado, cruzadoDespues, cuota.dueDate, hoyDe(fecha));
    const advanceStatus = remanenteDespues <= 0 ? "applied" : "open";

    // ── Escrituras ───────────────────────────────────────────────────────────
    //
    // **R4: aquí NO se escribe ningún asiento de libro, y tampoco se toca
    // `paymentAmount`.** Las dos mitades de la misma regla. Ver la cabecera.
    const applicationRef = firestore.collection("advanceApplications").doc();
    tx.set(applicationRef, {
      tenantId,
      advanceId,
      statementId,
      // Copiado del anticipo **para que la regla de Firestore se pueda
      // escribir**: sin él, «el residente solo ve los de su unidad» no sería
      // expresable y habría que cerrarle la colección entera.
      unitId: advance.unitId ?? "",
      amount: aplicado,
      date: fecha,
      operationKey,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(cuotaRef, {
      advanceAppliedAmount: cruzadoDespues,
      balance,
      status,
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(advanceRef, {
      remaining: remanenteDespues,
      status: advanceStatus,
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.set(opRef, {
      tenantId,
      kind: "advance_application",
      advanceId,
      statementId,
      applicationId: applicationRef.id,
      appliedAmount: aplicado,
      remaining: remanenteDespues,
      advanceStatus,
      balance,
      status,
      actorUid: uid,
      createdAt: Timestamp.now(),
    });

    return {
      ok: true as const,
      applied: true,
      applicationId: applicationRef.id,
      appliedAmount: aplicado,
      remaining: remanenteDespues,
      advanceStatus,
      balance,
      status,
    };
  });
}

/**
 * Deshace un cruce. Devuelve el anticipo a `open` con su remanente (CA12).
 *
 * **Existe porque `advanceApplications` existe.** Sin un documento por cruce
 * habría que adivinar cuánto se aplicó a qué para poder deshacerlo, y adivinar
 * sobre dinero no es una opción.
 */
export async function deshacerCruce(
  input: DeshacerCruceInput,
  uid: string,
  role: unknown,
  tokenTenant: unknown,
): Promise<DeshacerCruceResultado> {
  const tenantId = texto(input.tenantId, "el conjunto");
  const applicationId = texto(input.applicationId, "el cruce");
  const operationKey = texto(input.operationKey, "la clave de operación");

  assertPuedeOperarAnticipos(role, tokenTenant, tenantId);
  await assertFeatureEnabled("producto-anticipos", tenantId);

  const firestore = db();
  const opRef = firestore.collection("paymentOperations").doc(`${tenantId}_${operationKey}`);

  return firestore.runTransaction(async (tx) => {
    const opSnap = await tx.get(opRef);
    if (opSnap.exists) {
      const prev = opSnap.data() as Partial<DeshacerCruceResultado>;
      return {
        ok: true as const,
        reversed: false,
        remaining: prev.remaining ?? 0,
        advanceStatus: prev.advanceStatus ?? "open",
        balance: prev.balance ?? 0,
        status: prev.status ?? "pending",
      };
    }

    const applicationRef = firestore.collection("advanceApplications").doc(applicationId);
    const applicationSnap = await tx.get(applicationRef);
    if (!applicationSnap.exists) throw new HttpsError("not-found", "Ese cruce ya no existe.");
    const application = applicationSnap.data() as {
      tenantId?: string;
      advanceId?: string;
      statementId?: string;
      amount?: number;
      reversedAt?: unknown;
    };
    if (application.tenantId && application.tenantId !== tenantId) {
      throw new HttpsError("permission-denied", "Ese cruce pertenece a otro conjunto.");
    }
    if (application.reversedAt) {
      throw new HttpsError("failed-precondition", "Ese cruce ya se deshizo.");
    }

    const monto = typeof application.amount === "number" ? application.amount : 0;
    const advanceRef = firestore.collection("advances").doc(application.advanceId ?? "");
    const advanceSnap = await tx.get(advanceRef);
    if (!advanceSnap.exists) throw new HttpsError("not-found", "El anticipo del cruce ya no existe.");
    const advance = advanceSnap.data() as AdvanceDoc;

    const cuotaRef = firestore.collection("billingStatements").doc(application.statementId ?? "");
    const cuotaSnap = await tx.get(cuotaRef);
    if (!cuotaSnap.exists) throw new HttpsError("not-found", "El cargo del cruce ya no existe.");
    const cuota = cuotaSnap.data() as CuotaDoc;

    const cobrado = typeof cuota.amount === "number" ? cuota.amount : 0;
    const pagado = typeof cuota.paymentAmount === "number" ? cuota.paymentAmount : 0;
    const cruzadoAntes = typeof cuota.advanceAppliedAmount === "number" ? cuota.advanceAppliedAmount : 0;
    // El mismo `max(…, 0)` que `saldoTrasRevertir`, por el mismo motivo: si
    // alguien tocó el cargo por otra vía, restar a ciegas dejaría un cruzado
    // NEGATIVO, que se lee como que el conjunto le debe dinero al residente.
    const cruzadoDespues = Math.max(cruzadoAntes - monto, 0);
    const remanenteDespues = (typeof advance.remaining === "number" ? advance.remaining : 0) + monto;
    const { balance, status } = calcularSaldo(cobrado, pagado, cruzadoDespues, cuota.dueDate, hoyDe(undefined));

    // **El anticipo vuelve a `open`, no a lo que fuera.** Un anticipo con
    // remanente es `open` por definición (§6), y deshacer un cruce siempre deja
    // remanente: el que acaba de devolverse.
    tx.update(advanceRef, {
      remaining: remanenteDespues,
      status: "open",
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(cuotaRef, {
      advanceAppliedAmount: cruzadoDespues,
      balance,
      status,
      updatedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(applicationRef, {
      reversedAt: FieldValue.serverTimestamp(),
      reversedBy: uid,
      ...(input.reason ? { reversalReason: input.reason } : {}),
    });

    tx.set(opRef, {
      tenantId,
      kind: "advance_application_reversal",
      applicationId,
      advanceId: application.advanceId ?? "",
      statementId: application.statementId ?? "",
      amount: monto,
      remaining: remanenteDespues,
      advanceStatus: "open",
      balance,
      status,
      actorUid: uid,
      createdAt: Timestamp.now(),
    });

    return {
      ok: true as const,
      reversed: true,
      remaining: remanenteDespues,
      advanceStatus: "open" as const,
      balance,
      status,
    };
  });
}

/**
 * La fecha con la que se decide si un cargo está vencido.
 *
 * Se separa en una función para que quede dicho que **NO es la fecha del cruce**:
 * un cruce con fecha contable de marzo no puede hacer que hoy una cuota deje de
 * estar vencida. `calcularSaldo` compara `dueDate` con «hoy», y hoy es hoy.
 */
function hoyDe(_fechaContable: string | undefined): string {
  return new Date().toISOString().slice(0, 10);
}
