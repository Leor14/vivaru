"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitirPazYSalvo = emitirPazYSalvo;
exports.anularPazYSalvo = anularPazYSalvo;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const comprobante_1 = require("./comprobante");
/**
 * `PRD-V-FEAT-004` — el certificado de paz y salvo.
 *
 * **Por qué es callable y el estado de cuenta no** (§11.1): la única condición
 * de este documento es «saldo cero», y **esa no la puede evaluar el cliente**.
 * Un navegador manipulado emitiría un paz y salvo falso — y este papel se enseña
 * en una notaría, no en la aplicación. El servidor lee, comprueba y emite.
 *
 * ---
 *
 * **R6 NO SE IMPLEMENTA, Y HAY QUE DECIR POR QUÉ.** La ficha permite que el
 * certificado acredite una fecha **anterior** a hoy. Eso exige saber qué debía la
 * unidad ese día, y **no se puede saber**: los cargos sí tienen fecha —`period`,
 * a veces `dueDate`— pero **los pagos no**. De 90 cargos con pago en producción
 * solo 50 traen `lastPaymentAt`; `paymentOperations` son 5 porque nacieron con
 * `FIN-001` el 20 de agosto de 2026; y `ledgerEntries` no tiene `unitId`.
 *
 * Con los cargos fechados y los pagos no, un certificado retroactivo **contaría
 * como cobrados pagos que llegaron después de la fecha** y certificaría que
 * alguien estaba al día cuando no lo estaba. En un documento que se entrega a un
 * tercero eso no es una imprecisión: es una afirmación falsa firmada por el
 * conjunto.
 *
 * Por eso `asOfDate` **es siempre el día de la emisión** en el MVP, y la fecha
 * viaja igualmente en el documento (que es la otra mitad de R6: declarar a qué
 * fecha aplica). Retroactivo entra cuando los pagos tengan fecha, no antes.
 */
const db = () => (0, firestore_1.getFirestore)();
/**
 * Emite el certificado si —y solo si— la unidad no debe nada.
 *
 * **El saldo se lee de `balance`, no de «cargado − pagado».** Es la misma cifra
 * que enseñan la cartera y el estado de cuenta; calcularla de otra forma dejaría
 * al certificado contradiciendo a las dos pantallas desde las que se pide.
 */
