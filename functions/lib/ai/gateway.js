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
const tenant_context_1 = require("./tenant-context");
const usage_1 = require("./usage");
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
/** Cada forma de fallar en la ejecución tiene su código. */
const CODIGO_POR_FALLO = {
    proveedor_no_responde: "deadline-exceeded",
    proveedor_error: "unavailable",
    salida_ilegible: "internal",
    salida_incumple_contrato: "internal",
};
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
    // La entrada se valida DESPUÉS de autorizar, nunca antes: a quien no tiene
    // permiso no se le dice si su carga útil era válida.
    const validation = (0, catalog_1.validateOperationInput)(op, entradaCruda);
    if (!validation.ok) {
        logger.warn("ai-gateway: entrada rechazada", { reason: validation.reason, operationKey: op.key, tenantId });
        return { ok: false, code: "invalid-argument", message: validation.detail, reason: validation.reason };
    }
    // La cuota se cobra ANTES de llamar al proveedor. Cobrarla después dejaría
    // una ventana en la que dos peticiones simultáneas pasan las dos.
    const cuota = await (0, quota_1.consumeQuota)(op, tenantId, actorUid, now);
    if (!cuota.ok) {
        logger.info("ai-gateway: cuota agotada", { operationKey: op.key, tenantId, excedida: cuota.excedida });
        return { ok: false, code: "resource-exhausted", message: cuota.message, reason: cuota.excedida };
    }
    // El contexto se resuelve DESPUÉS de cobrar la cuota: a quien ya no le quedan
    // borradores no se le lee la colección de unidades. Y va en paralelo con el
    // proveedor porque no dependen el uno del otro.
    //
    // `resolverContextoConjunto` nunca lanza: si Firestore falla, devuelve «no se
    // sabe» y el borrador sale igual, preguntando como hoy.
    const [provider, contexto] = await Promise.all([
        deps.provider ? Promise.resolve(deps.provider) : (0, provider_1.resolveProvider)(op, tenantId),
        op.contextoDelConjunto ? (0, tenant_context_1.resolverContextoConjunto)(db, tenantId) : Promise.resolve({}),
    ]);
    // El `undefined` es la versión de prompt: producción usa siempre la activa del
    // catálogo. Solo la evaluación offline pasa otra.
    const resultado = await (0, execute_1.executeOperation)(op, validation.input, provider, undefined, contexto);
    // Se devuelve solo si el proveedor no llegó a responder. Si respondió y su
    // salida incumplió el contrato, los tokens se gastaron y la cuota se queda
    // consumida — devolverla sería mentir sobre el costo.
    if (!resultado.ok && (resultado.reason === "proveedor_error" || resultado.reason === "proveedor_no_responde")) {
        await (0, quota_1.refundQuota)(op, tenantId, actorUid, now);
    }
    // Se registra pase lo que pase. Un fallo ya consumió tokens, y la tasa de
    // fallo es la métrica que dice si esto sirve. Nunca lanza: si la telemetría
    // no se puede escribir, el administrador se queda igual con su borrador.
    await (0, usage_1.recordAiUsage)({
        tenantId,
        uid: actorUid,
        operationKey: op.key,
        operationVersion: op.version,
        provider: provider.name,
        model: resultado.ok ? resultado.usage.model : provider.name,
        promptVersion: resultado.ok ? resultado.usage.promptVersion : "n/a",
        inputTokens: resultado.ok ? resultado.usage.inputTokens : 0,
        outputTokens: resultado.ok ? resultado.usage.outputTokens : 0,
        latencyMs: resultado.latencyMs,
        outcome: resultado.ok ? "ok" : resultado.reason,
        // Qué corrigió la revisión de contrato, si corrigió algo. Va en la fila de
        // uso y no en un log porque **es una cifra que hay que contar**: cuántas
        // veces el borrador afirmó una acción es lo que dirá en la Fase 4 si la
        // comprobación sigue haciendo falta, y los logs no se cuentan.
        //
        // Va la CATEGORÍA y nunca `frasesMarcadas`: el trozo de borrador es texto
        // del conjunto, y lo que protege a esta colección es no tener un solo campo
        // libre donde pueda entrar. Esa frase va a la pantalla, no a la fila.
        ...(resultado.ok && resultado.marcas?.length ? { marcasDeRevision: resultado.marcas } : {}),
    });
    if (!resultado.ok) {
        logger.warn("ai-gateway: operación fallida", {
            operationKey: op.key,
            tenantId,
            reason: resultado.reason,
            detail: resultado.detail,
        });
        return {
            ok: false,
            code: CODIGO_POR_FALLO[resultado.reason],
            message: resultado.message,
            reason: resultado.reason,
        };
    }
    logger.info("ai-gateway: operación ejecutada", {
        operationKey: op.key,
        version: op.version,
        tenantId,
        latencyMs: resultado.latencyMs,
        usage: resultado.usage,
    });
    return {
        ok: true,
        operationKey: op.key,
        version: op.version,
        output: resultado.output,
        // Es lo que necesita la pantalla del Paso 2 para deshabilitar el botón
        // antes de que alguien choque contra el tope, en vez de después.
        cuotaRestante: cuota.restante,
        frasesMarcadas: resultado.frasesMarcadas ?? [],
    };
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
