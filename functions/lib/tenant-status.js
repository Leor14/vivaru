"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WRITABLE_TENANT_STATUSES = void 0;
exports.assertTenantContratado = assertTenantContratado;
exports.assertTenantOperable = assertTenantOperable;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/**
 * Estados de tenant que permiten ESCRITURA. `suspended` (cliente que dejó de
 * pagar) y `expired` (prueba vencida) quedan en solo lectura: conservan sus
 * datos y pueden consultarlos, pero no operar.
 *
 * Hasta ago 2026 `tenants.status` era decorativo — se mostraba y filtraba en el
 * superadmin pero no bloqueaba nada, así que el botón "suspender" no tenía
 * ningún efecto real. El superadmin nunca queda bloqueado: necesita operar
 * sobre un tenant suspendido para reactivarlo o convertirlo.
 *
 * **Espejo de `tenantOperable()` en `firestore.rules`.** Si cambias uno, cambia
 * el otro: las reglas cubren las escrituras que hace el cliente directamente, y
 * esto cubre las que pasan por callable — que van con Admin SDK y **no evalúan
 * las reglas**. Son dos puertas al mismo sitio y las dos tienen que estar
 * cerradas.
 *
 * **Por qué vive aquí y no en `index.ts`.** Estuvo suelta dentro del índice, y
 * eso la dejaba inalcanzable para `payments.ts` y `advances.ts` sin importar el
 * índice entero (import circular). Ese fue el motivo real de `CF8`: no faltaba
 * la comprobación, faltaba poder llamarla. Mismo movimiento que se hizo con
 * `callableCorsOrigins` → `http-config.ts`.
 */
exports.WRITABLE_TENANT_STATUSES = ["active", "trial"];
/**
 * ¿El conjunto tiene el módulo CONTRATADO, o lo está viendo en prueba?
 *
 * **Existe porque `assertTenantOperable` NO sirve para esto, y la diferencia es
 * justo la que costó `CF8`.** `WRITABLE_TENANT_STATUSES` incluye `trial` —un
 * conjunto en prueba opera con normalidad casi todo—, mientras que la regla
 * `previewModuleWritable` de `firestore.rules` **veta a `trial` y a `expired`**.
 * Una callable escribe con el Admin SDK y **no evalúa las reglas**, así que
 * apoyarse solo en ellas deja abierta por callable la puerta que se cerró por
 * regla. Es literalmente el defecto de `CF8`: el producto se negaba a facturarle
 * a un conjunto suspendido y le dejaba cobrar.
 *
 * `PRD-V-FLOW-001` §7.3 lo pide **sin excepción** para el prorrateo, y da el
 * motivo: es la operación que más dinero mueve del producto.
 */
async function assertTenantContratado(tenantId) {
    const snap = await (0, firestore_1.getFirestore)().collection("tenants").doc(tenantId).get();
    if (!snap.exists)
        return;
    const status = snap.data()?.status;
    if (!status || !["trial", "expired"].includes(status))
        return;
    throw new https_1.HttpsError("failed-precondition", status === "trial"
        ? "Este módulo se ve con datos de ejemplo durante la prueba. Contrata para operarlo con datos reales."
        : "El período de prueba de este conjunto terminó. Contacta a un asesor de Vivaru para reactivarlo.");
}
async function assertTenantOperable(tenantId) {
    const snap = await (0, firestore_1.getFirestore)().collection("tenants").doc(tenantId).get();
    if (!snap.exists)
        return;
    const status = snap.data()?.status;
    // Sin status explícito se asume operable (compatibilidad con datos antiguos).
    if (!status || exports.WRITABLE_TENANT_STATUSES.includes(status))
        return;
    const reason = status === "expired"
        ? "El período de prueba de este conjunto terminó. Contacta a un asesor de Vivaru para reactivarlo."
        : "Este conjunto está suspendido. Contacta a un asesor de Vivaru para reactivarlo.";
    throw new https_1.HttpsError("failed-precondition", reason);
}