async function emitirPazYSalvo(input, uid) {
    const firestore = db();
    // Idempotencia por clave, mismo patrón que el reparto y el pago: el id ES la
    // clave normalizada. Y se resuelve ANTES de nada, porque un reintento de la
    // misma emisión no es una emisión nueva — la lección de `FLOW-001`.
    const certificateId = `pys_${input.operationKey.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 120)}`;
    const ref = firestore.collection("clearanceCertificates").doc(certificateId);
    const existente = await ref.get();
    if (existente.exists) {
        const d = existente.data();
        return {
            ok: true,
            certificateId,
            code: d.code ?? (0, comprobante_1.codigoDesdeId)(certificateId, "PYS"),
            created: false,
            balanceAtIssue: d.balanceAtIssue ?? 0,
            creditBalance: d.creditBalance ?? 0,
        };
    }
    /**
     * **La unidad se busca por SUS DOS CLAVES, y esto no es celo.**
     *
     * En `billingStatements` conviven dos convenciones de `unitId`: el id del
     * documento de la unidad —lo que devuelve `repartirPorCoeficiente` y lo que
     * guarda `tenantUsers.unitId`— y el campo `unitId` de la unidad, que es un
     * slug. Medido el 25 de agosto de 2026: en **producción**, 197 cargos por id
     * y 19 por campo, con **tres conjuntos que tienen las dos a la vez**
     * (`tenant-santa-maria` 96/3, `queretarock` 16/8, `residencial-qintilab`
     * 16/8).
     *
     * Consultar por una sola clave dejaría fuera la deuda escrita con la otra, y
     * este documento **afirma que no hay ninguna**. Sería certificar al día a
     * quien debe — en un papel que se enseña ante un tercero. Cualquier otra
     * pantalla que se equivoque aquí pinta un número corto; esta miente.
     *
     * El arreglo de fondo es unificar el dato, y no es de esta ficha. Mientras
     * tanto el certificado mira las dos, que es lo único que lo hace cierto.
     */
    const unitSnap = await firestore.collection("units").doc(input.unitId).get();
    const claveAlterna = unitSnap.data()?.unitId;
    const claves = [...new Set([input.unitId, claveAlterna].filter(Boolean))];
    const cargosPorClave = await Promise.all(claves.map((clave) => firestore
        .collection("billingStatements")
        .where("tenantId", "==", input.tenantId)
        .where("unitId", "==", clave)
        .get()));
    const cargosSnap = { docs: cargosPorClave.flatMap((snap) => snap.docs) };
    // R5 · un cargo anulado no cuenta. Y su `balance` ya es cero, así que esto es
    // el segundo de los dos caminos que lo dejan fuera: el estado y el saldo.
    const vigentes = cargosSnap.docs
        .map((d) => d.data())
        .filter((c) => c.status !== "cancelled");
    const saldo = vigentes.reduce((a, c) => a + (c.balance ?? 0), 0);
    // R3 · la condición del documento. Se nombra QUÉ debe y desde cuándo: «no se
    // puede emitir» sin decir por qué manda a la persona a preguntar.
    if (saldo > 0) {
        const conDeuda = vigentes.filter((c) => (c.balance ?? 0) > 0);
        const periodos = [...new Set(conDeuda.map((c) => c.period).filter(Boolean))].sort();
        throw new https_1.HttpsError("failed-precondition", `No se puede emitir el paz y salvo: la unidad tiene un saldo pendiente de ${saldo}` +
            (periodos.length > 0 ? `, desde ${periodos[0]}${periodos.length > 1 ? ` (${periodos.length} períodos)` : ""}.` : "."));
    }
    // R4 · un saldo A FAVOR no impide emitirlo, y el documento lo nombra. Se lee
    // aquí porque no vive en los cargos: son documentos de `advances`.
    const anticiposSnap = await firestore
        .collection("advances")
        .where("tenantId", "==", input.tenantId)
        .where("unitId", "==", input.unitId)
        .get();
    const creditBalance = anticiposSnap.docs
        .map((d) => d.data())
        .filter((a) => a.status === "open")
        .reduce((a, x) => a + (x.remaining ?? 0), 0);
    // **El código NO se deriva del id del documento**, y esto costó una prueba en
    // rojo. El id es determinista a propósito —lleva dentro la `operationKey`,
    // que es lo que hace idempotente la emisión—, así que derivar de él daba
    // `PYS-PYS_PY`: repetía el prefijo, colaba un `_` y, lo que importa,
    // **dejaba el código elegible por el cliente**, que es quien manda la clave.
    //
    // La semilla es un id de Firestore recién generado: aleatorio, de veinte
    // caracteres —que es para lo que `codigoDesdeId` está escrita— y estable,
    // porque se guarda en el documento y el reintento idempotente devuelve el
    // guardado, no uno nuevo.
    const code = (0, comprobante_1.codigoDesdeId)(firestore.collection("clearanceCertificates").doc().id, "PYS");
    await ref.set({
        tenantId: input.tenantId,
        unitId: input.unitId,
        unitLabel: input.unitLabel ?? vigentes[0]?.unitLabel ?? input.unitId,
        issuedAt: input.issueDate,
        // Ver la cabecera: en el MVP acredita el día en que se emite, nunca antes.
        asOfDate: input.issueDate,
        code,
        requestedBy: uid,
        // Cero por definición —si no, no se habría llegado aquí— y se guarda igual,
        // porque un documento que afirma algo tiene que conservar lo que midió.
        balanceAtIssue: saldo,
        ...(creditBalance > 0 ? { creditBalance } : {}),
        status: "emitido",
        createdAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, certificateId, code, created: true, balanceAtIssue: saldo, creditBalance };
}
/**
 * Anula un certificado emitido con datos incorrectos (§6).
 *
 * **No se borra, se marca.** Un paz y salvo que alguien descargó ya salió del
 * sistema: borrar el registro dejaría al conjunto sin forma de saber que ese
 * papel existió y fue retirado. Es la misma decisión que el recibo anulado.
 */
async function anularPazYSalvo(input, uid) {
    const motivo = (input.reason ?? "").trim();
    if (!motivo)
        throw new https_1.HttpsError("invalid-argument", "Anular exige un motivo.");
    const ref = db().collection("clearanceCertificates").doc(input.certificateId);
    const snap = await ref.get();
    if (!snap.exists)
        throw new https_1.HttpsError("not-found", "Ese certificado no existe.");
    const cert = snap.data();
    if (cert.tenantId !== input.tenantId) {
        throw new https_1.HttpsError("permission-denied", "Ese certificado no pertenece a este conjunto.");
    }
    if (cert.status === "anulado") {
        return { ok: true, certificateId: input.certificateId, alreadyCancelled: true };
    }
    await ref.update({
        status: "anulado",
        anuladoEn: firestore_1.FieldValue.serverTimestamp(),
        anuladoPor: uid,
        anuladoMotivo: motivo,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, certificateId: input.certificateId, alreadyCancelled: false };
}
