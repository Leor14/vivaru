"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cruzarAnticipo = cruzarAnticipo;
exports.deshacerCruce = deshacerCruce;
exports.anularAnticipo = anularAnticipo;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const feature_flags_1 = require("./feature-flags");
const payments_1 = require("./payments");
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
const db = () => (0, firestore_1.getFirestore)();
function texto(valor, campo) {
    const out = typeof valor === "string" ? valor.trim() : "";
    if (!out)
        throw new https_1.HttpsError("invalid-argument", `Falta ${campo}.`);
    return out;
}
/**
 * Quién cruza un anticipo: la administración, o el superadmin.
 *
 * **El residente no, y no es desconfianza.** Cruzar mueve dinero entre
 * obligaciones; que lo haga quien responde de la contabilidad del conjunto, no
 * quien la paga (§3, CF6). Es la misma frontera que `assertPuedeCobrar`.
 */
function assertPuedeOperarAnticipos(role, tokenTenant, tenantId) {
    const rol = typeof role === "string" ? role : "";
    if (rol === "superadmin" || rol === "super_admin")
        return;
    const esAdmin = rol === "tenant_admin" || rol === "admin_tenant";
    if (!esAdmin || tokenTenant !== tenantId) {
        throw new https_1.HttpsError("permission-denied", "No tienes permiso para operar anticipos en este conjunto.");
    }
}
/** Cruza un anticipo contra un cargo. Transaccional e idempotente. */
async function cruzarAnticipo(input, uid, role, tokenTenant) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const advanceId = texto(input.advanceId, "el anticipo");
    const statementId = texto(input.statementId, "el cargo");
    const operationKey = texto(input.operationKey, "la clave de operación");
    const fecha = texto(input.date, "la fecha");
    assertPuedeOperarAnticipos(role, tokenTenant, tenantId);
    await (0, feature_flags_1.assertFeatureEnabled)("producto-anticipos", tenantId);
    const pedido = typeof input.amount === "number" ? input.amount : NaN;
    if (!Number.isFinite(pedido) || pedido <= 0) {
        throw new https_1.HttpsError("invalid-argument", "El importe a cruzar debe ser mayor a cero.");
    }
    const firestore = db();
    const opRef = firestore.collection("paymentOperations").doc(`${tenantId}_${operationKey}`);
    return firestore.runTransaction(async (tx) => {
        // ── Lecturas, todas antes de escribir ────────────────────────────────────
        const opSnap = await tx.get(opRef);
        if (opSnap.exists) {
            const prev = opSnap.data();
            return {
                ok: true,
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
        if (!advanceSnap.exists)
            throw new https_1.HttpsError("not-found", "Ese anticipo ya no existe.");
        const advance = advanceSnap.data();
        if (advance.tenantId && advance.tenantId !== tenantId) {
            throw new https_1.HttpsError("permission-denied", "Ese anticipo pertenece a otro conjunto.");
        }
        if (advance.status !== "open") {
            throw new https_1.HttpsError("failed-precondition", "Ese anticipo ya no tiene saldo por aplicar.");
        }
        const cuotaRef = firestore.collection("billingStatements").doc(statementId);
        const cuotaSnap = await tx.get(cuotaRef);
        if (!cuotaSnap.exists)
            throw new https_1.HttpsError("not-found", "Ese cargo ya no existe.");
        const cuota = cuotaSnap.data();
        if (cuota.tenantId && cuota.tenantId !== tenantId) {
            throw new https_1.HttpsError("permission-denied", "Ese cargo pertenece a otro conjunto.");
        }
        // **R6 — un anticipo solo se cruza contra cargos de SU misma unidad.**
        //
        // No es una comprobación de higiene: sin ella, el saldo a favor de una
        // unidad podría pagar la deuda de otra, y el dinero de un residente acabaría
        // saldando la cuota de un vecino sin que ninguno de los dos se entere.
        if ((advance.unitId ?? "") !== (cuota.unitId ?? "")) {
            throw new https_1.HttpsError("permission-denied", "Ese anticipo es de otra unidad.");
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
            throw new https_1.HttpsError("failed-precondition", "Ese cargo no tiene saldo pendiente que cubrir.");
        }
        const cruzadoDespues = cruzadoAntes + aplicado;
        const remanenteDespues = remanente - aplicado;
        const { balance, status } = (0, payments_1.calcularSaldo)(cobrado, pagado, cruzadoDespues, cuota.dueDate, hoyDe(fecha));
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(cuotaRef, {
            advanceAppliedAmount: cruzadoDespues,
            balance,
            status,
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(advanceRef, {
            remaining: remanenteDespues,
            status: advanceStatus,
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
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
            createdAt: firestore_1.Timestamp.now(),
        });
        return {
            ok: true,
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
async function deshacerCruce(input, uid, role, tokenTenant) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const applicationId = texto(input.applicationId, "el cruce");
    const operationKey = texto(input.operationKey, "la clave de operación");
    assertPuedeOperarAnticipos(role, tokenTenant, tenantId);
    await (0, feature_flags_1.assertFeatureEnabled)("producto-anticipos", tenantId);
    const firestore = db();
    const opRef = firestore.collection("paymentOperations").doc(`${tenantId}_${operationKey}`);
    return firestore.runTransaction(async (tx) => {
        const opSnap = await tx.get(opRef);
        if (opSnap.exists) {
            const prev = opSnap.data();
            return {
                ok: true,
                reversed: false,
                remaining: prev.remaining ?? 0,
                advanceStatus: prev.advanceStatus ?? "open",
                balance: prev.balance ?? 0,
                status: prev.status ?? "pending",
            };
        }
        const applicationRef = firestore.collection("advanceApplications").doc(applicationId);
        const applicationSnap = await tx.get(applicationRef);
        if (!applicationSnap.exists)
            throw new https_1.HttpsError("not-found", "Ese cruce ya no existe.");
        const application = applicationSnap.data();
        if (application.tenantId && application.tenantId !== tenantId) {
            throw new https_1.HttpsError("permission-denied", "Ese cruce pertenece a otro conjunto.");
        }
        if (application.reversedAt) {
            throw new https_1.HttpsError("failed-precondition", "Ese cruce ya se deshizo.");
        }
        const monto = typeof application.amount === "number" ? application.amount : 0;
        const advanceRef = firestore.collection("advances").doc(application.advanceId ?? "");
        const advanceSnap = await tx.get(advanceRef);
        if (!advanceSnap.exists)
            throw new https_1.HttpsError("not-found", "El anticipo del cruce ya no existe.");
        const advance = advanceSnap.data();
        const cuotaRef = firestore.collection("billingStatements").doc(application.statementId ?? "");
        const cuotaSnap = await tx.get(cuotaRef);
        if (!cuotaSnap.exists)
            throw new https_1.HttpsError("not-found", "El cargo del cruce ya no existe.");
        const cuota = cuotaSnap.data();
        const cobrado = typeof cuota.amount === "number" ? cuota.amount : 0;
        const pagado = typeof cuota.paymentAmount === "number" ? cuota.paymentAmount : 0;
        const cruzadoAntes = typeof cuota.advanceAppliedAmount === "number" ? cuota.advanceAppliedAmount : 0;
        // El mismo `max(…, 0)` que `saldoTrasRevertir`, por el mismo motivo: si
        // alguien tocó el cargo por otra vía, restar a ciegas dejaría un cruzado
        // NEGATIVO, que se lee como que el conjunto le debe dinero al residente.
        const cruzadoDespues = Math.max(cruzadoAntes - monto, 0);
        const remanenteDespues = (typeof advance.remaining === "number" ? advance.remaining : 0) + monto;
        const { balance, status } = (0, payments_1.calcularSaldo)(cobrado, pagado, cruzadoDespues, cuota.dueDate, hoyDe(undefined));
        // **El anticipo vuelve a `open`, no a lo que fuera.** Un anticipo con
        // remanente es `open` por definición (§6), y deshacer un cruce siempre deja
        // remanente: el que acaba de devolverse.
        tx.update(advanceRef, {
            remaining: remanenteDespues,
            status: "open",
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(cuotaRef, {
            advanceAppliedAmount: cruzadoDespues,
            balance,
            status,
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.update(applicationRef, {
            reversedAt: firestore_1.FieldValue.serverTimestamp(),
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
            createdAt: firestore_1.Timestamp.now(),
        });
        return {
            ok: true,
            reversed: true,
            remaining: remanenteDespues,
            advanceStatus: "open",
            balance,
            status,
        };
    });
}
/**
 * **R9 — anula un anticipo con motivo.** Terminal: de `cancelled` no se sale.
 *
 * **Anular NO es lo mismo que revertir el pago que lo creó, y la diferencia está
 * en dónde queda el dinero.** Revertir el pago lo devuelve entero, así que allí
 * el asiento del anticipo SÍ se revierte (R15, en `payments.ts`). Anular es otra
 * cosa: el dinero entró y se queda en el conjunto —lo que desaparece es el
 * crédito de esa unidad—, y **devolverlo es un egreso, que §4 deja fuera de esta
 * ficha a propósito**. Por eso aquí no se toca el libro: ese ingreso ocurrió.
 *
 * Queda registro por los dos lados: el anticipo conserva importe, fecha y unidad
 * con su motivo, y su asiento sigue en el libro. Un crédito que se esfuma sin
 * rastro sería justo lo que esta ficha existe para evitar.
 *
 * **CF3: solo con el remanente intacto.** Anular uno parcialmente cruzado
 * dejaría cargos saldados con un anticipo que ya no existe. Primero se deshacen
 * los cruces.
 */
async function anularAnticipo(input, uid, role, tokenTenant) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const advanceId = texto(input.advanceId, "el anticipo");
    const operationKey = texto(input.operationKey, "la clave de operación");
    // CF4. Va por `texto`, que rechaza también la cadena de espacios: un motivo en
    // blanco es lo mismo que no tener motivo, y se cuela solo si nadie lo mira.
    const motivo = texto(input.reason, "el motivo de la anulación");
    assertPuedeOperarAnticipos(role, tokenTenant, tenantId);
    await (0, feature_flags_1.assertFeatureEnabled)("producto-anticipos", tenantId);
    const firestore = db();
    const opRef = firestore.collection("paymentOperations").doc(`${tenantId}_${operationKey}`);
    return firestore.runTransaction(async (tx) => {
        const opSnap = await tx.get(opRef);
        if (opSnap.exists)
            return { ok: true, cancelled: false };
        const advanceRef = firestore.collection("advances").doc(advanceId);
        const advanceSnap = await tx.get(advanceRef);
        if (!advanceSnap.exists)
            throw new https_1.HttpsError("not-found", "Ese anticipo ya no existe.");
        const advance = advanceSnap.data();
        if (advance.tenantId && advance.tenantId !== tenantId) {
            throw new https_1.HttpsError("permission-denied", "Ese anticipo pertenece a otro conjunto.");
        }
        if (advance.status === "cancelled") {
            throw new https_1.HttpsError("failed-precondition", "Ese anticipo ya está anulado.");
        }
        // CF3.
        if ((advance.remaining ?? 0) !== (advance.amount ?? 0)) {
            throw new https_1.HttpsError("failed-precondition", "Ese anticipo ya se aplicó a algún cargo. Primero hay que deshacer esos cruces.");
        }
        tx.update(advanceRef, {
            status: "cancelled",
            remaining: 0,
            cancelledAt: firestore_1.FieldValue.serverTimestamp(),
            cancelledBy: uid,
            cancellationReason: motivo,
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        tx.set(opRef, {
            tenantId,
            kind: "advance_cancellation",
            advanceId,
            reason: motivo,
            actorUid: uid,
            createdAt: firestore_1.Timestamp.now(),
        });
        return { ok: true, cancelled: true };
    });
}
/**
 * La fecha con la que se decide si un cargo está vencido.
 *
 * Se separa en una función para que quede dicho que **NO es la fecha del cruce**:
 * un cruce con fecha contable de marzo no puede hacer que hoy una cuota deje de
 * estar vencida. `calcularSaldo` compara `dueDate` con «hoy», y hoy es hoy.
 */
function hoyDe(_fechaContable) {
    return new Date().toISOString().slice(0, 10);
}
