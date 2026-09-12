"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENSAJE_TOPE_DE_PRUEBA = exports.VENTANA_DE_PRUEBA_MS = exports.MAX_OPERATIVOS_EN_PRUEBA = void 0;
exports.esAmbienteDePrueba = esAmbienteDePrueba;
exports.assertModuleAllowed = assertModuleAllowed;
exports.assertCanInviteRealPeople = assertCanInviteRealPeople;
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
/** `PRD-V-FIX-005`: ¿el conjunto está en prueba, o su prueba venció? Un estado ausente no lo es. */
function esAmbienteDePrueba(status) {
    return typeof status === "string" && RESTRICTED_STATUSES.has(status);
}
/**
 * `PRD-V-FIX-005` · R2, opción A de David (11 sep): el tope de intentos de alta de usuarios
 * operativos en una prueba. La guía propone dar de alta al portero real, y un conjunto de prueba
 * tiene uno o dos; diez intentos en los quince días de la prueba sobran para eso y no dan para
 * usar el alta de oráculo.
 */
exports.MAX_OPERATIVOS_EN_PRUEBA = 10;
exports.VENTANA_DE_PRUEBA_MS = 15 * 24 * 60 * 60 * 1000;
exports.MENSAJE_TOPE_DE_PRUEBA = "Durante la prueba puedes intentar dar de alta hasta 10 usuarios. Para seguir, habla con un asesor de Vivaru.";
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
/**
 * Bloquea la invitación de PERSONAS REALES durante la prueba (Regla B del plan).
 *
 * Tres razones: protege la reputación de `noreply@notificaciones.grupovivaru.com`
 * —el remitente de los clientes que sí pagan— de listas frías; evita meter datos
 * personales de terceros en un ambiente que expira; y no hace falta para vender,
 * porque el admin recorre los otros portales con sus cuentas de prueba.
 */
async function assertCanInviteRealPeople(tenantId) {
    const snap = await (0, firestore_1.getFirestore)().collection("tenants").doc(tenantId).get();
    if (!snap.exists)
        return;
    const status = snap.data()?.status ?? "active";
    if (!RESTRICTED_STATUSES.has(status))
        return;
    throw new https_1.HttpsError("failed-precondition", "Durante la prueba no se envían invitaciones a residentes reales. Usa tus cuentas de prueba (Configuración → Mis cuentas de prueba) para recorrer el portal del residente y el de portería.");
}
