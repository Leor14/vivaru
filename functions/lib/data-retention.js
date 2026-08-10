"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_USAGE_RETENTION_MONTHS = void 0;
exports.cutoffDateISO = cutoffDateISO;
exports.anonymizeExpiredVouchers = anonymizeExpiredVouchers;
exports.aiUsageCutoff = aiUsageCutoff;
exports.purgeExpiredAiUsage = purgeExpiredAiUsage;
const firestore_1 = require("firebase-admin/firestore");
/**
 * Retención / anonimización de datos sensibles de comprobantes (F2/G4).
 *
 * Pasado el período de retención configurado por conjunto
 * (`tenantSettings.fiscalProfile.dataRetentionMonths`, default 12), se borran la
 * cédula y el nombre del condómino de los comprobantes ya emitidos, conservando
 * lo no sensible (secuencial, monto, fecha, referencia fiscal). La conservación
 * legal del documento recae en el contribuyente y en el ente fiscal, no en la
 * plataforma, por eso Vivaru puede purgar la PII que almacena.
 */
const DEFAULT_RETENTION_MONTHS = 12;
/** Fecha de corte (YYYY-MM-DD): comprobantes anteriores se anonimizan. */
function cutoffDateISO(retentionMonths, from = new Date()) {
    const d = new Date(from);
    d.setMonth(d.getMonth() - retentionMonths);
    return d.toISOString().slice(0, 10);
}
/**
 * Recorre los conjuntos, aplica el período de retención de cada uno y anonimiza
 * los comprobantes vencidos. Devuelve cuántos se anonimizaron.
 */
async function anonymizeExpiredVouchers(db, now = new Date()) {
    const settingsSnap = await db.collection("tenantSettings").get();
    let anonymizedTotal = 0;
    for (const settingsDoc of settingsSnap.docs) {
        const fiscalProfile = (settingsDoc.data().fiscalProfile ?? {});
        const months = typeof fiscalProfile.dataRetentionMonths === "number" && fiscalProfile.dataRetentionMonths > 0
            ? fiscalProfile.dataRetentionMonths
            : DEFAULT_RETENTION_MONTHS;
        const cutoff = cutoffDateISO(months, now);
        const tenantId = settingsDoc.id;
        // Consulta por igualdad de tenantId (sin índice compuesto); se filtra en código.
        const vouchersSnap = await db.collection("paymentVouchers").where("tenantId", "==", tenantId).get();
        let batch = db.batch();
        let ops = 0;
        for (const voucherDoc of vouchersSnap.docs) {
            const v = voucherDoc.data();
            const expired = (v.issueDate ?? "") < cutoff;
            const hasPII = Boolean(v.payerTaxId || v.payerName);
            const notDone = !v.anonymizedAt;
            if (expired && hasPII && notDone) {
                batch.update(voucherDoc.ref, {
                    payerTaxId: null,
                    payerName: null,
                    anonymizedAt: firestore_1.Timestamp.now(),
                });
                ops += 1;
                anonymizedTotal += 1;
                if (ops >= 400) {
                    await batch.commit();
                    batch = db.batch();
                    ops = 0;
                }
            }
        }
        if (ops > 0)
            await batch.commit();
    }
    return anonymizedTotal;
}
/**
 * Retención de la telemetría de IA: 12 meses (regla del Paso 0 del programa de
 * IA, ver docs/hoja-de-ruta-ia.md).
 *
 * `aiUsage` no guarda contenido del conjunto —solo metadatos y métricas—, así
 * que la purga no es por privacidad sino por higiene: una colección que crece
 * sin fin acaba costando más de lo que mide. Se borra, no se anonimiza: no hay
 * nada que preservar sin identificar.
 *
 * Escribir datos con una retención declarada y sin mecanismo que la cumpla es
 * la forma habitual de incumplirla.
 */
exports.AI_USAGE_RETENTION_MONTHS = 12;
/** Corte por fecha para la telemetría. Devuelve la fecha límite como Date. */
function aiUsageCutoff(now = new Date(), months = exports.AI_USAGE_RETENTION_MONTHS) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - months);
    return d;
}
/** Borra la telemetría de IA vencida. Devuelve cuántas filas se eliminaron. */
async function purgeExpiredAiUsage(db, now = new Date()) {
    const cutoff = firestore_1.Timestamp.fromDate(aiUsageCutoff(now));
    let borradas = 0;
    // Por lotes: una colección de telemetría puede tener muchas filas y un
    // borrado de golpe no cabe en una sola operación.
    for (;;) {
        const vencidas = await db
            .collection("aiUsage")
            .where("createdAt", "<", cutoff)
            .limit(400)
            .get();
        if (vencidas.empty)
            break;
        const batch = db.batch();
        for (const doc of vencidas.docs)
            batch.delete(doc.ref);
        await batch.commit();
        borradas += vencidas.size;
        if (vencidas.size < 400)
            break;
    }
    return borradas;
}
