"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_ROWS = void 0;
exports.summarizeUsage = summarizeUsage;
exports.getAiUsageSummary = getAiUsageSummary;
exports.inicioDelMes = inicioDelMes;
const firestore_1 = require("firebase-admin/firestore");
const usage_1 = require("./usage");
/**
 * Resumen de consumo de IA (Paso 1.5 de `docs/hoja-de-ruta-ia.md`).
 *
 * Existe para contestar la pregunta exacta del criterio del paso: «cuánto gastó
 * este conjunto este mes», mirando datos y no estimando.
 *
 * La agregación se hace en memoria sobre las filas del período, **con tope y
 * avisando cuando se corta**. Un resumen truncado que no dice que está truncado
 * es peor que no tener resumen: se lee como el total.
 */
/** Tope de filas por consulta. Al superarlo, el resumen se marca truncado. */
exports.MAX_ROWS = 5000;
function bucketVacio() {
    return { llamadas: 0, fallos: 0, inputTokens: 0, outputTokens: 0, costoUsd: 0, latenciaMediaMs: 0, latenciaTotal: 0 };
}
function acumular(bucket, row) {
    bucket.llamadas += 1;
    if (row.outcome !== "ok")
        bucket.fallos += 1;
    bucket.inputTokens += row.inputTokens;
    bucket.outputTokens += row.outputTokens;
    bucket.costoUsd += row.estimatedCostUsd;
    bucket.latenciaTotal += row.latencyMs;
}
function cerrar(bucket) {
    const { latenciaTotal, ...resto } = bucket;
    return {
        ...resto,
        // Redondeo a seis decimales por lo mismo que en el cálculo del costo: una
        // llamada cuesta millonésimas y redondear a centavos las volvería cero.
        costoUsd: Math.round(resto.costoUsd * 1_000_000) / 1_000_000,
        latenciaMediaMs: resto.llamadas > 0 ? Math.round(latenciaTotal / resto.llamadas) : 0,
    };
}
/** Función pura: se prueba sin Firestore. */
function summarizeUsage(rows, truncado = false) {
    const total = bucketVacio();
    const porConjunto = new Map();
    const porOperacion = new Map();
    const fallos = new Map();
    for (const row of rows) {
        acumular(total, row);
        const conjunto = porConjunto.get(row.tenantId) ?? bucketVacio();
        acumular(conjunto, row);
        porConjunto.set(row.tenantId, conjunto);
        const operacion = porOperacion.get(row.operationKey) ?? bucketVacio();
        acumular(operacion, row);
        porOperacion.set(row.operationKey, operacion);
        if (row.outcome !== "ok")
            fallos.set(row.outcome, (fallos.get(row.outcome) ?? 0) + 1);
    }
    return {
        total: cerrar(total),
        // De mayor a menor gasto: la pregunta que se hace uno al abrir esto es
        // quién está consumiendo, no quién va primero por orden alfabético.
        porConjunto: [...porConjunto.entries()]
            .map(([tenantId, bucket]) => ({ tenantId, ...cerrar(bucket) }))
            .sort((a, b) => b.costoUsd - a.costoUsd || b.llamadas - a.llamadas),
        porOperacion: [...porOperacion.entries()]
            .map(([operationKey, bucket]) => ({ operationKey, ...cerrar(bucket) }))
            .sort((a, b) => b.costoUsd - a.costoUsd || b.llamadas - a.llamadas),
        fallosPorMotivo: [...fallos.entries()]
            .map(([outcome, veces]) => ({ outcome, veces }))
            .sort((a, b) => b.veces - a.veces),
        filas: rows.length,
        truncado,
        priceTableVersion: usage_1.PRICE_TABLE_VERSION,
    };
}
function numero(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function texto(value, fallback) {
    return typeof value === "string" && value.length > 0 ? value : fallback;
}
/** Lee el período y devuelve el resumen. `to` exclusivo. */
async function getAiUsageSummary(from, to) {
    const snap = await (0, firestore_1.getFirestore)()
        .collection(usage_1.AI_USAGE_COLLECTION)
        .where("createdAt", ">=", firestore_1.Timestamp.fromDate(from))
        .where("createdAt", "<", firestore_1.Timestamp.fromDate(to))
        .limit(exports.MAX_ROWS + 1)
        .get();
    const truncado = snap.size > exports.MAX_ROWS;
    const docs = truncado ? snap.docs.slice(0, exports.MAX_ROWS) : snap.docs;
    const rows = docs.map((doc) => {
        const d = doc.data();
        return {
            tenantId: texto(d.tenantId, "desconocido"),
            operationKey: texto(d.operationKey, "desconocida"),
            model: texto(d.model, "desconocido"),
            outcome: texto(d.outcome, "desconocido"),
            inputTokens: numero(d.inputTokens),
            outputTokens: numero(d.outputTokens),
            estimatedCostUsd: numero(d.estimatedCostUsd),
            latencyMs: numero(d.latencyMs),
        };
    });
    return summarizeUsage(rows, truncado);
}
/** Primer día del mes en curso, en UTC. El default de la consola. */
function inicioDelMes(now = new Date()) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}
