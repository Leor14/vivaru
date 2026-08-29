"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLECCION_CASOS = void 0;
exports.aplicarCaso = aplicarCaso;
exports.rechazarCaso = rechazarCaso;
exports.reabrirCaso = reabrirCaso;
exports.leerCascada = leerCascada;
exports.escribirCascada = escribirCascada;
exports.liberarConciliacion = liberarConciliacion;
exports.casoDeRelleno = casoDeRelleno;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const conciliacion_1 = require("./conciliacion");
const tenant_membership_1 = require("./tenant-membership");
const tenant_status_1 = require("./tenant-status");
/**
 * `PRD-V-FLOW-004` — el expediente, del lado del servidor.
 *
 * **Por qué esto es una callable y no una escritura del cliente**, que es la
 * decisión que más agujeros de permisos ha causado en este producto, y aquí
 * cualquiera de las cuatro razones basta:
 *
 * 1. **Escribe en tres colecciones** —`bankStatementLines`, `ledgerEntries` y
 *    `reconciliationCases`— y las tres tienen que moverse juntas o ninguna.
 * 2. **R2 es aritmética que el cliente no debe poder saltarse.** El defecto que
 *    motiva la ficha es exactamente eso: `matchLine` escribía lo que le pidieran.
 * 3. **La cascada R7 tiene que vivir donde vive el reverso**, y el reverso ya es
 *    una callable.
 * 4. **Una regla de Firestore no puede sostener el invariante sola**: el Admin
 *    SDK no las evalúa. La regla queda como refuerzo que cierra el camino del
 *    cliente (R8), no como guardián.
 *
 * **Y NO va detrás de la bandera** (§11.4). La bandera gobierna la bandeja y el
 * expediente; la coherencia entra sin interruptor, porque apagarla devolvería el
 * producto al estado que permitió casar −300.000 contra +40.000.
 */
const db = () => (0, firestore_1.getFirestore)();
exports.COLECCION_CASOS = "reconciliationCases";
function texto(valor, campo) {
    const v = typeof valor === "string" ? valor.trim() : "";
    if (!v)
        throw new https_1.HttpsError("invalid-argument", `Falta ${campo}.`);
    return v;
}
/**
 * Misma frontera que `assertPuedeCobrar` y `assertPuedeOperarAnticipos`, y por
 * las mismas razones: la autoridad es la **membresía**, no el claim del token
 * —que es de un solo conjunto y bloquearía al administrador de varios—, y el
 * estado del conjunto va al final porque conciliar es **escribir**.
 */
async function assertPuedeConciliar(role, uid, tenantId) {
    const rol = typeof role === "string" ? role : "";
    if (rol === "superadmin" || rol === "super_admin")
        return;
    const esAdmin = rol === "tenant_admin" || rol === "admin_tenant";
    if (!esAdmin || !(await (0, tenant_membership_1.esAdminActivoDelConjunto)(tenantId, uid))) {
        throw new https_1.HttpsError("permission-denied", "No tienes permiso para conciliar en este conjunto.");
    }
    await (0, tenant_status_1.assertTenantOperable)(tenantId);
}
const dinero = (n) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 }).format(n);
// ── Lectura y creación del caso ─────────────────────────────────────────────
function comoLinea(id, d) {
    return {
        id,
        tenantId: String(d.tenantId ?? ""),
        bankAccountId: String(d.bankAccountId ?? ""),
        date: String(d.date ?? ""),
        description: typeof d.description === "string" ? d.description : "",
        amount: Number(d.amount ?? 0),
    };
}
function comoAsiento(id, d) {
    return {
        id,
        tenantId: String(d.tenantId ?? ""),
        bankAccountId: d.bankAccountId ?? null,
        date: String(d.date ?? ""),
        type: d.type === "egreso" ? "egreso" : "ingreso",
        amount: Number(d.amount ?? 0),
        reconciled: d.reconciled === true,
        reversedByEntryId: d.reversedByEntryId ?? null,
    };
}
/**
 * El caso de una línea, creándolo si no existe.
 *
 * **Existe porque las 27 líneas de producción son anteriores al expediente.**
 * Si las callables exigieran un caso ya escrito, no se podría conciliar nada
 * hasta que corriera el relleno — y un despliegue que necesita un script para
 * no romperse es un despliegue que rompe si el script falla.
 */
