"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertModuleAllowed = assertModuleAllowed;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/** Módulos que durante la prueba son SOLO vista previa: se ven, no se operan. */
const PREVIEW_MODULES = new Set([
    "billing",
    "finanzas",
    "reports",
    "regulations",
]);
const RESTRICTED_STATUSES = new Set(["trial", "expired"]);
/**
 * Lanza si el módulo está bajo llave para el estado actual del tenant.
 * Los clientes (`active`) nunca se bloquean.
 */
async function assertModuleAllowed(tenantId, moduleKey) {
    if (!PREVIEW_MODULES.has(moduleKey))
        return;
    const snap = await (0, firestore_1.getFirestore)().collection("tenants").doc(tenantId).get();
    if (!snap.exists)
        return;
    const status = snap.data()?.status ?? "active";
    if (!RESTRICTED_STATUSES.has(status))
        return;
    throw new https_1.HttpsError("permission-denied", "Este módulo está disponible con tu plan. Habla con un asesor de Vivaru para activarlo.");
}
