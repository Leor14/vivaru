"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_FLAG_DEFAULTS = exports.GLOBAL_FLAG_DOC_ID = exports.FEATURE_FLAG_OVERRIDES_COLLECTION = exports.FEATURE_FLAGS_COLLECTION = void 0;
exports.resolveFeatureFlag = resolveFeatureFlag;
exports.isFeatureEnabled = isFeatureEnabled;
exports.assertFeatureEnabled = assertFeatureEnabled;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
/**
 * Banderas de funcionalidad en el servidor — **la capa que protege de verdad**.
 *
 * Mecanismo genérico de plataforma: vale para cualquier capacidad que tenga que
 * poder apagarse sin desplegar, no solo para las de IA. El programa de IA es su
 * primer cliente (Paso 1.1 de `docs/hoja-de-ruta-ia.md`), no su dueño.
 *
 * El gate del cliente (`src/lib/feature-flags/provider.tsx`) oculta la interfaz;
 * esto es lo que impide que se ejecute la operación. Misma lección que el gate
 * de módulos del trial: lo que se ve se salta escribiendo la URL o llamando la
 * callable directo.
 *
 * ESPEJO de `src/lib/feature-flags/catalog.ts` y `resolve.ts`. `src/` no puede
 * importar de `functions/` (rompe el build de App Hosting, ver CLAUDE.md), así
 * que el catálogo y la precedencia viven duplicados a propósito. Si cambias
 * uno, cambia el otro.
 */
exports.FEATURE_FLAGS_COLLECTION = "featureFlags";
exports.FEATURE_FLAG_OVERRIDES_COLLECTION = "featureFlagOverrides";
exports.GLOBAL_FLAG_DOC_ID = "_global";
/**
 * Valor sin documento en Firestore. La regla: capacidad nueva nace en `false`;
 * bandera puesta sobre una capacidad que ya está viva nace en `true`, porque si
 * no, añadir la bandera sería apagar la función para todos.
 */
exports.FEATURE_FLAG_DEFAULTS = {
    "ai-gateway": false,
    "ai-communications-draft": false,
    "ai-pqrs-shadow": false,
    "ai-pqrs-suggestions": false,
    "ai-onboarding-column-mapping": false,
    "ai-receipts-extraction": false,
};
/** Solo booleanos de verdad: un `"true"` escrito a mano no enciende nada. */
function asStrictBoolean(value) {
    return typeof value === "boolean" ? value : undefined;
}
/**
 * Precedencia, de arriba hacia abajo:
 *
 * 1. `_global.killSwitch` — apaga todo.
 * 2. `killSwitch` de la bandera — apaga esa capacidad en todos los conjuntos.
 * 3. Override del conjunto.
 * 4. `enabled` global de la bandera.
 * 5. Default del catálogo (apagado).
 *
 * Los kill switches van ARRIBA de los overrides y esa es su razón de ser: si
 * `enabled: false` bastara, una capacidad encendida a mano en cinco conjuntos
 * seguiría encendida justo cuando hay que apagarla.
 *
 * **Sin caché, a propósito.** Un TTL de treinta segundos convierte «apagado
 * inmediato» en «apagado casi siempre», y una instancia caliente puede vivir
 * minutos. La lectura extra son dos o tres documentos frente a una llamada a un
 * modelo que cuesta dinero y tarda segundos: no es donde está el costo.
 */
async function resolveFeatureFlag(key, tenantId) {
    const db = (0, firestore_1.getFirestore)();
    const refs = [
        db.collection(exports.FEATURE_FLAGS_COLLECTION).doc(exports.GLOBAL_FLAG_DOC_ID),
        db.collection(exports.FEATURE_FLAGS_COLLECTION).doc(key),
    ];
    if (tenantId)
        refs.push(db.collection(exports.FEATURE_FLAG_OVERRIDES_COLLECTION).doc(tenantId));
    let snaps;
    try {
        snaps = await db.getAll(...refs);
    }
    catch {
        // Falla cerrado: si no se sabe si está encendida, está apagada. El flujo
        // manual sigue funcionando — fallback determinista.
        return { enabled: false, source: "error_de_lectura" };
    }
    const globalData = snaps[0]?.data();
    if (asStrictBoolean(globalData?.killSwitch) === true) {
        return { enabled: false, source: "kill_switch_maestro" };
    }
    const flagData = snaps[1]?.data();
    if (asStrictBoolean(flagData?.killSwitch) === true) {
        return { enabled: false, source: "kill_switch_bandera" };
    }
    const overridesData = snaps[2]?.data();
    const flags = overridesData?.flags;
    if (flags && typeof flags === "object" && !Array.isArray(flags)) {
        const override = asStrictBoolean(flags[key]);
        if (override !== undefined)
            return { enabled: override, source: "override_conjunto" };
    }
    const global = asStrictBoolean(flagData?.enabled);
    if (global !== undefined)
        return { enabled: global, source: "valor_global" };
    return { enabled: exports.FEATURE_FLAG_DEFAULTS[key], source: "default_catalogo" };
}
async function isFeatureEnabled(key, tenantId) {
    return (await resolveFeatureFlag(key, tenantId)).enabled;
}
/**
 * Lanza si la capacidad está apagada para este conjunto.
 *
 * `failed-precondition` y no `permission-denied`: no es que al usuario le falte
 * un permiso, es que la capacidad no está disponible. Por eso el mensaje por
 * defecto apunta al camino manual — cada llamador puede dar el suyo, más
 * concreto, con `message`.
 */
async function assertFeatureEnabled(key, tenantId, message) {
    if (await isFeatureEnabled(key, tenantId))
        return;
    throw new https_1.HttpsError("failed-precondition", message ?? "Esta función no está disponible en este momento. Puedes continuar con el proceso manual.");
}
