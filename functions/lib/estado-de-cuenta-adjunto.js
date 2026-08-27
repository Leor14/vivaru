"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unidadDelDestinatario = unidadDelDestinatario;
exports.adjuntoEsDelDestinatario = adjuntoEsDelDestinatario;
exports.pdfDelEstadoDeCuenta = pdfDelEstadoDeCuenta;
const estado_de_cuenta_1 = require("./estado-de-cuenta");
const pdf_resumen_1 = require("./pdf-resumen");
/**
 * La unidad de UN residente, o `null` si no se puede afirmar cuál es.
 *
 * **Devuelve `null` antes que adivinar.** Sin membresía, sin unidad asignada, o con la membresía
 * de otro conjunto, no hay respuesta correcta — y un adjunto es un documento que se entrega. La
 * ficha ya decidió lo mismo para el paz y salvo: «si la unidad no se reconoce, ya no se emite»,
 * porque antes salía vacío, daba cero y se firmaba igual.
 */
async function unidadDelDestinatario(db, tenantId, uid) {
    if (!tenantId || !uid)
        return null;
    // El id de la membresía es `{tenantId}_{uid}` — la misma convención que exige el predicado de
    // `tenant-membership.ts`. Leer por id evita una consulta y, sobre todo, evita el modo de fallo
    // en que una consulta mal filtrada devuelve la membresía de otro conjunto.
    const snap = await db.collection("tenantUsers").doc(`${tenantId}_${uid}`).get();
    if (!snap.exists)
        return null;
    const d = snap.data();
    // **Las tres comprobaciones son la guarda, y ninguna es redundante.** El id ya dice el conjunto,
    // pero un documento heredado puede tener el campo discrepando del id: eso pasa el conteo laxo y
    // falla el predicado real, y está medido en este repositorio. Se comprueban los dos.
    if (d.tenantId !== tenantId)
        return null;
    if (d.uid !== uid)
        return null;
    if (d.status && d.status !== "active")
        return null;
    const unitId = typeof d.unitId === "string" ? d.unitId.trim() : "";
    if (!unitId)
        return null;
    return { uid, tenantId, unitId };
}
/**
 * Comprueba que un adjunto ya construido corresponde a su destinatario.
 *
 * **Es un cinturón sobre el tirante, y tiene motivo.** `unidadDelDestinatario` resuelve bien; lo
 * que esto ataja es el error de FONTANERÍA — resolver dentro del bucle y enviar fuera, reutilizar
 * una variable, invertir dos argumentos—. Son errores que el compilador no ve porque los dos
 * valores son `string`, y cuyo síntoma es un vecino leyendo la deuda de otro.
 *
 * Se llama **inmediatamente antes de enviar**, con lo que se va a enviar de verdad.
 */
function adjuntoEsDelDestinatario(destinatario, adjunto) {
    return adjunto.tenantId === destinatario.tenantId && adjunto.unitId === destinatario.unitId;
}
/**
 * El PDF del estado de cuenta de UNA unidad, listo para adjuntar.
 *
 * **Reutiliza `buildSummaryPdf`**, que ya existía para el informe mensual de comité — se sacó de
 * `index.ts` a su propio módulo justo para esto. Duplicar la fontanería de `pdfkit` habría dejado
 * dos sitios donde arreglar el mismo defecto de márgenes.
 *
 * Devuelve también `tenantId` y `unitId`, y **no es información decorativa**: es lo que
 * `adjuntoEsDelDestinatario` compara justo antes de enviar. Un PDF que no sabe de quién es no se
 * puede comprobar.
 */
async function pdfDelEstadoDeCuenta(db, destinatario, formatearImporte) {
    const snap = await db
        .collection("billingStatements")
        .where("tenantId", "==", destinatario.tenantId)
        .where("unitId", "==", destinatario.unitId)
        .get();
    const cargos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    // Sin movimientos no se adjunta nada. Un PDF vacío en un correo de cobranza es
    // ruido que además hace dudar de si el sistema funciona.
    if (cargos.length === 0)
        return null;
    const e = (0, estado_de_cuenta_1.construirEstadoDeCuenta)(cargos);
    const filas = e.lineas.map((l) => [
        `${l.periodo} · ${l.concepto}`,
        `${formatearImporte(l.cargo)}   ·   saldo ${formatearImporte(l.saldoAcumulado)}`,
    ]);
    filas.push(["", ""]);
    filas.push(["SALDO PENDIENTE", formatearImporte(e.saldoFinal)]);
    const buffer = await (0, pdf_resumen_1.buildSummaryPdf)("Estado de cuenta", `Unidad ${destinatario.unitId} · generado automáticamente`, filas);
    return { tenantId: destinatario.tenantId, unitId: destinatario.unitId, nombre: "estado-de-cuenta.pdf", buffer };
}
