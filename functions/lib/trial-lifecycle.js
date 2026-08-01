"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTO_PURGE_ENABLED = exports.PURGE_WARNING_DAYS = exports.RETENTION_DAYS_AFTER_EXPIRY = void 0;
exports.runTrialLifecycle = runTrialLifecycle;
exports.purgeTenant = purgeTenant;
const firestore_1 = require("firebase-admin/firestore");
const email_1 = require("./email");
/**
 * Ciclo de vida del ambiente de prueba (Fase 4 del self-service).
 *
 * Hasta ahora nada expiraba solo: un trial se quedaba en `trial` para siempre
 * hasta que alguien lo cambiara a mano en la consola. Este módulo lo automatiza.
 *
 * Regla C del plan — **el día 16 no se borra nada**: el ambiente pasa a solo
 * lectura y conserva todo. Los datos que el prospecto configuró son el mejor
 * argumento de venta que existe ("tu conjunto ya está cargado, solo falta
 * activarlo"); destruirlos en el momento de mayor intención sería tirar el
 * activo comercial a la basura.
 */
exports.RETENTION_DAYS_AFTER_EXPIRY = 60;
exports.PURGE_WARNING_DAYS = 52; // avisar ~una semana antes de purgar
/**
 * Interruptor de la purga automática.
 *
 * Se deja en `false` a propósito: borrar datos de un cliente potencial es
 * IRREVERSIBLE y no debe activarse por defecto solo porque un plan lo diga.
 * Mientras esté apagado el cron reporta en logs qué purgaría, para poder
 * revisar el criterio con datos reales antes de encenderlo.
 */
exports.AUTO_PURGE_ENABLED = false;
/** Días en que se avisa al prospecto antes de que venza. */
const REMINDER_DAYS = [7, 3, 1];
const COMMERCIAL_INBOX = "comercial@qintilab.com";
const DEV_INBOX = "dev@qintilab.com";
function isProductionProject() {
    return (process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? "") === "hogaru-1";
}
function notifyInbox() {
    return isProductionProject() ? COMMERCIAL_INBOX : DEV_INBOX;
}
function envTag() {
    return isProductionProject() ? "" : "[STAGING] ";
}
/** Días enteros que faltan (negativo si ya pasó). */
function daysUntil(iso) {
    const end = new Date(iso).getTime();
    if (Number.isNaN(end))
        return null;
    return Math.ceil((end - Date.now()) / 86_400_000);
}
/**
 * Recorre los ambientes de prueba y aplica el ciclo de vida. Cada acción es
 * best-effort e independiente: un fallo de correo no impide que un ambiente
 * expire, y un fallo en un tenant no detiene a los demás.
 */
