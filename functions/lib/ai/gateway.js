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
exports.aiInvoke = exports.KNOWN_OPERATIONS = void 0;
exports.runGateway = runGateway;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const http_config_1 = require("../http-config");
const feature_flags_1 = require("../feature-flags");
const authorize_1 = require("./authorize");
/**
 * Punto de entrada único de las operaciones asistidas (Paso 1.2 de
 * `docs/hoja-de-ruta-ia.md`).
 *
 * Una sola puerta, y todo lo asistido pasa por ella. Hoy Vivaru tiene cuarenta
 * y una callables y cada una se acuerda por su cuenta de comprobar quién llama
 * y de qué conjunto es: funciona, pero la seguridad depende de que cada una se
 * acuerde. Aquí las comprobaciones ocurren una vez, en un sitio, y se prueban.
 *
 * **Todavía no llama a ningún modelo.** Al terminar el paso hay una puerta que
 * abre y rechaza bien, sin nada detrás. Lo de detrás es el Paso 1.3.
 */
/**
 * Operaciones que existen. Vacío hasta el Paso 1.3, que trae el catálogo con su
 * versión, esquemas, permisos y límites. Mientras esté vacío la puerta abre y
 * responde `unimplemented`, que es la verdad.
 */
exports.KNOWN_OPERATIONS = new Set();
/** Bandera que apaga la puerta entera sin desplegar. */
const GATEWAY_FLAG = "ai-gateway";
/**
 * Bandera de modo monitor de App Check. Encendida (el default), una llamada sin
 * token de App Check pasa y queda registrada; apagada, se rechaza.
 *
 * Está en positivo —«modo monitor encendido»— y no en negativo —«exigir App
 * Check»— por el kill switch: el maestro apaga todas las banderas, y si la
 * bandera dijera «exigir», apagarlo todo relajaría una comprobación de
 * seguridad. Así, apagarlo todo la endurece.
 */
const APP_CHECK_MONITOR_FLAG = "operacion-app-check-monitor";
async function runGateway(request) {
    const db = (0, firestore_1.getFirestore)();
    const uid = typeof request.auth?.uid === "string" ? request.auth.uid : undefined;
    const claims = request.auth?.token;
    const claimTenantId = typeof claims?.tenantId === "string" ? claims.tenantId : undefined;
    // Todo lo que necesita la decisión, pedido a la vez. El conjunto para leer la
    // membresía y los overrides sale de los claims, nunca de `request.data`.
    const [membershipSnap, gateway, appCheckMonitor] = await Promise.all([
        uid && claimTenantId
            ? db.collection("tenantUsers").doc(`${claimTenantId}_${uid}`).get()
            : Promise.resolve(null),
        (0, feature_flags_1.resolveFeatureFlag)(GATEWAY_FLAG, claimTenantId),
        (0, feature_flags_1.resolveFeatureFlag)(APP_CHECK_MONITOR_FLAG, claimTenantId),
    ]);
    const membership = membershipSnap && membershipSnap.exists ? membershipSnap.data() : null;
    const appCheckPresent = request.app != null;
    const decision = (0, authorize_1.authorizeGatewayCall)({ appCheckPresent, uid, claims, data: request.data }, {
        membership,
        gatewayEnabled: gateway.enabled,
        appCheckMonitor: appCheckMonitor.enabled,
        knownOperations: exports.KNOWN_OPERATIONS,
    });
    // Modo monitor: la llamada pasa, pero queda el rastro. Es lo que hay que
    // mirar antes de apagar el modo monitor — si el tráfico legítimo no trae
    // token, exigirlo cierra la puerta para todos.
    if (!appCheckPresent && appCheckMonitor.enabled) {
        logger.info("ai-gateway: llamada sin App Check (modo monitor)", {
            uid,
            tenantId: claimTenantId,
            permitida: decision.ok,
        });
    }
    return { decision };
}
exports.aiInvoke = (0, https_1.onCall)({
    cors: http_config_1.callableCorsOrigins,
    // A propósito en `false`: el rechazo lo decide la bandera de modo monitor,
    // que se cambia desde Firestore. Con `true` aquí, pasar de monitor a
    // exigir requeriría desplegar — justo lo que el Paso 1.1 vino a evitar.
    enforceAppCheck: false,
}, async (request) => {
    const { decision } = await runGateway({
        app: request.app,
        auth: request.auth ? { uid: request.auth.uid, token: request.auth.token } : undefined,
        data: request.data,
    });
    if (!decision.ok) {
        logger.warn("ai-gateway: rechazada", { reason: decision.reason, uid: request.auth?.uid });
        throw new https_1.HttpsError(decision.code, decision.message);
    }
    // Inalcanzable mientras KNOWN_OPERATIONS esté vacío. El Paso 1.3 pone aquí
    // la búsqueda en el catálogo y la validación de entrada.
    throw new https_1.HttpsError("unimplemented", "Esa operación no existe.");
});
