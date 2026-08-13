"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrarFeedbackIa = void 0;
exports.runFeedback = runFeedback;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const http_config_1 = require("../http-config");
const feature_flags_1 = require("../feature-flags");
const authorize_1 = require("./authorize");
const catalog_1 = require("./catalog");
const feedback_1 = require("./feedback");
/**
 * Registro de qué hizo la persona con el borrador (Paso 2.5).
 *
 * Vive en su propio archivo y no dentro de `gateway.ts` porque **no es la misma
 * puerta**: aquí no se invoca a ningún modelo, no se cobra cuota y no se gasta
 * un céntimo. Meterlo en el archivo que decide si se gasta dinero solo
 * conseguiría que revisar aquello fuese más caro.
 *
 * Igual que la puerta: todo el camino vive en `runFeedback`, y el callable es
 * una cáscara que traduce el resultado. Es lo que permite probar la costura
 * entera contra Firestore sin fabricar una sesión de `onCall`.
 */
const APP_CHECK_MONITOR_FLAG = "operacion-app-check-monitor";
/** La única operación que hoy produce feedback. */
const OPERACION = "comunicaciones-redactar";
async function runFeedback(request) {
    const db = (0, firestore_1.getFirestore)();
    const uid = typeof request.auth?.uid === "string" ? request.auth.uid : undefined;
    const claims = request.auth?.token;
    const claimTenantId = typeof claims?.tenantId === "string" ? claims.tenantId : undefined;
    // Los roles salen del catálogo, no escritos a mano: quien puede pedir el
    // borrador es quien puede contar qué hizo con él. Si mañana cambian ahí,
    // cambian aquí solos.
    const operacion = (0, catalog_1.findOperation)(OPERACION);
    if (!operacion) {
        return { ok: false, code: "invalid-argument", message: "Esa operación no existe.", reason: "operacion_desconocida" };
    }
    const [membershipSnap, appCheckMonitor] = await Promise.all([
        uid && claimTenantId
            ? db.collection("tenantUsers").doc(`${claimTenantId}_${uid}`).get()
            : Promise.resolve(null),
        (0, feature_flags_1.resolveFeatureFlag)(APP_CHECK_MONITOR_FLAG, claimTenantId),
    ]);
    const membership = membershipSnap && membershipSnap.exists ? membershipSnap.data() : null;
    const decision = (0, authorize_1.authorizeFeedbackCall)({ appCheckPresent: request.app != null, uid, claims, data: request.data }, { membership, appCheckMonitor: appCheckMonitor.enabled, allowedRoles: operacion.allowedRoles });
    if (!decision.ok) {
        logger.warn("ai-feedback: rechazado", { reason: decision.reason, uid });
        return {
            ok: false,
            // La puerta puede devolver códigos que aquí no aplican; se normalizan a
            // los tres que este endpoint sabe producir.
            code: decision.code === "unauthenticated"
                ? "unauthenticated"
                : decision.code === "invalid-argument"
                    ? "invalid-argument"
                    : "permission-denied",
            message: decision.message,
            reason: decision.reason,
        };
    }
    // Se valida DESPUÉS de autorizar, misma regla que la puerta: a quien no tiene
    // permiso no se le dice si su carga útil era válida.
    const parsed = feedback_1.feedbackSchema.safeParse(request.data);
    if (!parsed.success) {
        logger.warn("ai-feedback: carga inválida", {
            tenantId: decision.tenantId,
            detail: parsed.error.issues[0]?.message,
        });
        return {
            ok: false,
            code: "invalid-argument",
            message: "No pudimos registrar tu actividad.",
            reason: "feedback_invalido",
        };
    }
    await (0, feedback_1.recordAiFeedback)({ ...parsed.data, tenantId: decision.tenantId, uid: decision.uid });
    return { ok: true };
}
exports.registrarFeedbackIa = (0, https_1.onCall)({
    cors: http_config_1.callableCorsOrigins,
    // Mismo criterio que `aiInvoke`: lo decide la bandera de modo monitor, para
    // que pasar de observar a exigir no requiera desplegar.
    enforceAppCheck: false,
}, async (request) => {
    const outcome = await runFeedback({
        app: request.app,
        auth: request.auth ? { uid: request.auth.uid, token: request.auth.token } : undefined,
        data: request.data,
    });
    if (!outcome.ok)
        throw new https_1.HttpsError(outcome.code, outcome.message);
    return { ok: true };
});