async function runTrialLifecycle() {
    const db = (0, firestore_1.getFirestore)();
    const report = {
        revisados: 0,
        avisados: 0,
        expirados: 0,
        purgados: 0,
        purgaPendiente: [],
    };
    // Igualdad simple para no exigir índice compuesto; el resto se filtra en código.
    const trials = await db.collection("tenants").where("status", "==", "trial").get();
    for (const docSnap of trials.docs) {
        const data = docSnap.data();
        if (!data.trialEndsAt)
            continue;
        report.revisados += 1;
        const left = daysUntil(data.trialEndsAt);
        if (left === null)
            continue;
        // ── Venció: pasa a solo lectura, sin borrar nada ────────────────────────
        if (left < 0) {
            await docSnap.ref.set({ status: "expired", expiredAt: new Date().toISOString(), updatedAt: firestore_1.Timestamp.now() }, { merge: true });
            report.expirados += 1;
            await notify(docSnap.id, data.name ?? docSnap.id, `${envTag()}[Trial vencido] ${data.name ?? docSnap.id}`, [
                `El ambiente de prueba de ${data.name ?? docSnap.id} venció.`,
                "",
                "Queda en solo lectura y conserva todo lo que configuró.",
                "Convertirlo a cliente desde la consola lo reactiva tal cual.",
            ].join("\n"));
            continue;
        }
        // ── Recordatorio en los hitos definidos ─────────────────────────────────
        if (REMINDER_DAYS.includes(left)) {
            const enviados = docSnap.data().remindersSent ?? [];
            if (enviados.includes(left))
                continue;
            await notify(docSnap.id, data.name ?? docSnap.id, `${envTag()}[Trial · ${left} día${left === 1 ? "" : "s"}] ${data.name ?? docSnap.id}`, [
                `A ${data.name ?? docSnap.id} le queda${left === 1 ? "" : "n"} ${left} día${left === 1 ? "" : "s"} de prueba.`,
                "",
                left <= 3
                    ? "Es el momento de llamar: si no convierte, el ambiente pasa a solo lectura."
                    : "Buen momento para hacer seguimiento.",
            ].join("\n"));
            await docSnap.ref.set({ remindersSent: [...enviados, left] }, { merge: true });
            report.avisados += 1;
        }
    }
    // ── Vencidos: aviso de purga y (si está habilitada) purga ────────────────
    const expired = await db.collection("tenants").where("status", "==", "expired").get();
    for (const docSnap of expired.docs) {
        const data = docSnap.data();
        if (!data.expiredAt)
            continue;
        const sinceExpiry = -(daysUntil(data.expiredAt) ?? 0);
        if (sinceExpiry >= exports.RETENTION_DAYS_AFTER_EXPIRY) {
            if (!exports.AUTO_PURGE_ENABLED) {
                // Se reporta pero NO se borra: ver comentario de AUTO_PURGE_ENABLED.
                report.purgaPendiente.push(docSnap.id);
                continue;
            }
            await purgeTenant(docSnap.id);
            report.purgados += 1;
            continue;
        }
        if (sinceExpiry === exports.PURGE_WARNING_DAYS) {
            await notify(docSnap.id, data.name ?? docSnap.id, `${envTag()}[Trial · purga próxima] ${data.name ?? docSnap.id}`, `El ambiente vencido de ${data.name ?? docSnap.id} cumple ${exports.RETENTION_DAYS_AFTER_EXPIRY} días. Si no se convierte, sus datos se eliminarán.`);
        }
    }
    return report;
    async function notify(tenantId, tenantName, subject, body) {
        try {
            await (0, email_1.sendNotificationEmail)({
                to: notifyInbox(),
                subject,
                body,
                link: "/superadmin/tenants",
            });
        }
        catch (error) {
            console.error("[trial-lifecycle] aviso falló", { tenantId, tenantName, error });
        }
    }
}
/** Colecciones que se borran al purgar un ambiente vencido. */
const PURGEABLE_COLLECTIONS = [
    "units", "people", "amenities", "communications", "billingStatements",
    "billingCampaigns", "billingSchedules", "billingReminderJobs", "packages",
    "visitors", "visitorPasses", "tickets", "reservations", "paymentReceipts",
    "surveys", "survey_responses", "expenses", "ledgerEntries", "bankAccounts",
    "bankStatementLines", "documents", "tenantUsers",
];
/** Elimina por completo un ambiente. Irreversible. */
async function purgeTenant(tenantId) {
    const db = (0, firestore_1.getFirestore)();
    let deleted = 0;
    for (const collection of PURGEABLE_COLLECTIONS) {
        const snap = await db.collection(collection).where("tenantId", "==", tenantId).get();
        for (const doc of snap.docs) {
            await doc.ref.delete();
            deleted += 1;
        }
    }
    await db.collection("tenantDemoAccounts").doc(tenantId).delete().catch(() => undefined);
    await db.collection("tenantSettings").doc(tenantId).delete().catch(() => undefined);
    await db.collection("tenants").doc(tenantId).delete().catch(() => undefined);
    console.log(`[trial-lifecycle] purgado ${tenantId}: ${deleted} documentos`);
    return deleted;
}
