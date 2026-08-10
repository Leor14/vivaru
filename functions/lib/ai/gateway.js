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
const execute_1 = require("./execute");
const provider_1 = require("./provider");
const quota_1 = require("./quota");
const usage_1 = require("./usage");
/**
 * Punto de entrada único de las operaciones asistidas (Paso 1.2 de
 * `docs/hoja-de-ruta-ia.md`, ampliado con el catálogo en el 1.3).
 *
 * Una sola puerta, y todo lo asistido pasa por ella. Hoy Vivaru tiene cuarenta
 * y una callables y cada una se acuerda por su cuenta de comprobar quién llama
 * y de qué conjunto es: funciona, pero la seguridad depende de que cada una se
 * acuerde. Aquí las comprobaciones ocurren una vez, en un sitio, y se prueban.
 *
 * **El proveedor es simulado todavía** (`stubAiProvider`): la llamada real a
 * Vertex AI espera la región y el tope de gasto, que son decisiones del Paso 0.
 * Lo que sí es real y definitivo es el validador de salida — ver `execute.ts`.
 */
/** Cada forma de fallar tiene su código; las cuatro llevan al camino manual. */
const CODIGO_POR_FALLO = {
    proveedor_no_responde: "deadline-exceeded",
    proveedor_error: "unavailable",
    salida_ilegible: "internal",
    salida_incumple_contrato: "internal",
};
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
    if (!decision.ok)
        return { decision };
    // La entrada se valida DESPUÉS de autorizar, nunca antes: a quien no tiene
    // permiso no se le dice si su carga útil era válida.
    return { decision, validation: (0, catalog_1.validateOperationInput)(decision.operation, payload.input) };
}
exports.aiInvoke = (0, https_1.onCall)({
    cors: http_config_1.callableCorsOrigins,
    // A propósito en `false`: el rechazo lo decide la bandera de modo monitor,
    // que se cambia desde Firestore. Con `true` aquí, pasar de monitor a
    // exigir requeriría desplegar — justo lo que el Paso 1.1 vino a evitar.
    enforceAppCheck: false,
}, async (request) => {
    const { decision, validation } = await runGateway({
        app: request.app,
        auth: request.auth ? { uid: request.auth.uid, token: request.auth.token } : undefined,
        data: request.data,
    });
    if (!decision.ok) {
        logger.warn("ai-gateway: rechazada", { reason: decision.reason, uid: request.auth?.uid });
        throw new https_1.HttpsError(decision.code, decision.message);
    }
    if (!validation || !validation.ok) {
        logger.warn("ai-gateway: entrada rechazada", {
            reason: validation?.reason ?? "sin_validacion",
            operationKey: decision.operation.key,
            tenantId: decision.tenantId,
        });
        throw new https_1.HttpsError("invalid-argument", validation?.detail ?? "La información enviada no es válida.");
    }
    const operation = decision.operation;
    // La cuota se cobra ANTES de llamar al proveedor. Cobrarla después dejaría
    // una ventana en la que dos peticiones simultáneas pasan las dos.
    const cuota = await (0, quota_1.consumeQuota)(operation, decision.tenantId, decision.uid);
    if (!cuota.ok) {
        logger.info("ai-gateway: cuota agotada", {
            operationKey: operation.key,
            tenantId: decision.tenantId,
            excedida: cuota.excedida,
        });
        throw new https_1.HttpsError("resource-exhausted", cuota.message);
    }
    const provider = (0, provider_1.resolveProvider)(operation);
    const resultado = await (0, execute_1.executeOperation)(operation, validation.input, provider);
    // Se devuelve solo si el proveedor no llegó a responder. Si respondió y su
    // salida incumplió el contrato, los tokens se gastaron y la cuota se queda
    // consumida — devolverla sería mentir sobre el costo.
    if (!resultado.ok && (resultado.reason === "proveedor_error" || resultado.reason === "proveedor_no_responde")) {
        await (0, quota_1.refundQuota)(operation, decision.tenantId, decision.uid);
    }
    // Se registra pase lo que pase. Un fallo ya consumió tokens, y la tasa de
    // fallo es la métrica que dice si esto sirve. Nunca lanza: si la telemetría
    // no se puede escribir, el administrador se queda igual con su borrador.
    await (0, usage_1.recordAiUsage)({
        tenantId: decision.tenantId,
        uid: decision.uid,
        operationKey: operation.key,
        operationVersion: operation.version,
        provider: provider.name,
        model: resultado.ok ? resultado.usage.model : provider.name,
        promptVersion: resultado.ok ? resultado.usage.promptVersion : "n/a",
        inputTokens: resultado.ok ? resultado.usage.inputTokens : 0,
        outputTokens: resultado.ok ? resultado.usage.outputTokens : 0,
        latencyMs: resultado.latencyMs,
        outcome: resultado.ok ? "ok" : resultado.reason,
    });
    if (!resultado.ok) {
        logger.warn("ai-gateway: operación fallida", {
            operationKey: operation.key,
            tenantId: decision.tenantId,
            reason: resultado.reason,
            detail: resultado.detail,
        });
    }
    if (!resultado.ok) {
        throw new https_1.HttpsError(CODIGO_POR_FALLO[resultado.reason], resultado.message);
    }
    return {
        operationKey: operation.key,
        version: operation.version,
        output: resultado.output,
        // Lo que le queda al conjunto y al usuario. Es lo que necesita la
        // pantalla del Paso 2 para deshabilitar el botón antes de que alguien
        // choque contra el tope, en vez de después.
        cuotaRestante: cuota.restante,
    };
});