function casoNuevo(linea, status, extra = {}) {
    return {
        tenantId: linea.tenantId,
        bankAccountId: linea.bankAccountId,
        bankStatementLineId: linea.id,
        status,
        version: 0,
        candidateLedgerEntryIds: [],
        matchedLedgerEntryId: null,
        excepcion: null,
        incoherencias: [],
        motivoCodigo: null,
        motivoTexto: null,
        ...extra,
    };
}
// ── La transición, en un solo sitio ─────────────────────────────────────────
/**
 * **Toda transición pasa por aquí**, y por eso el historial no puede quedarse a
 * medias: quien escribe el estado escribe la línea de historia en la misma
 * operación. Un estado sin su porqué es exactamente lo que esta ficha viene a
 * arreglar.
 */
function escribirTransicion(tx, ref, caso, a, quien, mecanismo, motivoCodigo, motivoTexto, campos = {}, existe = true) {
    if (existe && !(0, conciliacion_1.transicionValida)(caso.status, a)) {
        throw new https_1.HttpsError("failed-precondition", `Un caso ${caso.status} no puede pasar a ${a}.`);
    }
    if (!(0, conciliacion_1.motivoValido)(a, motivoCodigo, motivoTexto)) {
        throw new https_1.HttpsError("invalid-argument", "Esa salida necesita un motivo del catálogo, y «otro» necesita texto.");
    }
    const transicion = {
        de: caso.status,
        a,
        cuando: firestore_1.Timestamp.now(),
        quien,
        motivoCodigo,
        mecanismo,
    };
    const cuerpo = {
        ...caso,
        ...campos,
        status: a,
        version: caso.version + 1,
        motivoCodigo,
        motivoTexto,
        history: firestore_1.FieldValue.arrayUnion(transicion),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedBy: quien,
    };
    if (existe) {
        tx.update(ref, cuerpo);
    }
    else {
        tx.set(ref, { ...cuerpo, history: [transicion], createdAt: firestore_1.FieldValue.serverTimestamp(), createdBy: quien });
    }
}
async function aplicarCaso(input, uid, role) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const lineaId = texto(input.bankStatementLineId, "la línea del extracto");
    const asientoId = texto(input.ledgerEntryId, "el movimiento del libro");
    await assertPuedeConciliar(role, uid, tenantId);
    const firestore = db();
    const lineaRef = firestore.collection("bankStatementLines").doc(lineaId);
    const asientoRef = firestore.collection("ledgerEntries").doc(asientoId);
    const casoRef = firestore.collection(exports.COLECCION_CASOS).doc((0, conciliacion_1.idDeCaso)(lineaId));
    return firestore.runTransaction(async (tx) => {
        // ── Lecturas, todas antes de escribir ────────────────────────────────────
        const [lineaSnap, asientoSnap, casoSnap] = await Promise.all([
            tx.get(lineaRef),
            tx.get(asientoRef),
            tx.get(casoRef),
        ]);
        if (!lineaSnap.exists)
            throw new https_1.HttpsError("not-found", "Esa línea del extracto ya no existe.");
        if (!asientoSnap.exists)
            throw new https_1.HttpsError("not-found", "Ese movimiento del libro ya no existe.");
        const lineaData = lineaSnap.data();
        const asientoData = asientoSnap.data();
        const linea = comoLinea(lineaId, lineaData);
        const asiento = comoAsiento(asientoId, asientoData);
        if (linea.tenantId !== tenantId)
            throw new https_1.HttpsError("permission-denied", "Esa línea es de otro conjunto.");
        if (asiento.tenantId !== tenantId)
            throw new https_1.HttpsError("permission-denied", "Ese movimiento es de otro conjunto.");
        const caso = casoSnap.exists ? casoSnap.data() : casoNuevo(linea, "detectado");
        if (typeof input.expectedVersion === "number" && input.expectedVersion !== caso.version) {
            throw new https_1.HttpsError("failed-precondition", "Alguien movió este caso mientras lo mirabas. Vuelve a abrirlo.");
        }
        // **R10 · idempotencia.** Reaplicar lo mismo no duplica ni sube la versión.
        if (lineaData.reconciled === true && lineaData.matchedLedgerEntryId === asientoId) {
            return { ok: true, applied: false, status: caso.status, version: caso.version };
        }
        if (lineaData.reconciled === true) {
            throw new https_1.HttpsError("failed-precondition", "Esa línea ya está conciliada con otro movimiento.");
        }
        // ── Las reglas, y el mensaje lleva los números delante ───────────────────
        const descarte = (0, conciliacion_1.porQueNoEsCandidato)(linea, asiento);
        if (descarte === "ya_conciliado") {
            throw new https_1.HttpsError("failed-precondition", "Ese movimiento ya fue conciliado con otra línea.");
        }
        if (descarte === "anulado") {
            throw new https_1.HttpsError("failed-precondition", "Ese movimiento está anulado por un reverso.");
        }
        if (descarte === "otra_cuenta") {
            throw new https_1.HttpsError("failed-precondition", "Ese movimiento es de otra cuenta bancaria.");
        }
        if (descarte === "efecto") {
            throw new https_1.HttpsError("failed-precondition", `No cuadran: el banco mueve ${dinero(linea.amount)} y el movimiento ${dinero((0, conciliacion_1.efectoContable)(asiento))}.`);
        }
        if (descarte === "fecha") {
            throw new https_1.HttpsError("failed-precondition", `Se llevan más de 3 días: la línea es del ${linea.date} y el movimiento del ${asiento.date}.`);
        }
        // ── Escrituras: las tres, o ninguna ─────────────────────────────────────
        tx.update(lineaRef, { reconciled: true, matchedLedgerEntryId: asientoId });
        tx.update(asientoRef, {
            reconciled: true,
            bankStatementLineId: lineaId,
            reconciledAt: new Date().toISOString().slice(0, 10),
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        escribirTransicion(tx, casoRef, caso, "aplicado", uid, "bandeja", null, null, { matchedLedgerEntryId: asientoId, excepcion: null, incoherencias: [], candidateLedgerEntryIds: [asientoId] }, casoSnap.exists);
        return { ok: true, applied: true, status: "aplicado", version: caso.version + 1 };
    });
}
async function rechazarCaso(input, uid, role) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const lineaId = texto(input.bankStatementLineId, "la línea del extracto");
    await assertPuedeConciliar(role, uid, tenantId);
    const firestore = db();
    const lineaRef = firestore.collection("bankStatementLines").doc(lineaId);
    const casoRef = firestore.collection(exports.COLECCION_CASOS).doc((0, conciliacion_1.idDeCaso)(lineaId));
    return firestore.runTransaction(async (tx) => {
        const [lineaSnap, casoSnap] = await Promise.all([tx.get(lineaRef), tx.get(casoRef)]);
        if (!lineaSnap.exists)
            throw new https_1.HttpsError("not-found", "Esa línea del extracto ya no existe.");
        const linea = comoLinea(lineaId, lineaSnap.data());
        if (linea.tenantId !== tenantId)
            throw new https_1.HttpsError("permission-denied", "Esa línea es de otro conjunto.");
        const caso = casoSnap.exists ? casoSnap.data() : casoNuevo(linea, "detectado");
        if (typeof input.expectedVersion === "number" && input.expectedVersion !== caso.version) {
            throw new https_1.HttpsError("failed-precondition", "Alguien movió este caso mientras lo mirabas. Vuelve a abrirlo.");
        }
        escribirTransicion(tx, casoRef, caso, "rechazado", uid, "bandeja", (input.motivoCodigo ?? null), typeof input.motivoTexto === "string" ? input.motivoTexto : null, {}, casoSnap.exists);
        return { ok: true, status: "rechazado", version: caso.version + 1 };
    });
}
/**
 * Devuelve un caso a `detectado`. Si estaba **aplicado**, deshace el
 * emparejamiento — **es el descasado de siempre, pero dejando rastro**.
 */
