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
exports.aiInvoke = void 0;
exports.runGateway = runGateway;
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
const http_config_1 = require("../http-config");
const feature_flags_1 = require("../feature-flags");
const authorize_1 = require("./authorize");
const catalog_1 = require("./catalog");
const ejecucion_1 = require("./ejecucion");
/**
 * Punto de entrada único de las operaciones asistidas (Pasos 1.2 a 1.7 de
 * `docs/hoja-de-ruta-ia.md`).
 *
 * Una sola puerta, y todo lo asistido pasa por ella. Hoy Vivaru tiene cuarenta
 * y una callables y cada una se acuerda por su cuenta de comprobar quién llama
 * y de qué conjunto es: funciona, pero la seguridad depende de que cada una se
 * acuerde. Aquí las comprobaciones ocurren una vez, en un sitio, y se prueban.
 *
 * **Todo el camino vive en `runGateway`, no en el callable.** Hasta el Paso 1.7
 * el cobro de cuota, la llamada al proveedor y la telemetría estaban dentro de
 * `onCall`, donde ninguna prueba llega: cada pieza estaba probada y la costura
 * entre ellas no. `aiInvoke` es ahora una cáscara que traduce el resultado a
 * `HttpsError` y nada más.
 *
 * El proveedor sigue siendo simulado; falta escribir el adaptador real.
 */
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
async function runGateway(request, deps = {}) {
    const db = (0, firestore_1.getFirestore)();
    const now = deps.now ?? new Date();
    const uid = typeof request.auth?.uid === "string" ? request.auth.uid : undefined;
    const claims = request.auth?.token;
    const claimTenantId = typeof claims?.tenantId === "string" ? claims.tenantId : undefined;
    // Buscar la operación en el catálogo NO es confiar en el cliente: la clave es
    // una etiqueta para consultar una tabla estática, no una autoridad. Todo lo
    // que decide permisos —conjunto, rol— sigue saliendo de la sesión.
    const payload = (request.data ?? {});
    const operation = (0, catalog_1.findOperation)(payload.operationKey);
    // Todo lo que necesita la decisión, pedido a la vez.
    const [membershipSnap, gateway, appCheckMonitor, operationFlag] = await Promise.all([
        uid && claimTenantId
            ? db.collection("tenantUsers").doc(`${claimTenantId}_${uid}`).get()
            : Promise.resolve(null),
        (0, feature_flags_1.resolveFeatureFlag)(GATEWAY_FLAG, claimTenantId),
        (0, feature_flags_1.resolveFeatureFlag)(APP_CHECK_MONITOR_FLAG, claimTenantId),
        operation ? (0, feature_flags_1.resolveFeatureFlag)(operation.flag, claimTenantId) : Promise.resolve(null),
    ]);
    const membership = membershipSnap && membershipSnap.exists ? membershipSnap.data() : null;
    const appCheckPresent = request.app != null;
    const decision = (0, authorize_1.authorizeGatewayCall)({ appCheckPresent, uid, claims, data: request.data }, {
        membership,
        gatewayEnabled: gateway.enabled,
        appCheckMonitor: appCheckMonitor.enabled,
        operation,
        operationFlagEnabled: operationFlag?.enabled ?? false,
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
    if (!decision.ok) {
        logger.warn("ai-gateway: rechazada", { reason: decision.reason, uid });
        return { ok: false, code: decision.code, message: decision.message, reason: decision.reason };
    }
    // A partir de aquí, `tenantId` es SIEMPRE el de la sesión. Es el único que
    // toca los contadores de cuota y la telemetría — lo que mandara el cliente ya
    // provocó un rechazo mucho antes.
    const { operation: op, tenantId, uid: actorUid } = decision;
    // Hay operaciones cuya entrada NO la manda el cliente: la arma el servidor a
    // partir de un identificador. Cuando hay armador, lo que viniera en
    // `payload.input` se descarta entero — no se mezcla, porque mezclar dejaría
    // que el cliente colara justo el campo que el servidor quería decidir.
    let entradaCruda = payload.input;
    if (deps.resolveInput) {
        const resuelta = await deps.resolveInput({ tenantId, uid: actorUid });
        if (!resuelta.ok) {
            logger.warn("ai-gateway: entrada no resuelta", {
                reason: resuelta.reason,
                operationKey: op.key,
                tenantId,
            });
            return { ok: false, code: resuelta.code, message: resuelta.message, reason: resuelta.reason };
        }
        entradaCruda = resuelta.input;
    }
    // A partir de aquí la puerta ya hizo su trabajo. Todo lo que sigue —validar,
    // cobrar, ejecutar y contarlo— es idéntico venga de una sesión o de la sombra
    // de la Fase 4, y por eso vive en un módulo aparte desde entonces.
    return (0, ejecucion_1.ejecutarOperacionAutorizada)({
        operation: op,
        tenantId,
        // Una persona con sesión sí tiene tope por usuario: es lo que impide que un
        // administrador se coma solo la cuota del conjunto.
        actor: { uid: actorUid, topeDeUsuario: true },
        entradaCruda,
        now,
        provider: deps.provider,
    });
}
exports.aiInvoke = (0, https_1.onCall)({
    cors: http_config_1.callableCorsOrigins,
    // A propósito en `false`: el rechazo lo decide la bandera de modo monitor,
    // que se cambia desde Firestore. Con `true` aquí, pasar de monitor a
    // exigir requeriría desplegar — justo lo que el Paso 1.1 vino a evitar.
    enforceAppCheck: false,
}, async (request) => {
    const outcome = await runGateway({
        app: request.app,
        auth: request.auth ? { uid: request.auth.uid, token: request.auth.token } : undefined,
        data: request.data,
    });
    if (!outcome.ok)
        throw new https_1.HttpsError(outcome.code, outcome.message);
    return {
        operationKey: outcome.operationKey,
        version: outcome.version,
        output: outcome.output,
        cuotaRestante: outcome.cuotaRestante,
    };
});