async function reabrirCaso(input, uid, role) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const lineaId = texto(input.bankStatementLineId, "la línea del extracto");
    await assertPuedeConciliar(role, uid, tenantId);
    const firestore = db();
    const lineaRef = firestore.collection("bankStatementLines").doc(lineaId);
    const casoRef = firestore.collection(exports.COLECCION_CASOS).doc((0, conciliacion_1.idDeCaso)(lineaId));
    return firestore.runTransaction(async (tx) => {
        const [lineaSnap, casoSnap] = await Promise.all([tx.get(lineaRef), tx.get(casoRef)]);
        if (!lineaSnap.exists)
            throw new https_1.HttpsError("not-found", "Esa línea del extracto ya no existe.");
        const lineaData = lineaSnap.data();
        const linea = comoLinea(lineaId, lineaData);
        if (linea.tenantId !== tenantId)
            throw new https_1.HttpsError("permission-denied", "Esa línea es de otro conjunto.");
        const caso = casoSnap.exists ? casoSnap.data() : casoNuevo(linea, "detectado");
        if (typeof input.expectedVersion === "number" && input.expectedVersion !== caso.version) {
            throw new https_1.HttpsError("failed-precondition", "Alguien movió este caso mientras lo mirabas. Vuelve a abrirlo.");
        }
        const asientoId = typeof lineaData.matchedLedgerEntryId === "string" ? lineaData.matchedLedgerEntryId : null;
        const asientoRef = asientoId ? firestore.collection("ledgerEntries").doc(asientoId) : null;
        const asientoSnap = asientoRef ? await tx.get(asientoRef) : null;
        tx.update(lineaRef, { reconciled: false, matchedLedgerEntryId: null });
        if (asientoRef && asientoSnap?.exists) {
            tx.update(asientoRef, {
                reconciled: false,
                bankStatementLineId: null,
                reconciledAt: null,
                updatedBy: uid,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        escribirTransicion(tx, casoRef, caso, "detectado", uid, "bandeja", null, null, { matchedLedgerEntryId: null, incoherencias: [] }, casoSnap.exists);
        return { ok: true, status: "detectado", version: caso.version + 1 };
    });
}
async function leerCascada(tx, asientoId, asientoData) {
    if (!asientoData || asientoData.reconciled !== true)
        return null;
    const lineaId = typeof asientoData.bankStatementLineId === "string" ? asientoData.bankStatementLineId : "";
    if (!lineaId)
        return null;
    const firestore = db();
    const lineaRef = firestore.collection("bankStatementLines").doc(lineaId);
    const casoRef = firestore.collection(exports.COLECCION_CASOS).doc((0, conciliacion_1.idDeCaso)(lineaId));
    const [lineaSnap, casoSnap] = await Promise.all([tx.get(lineaRef), tx.get(casoRef)]);
    if (!lineaSnap.exists)
        return null;
    const linea = comoLinea(lineaId, lineaSnap.data());
    const caso = casoSnap.exists ? casoSnap.data() : casoNuevo(linea, "aplicado", { matchedLedgerEntryId: asientoId });
    return { lineaRef, casoRef, caso, casoExiste: casoSnap.exists };
}
function escribirCascada(tx, preparada, uid, mecanismo) {
    if (!preparada)
        return;
    tx.update(preparada.lineaRef, { reconciled: false, matchedLedgerEntryId: null });
    escribirTransicion(tx, preparada.casoRef, preparada.caso, "reversado", uid, mecanismo, mecanismo === "cascada_reverso" ? "reverso_del_asiento" : "linea_eliminada", null, { matchedLedgerEntryId: null, excepcion: null }, preparada.casoExiste);
}
/**
 * El camino del cliente: liberar la conciliación de un asiento **antes** de
 * anularlo o borrarlo desde el navegador.
 *
 * Existe porque `reverseLedgerEntry` y `deleteLedgerEntry` viven en el cliente y
 * la regla les va a impedir tocar un asiento conciliado (R8). Sin esta callable,
 * ese veto convertiría el ciclo automático de egresos en un error de permisos.
 */
async function liberarConciliacion(input, uid, role) {
    const tenantId = texto(input.tenantId, "el conjunto");
    const asientoId = texto(input.ledgerEntryId, "el movimiento del libro");
    await assertPuedeConciliar(role, uid, tenantId);
    const firestore = db();
    const asientoRef = firestore.collection("ledgerEntries").doc(asientoId);
    return firestore.runTransaction(async (tx) => {
        const asientoSnap = await tx.get(asientoRef);
        if (!asientoSnap.exists)
            return { ok: true, released: false };
        const asientoData = asientoSnap.data();
        if (String(asientoData.tenantId ?? "") !== tenantId) {
            throw new https_1.HttpsError("permission-denied", "Ese movimiento es de otro conjunto.");
        }
        const preparada = await leerCascada(tx, asientoId, asientoData);
        if (!preparada)
            return { ok: true, released: false };
        tx.update(asientoRef, {
            reconciled: false,
            bankStatementLineId: null,
            reconciledAt: null,
            updatedBy: uid,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        escribirCascada(tx, preparada, uid, "cascada_reverso");
        return { ok: true, released: true };
    });
}
// ── El relleno, y §5.4 ──────────────────────────────────────────────────────
/**
 * Construye el caso que le corresponde a una línea que YA existe.
 *
 * **§5.4 — lo que ya está escrito no se reescribe, se nombra.** Una línea
 * conciliada nace `aplicado`, porque eso es lo que pasó, y si el par incumple
 * las reglas se le anotan las `incoherencias`. El criterio de no corregir el
 * dato histórico de conjuntos de ejemplo estaba escrito antes que esta ficha
 * (`roadmap-finance` §9).
 */
function casoDeRelleno(linea, asientos, emparejado) {
    if (emparejado) {
        return casoNuevo(linea, "aplicado", {
            matchedLedgerEntryId: emparejado.id,
            candidateLedgerEntryIds: [emparejado.id],
            incoherencias: (0, conciliacion_1.incoherenciasDelPar)(linea, emparejado),
        });
    }
    const { status, excepcion, candidateLedgerEntryIds } = (0, conciliacion_1.clasificar)(linea, asientos);
    return casoNuevo(linea, status, { excepcion, candidateLedgerEntryIds });
}
