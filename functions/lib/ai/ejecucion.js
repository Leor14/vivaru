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
exports.ejecutarOperacionAutorizada = ejecutarOperacionAutorizada;
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const catalog_1 = require("./catalog");
const execute_1 = require("./execute");
const provider_1 = require("./provider");
const quota_1 = require("./quota");
const tenant_context_1 = require("./tenant-context");
const usage_1 = require("./usage");
/** Cada forma de fallar en la ejecución tiene su código. */
const CODIGO_POR_FALLO = {
    proveedor_no_responde: "deadline-exceeded",
    proveedor_error: "unavailable",
    salida_ilegible: "internal",
    salida_incumple_contrato: "internal",
};
async function ejecutarOperacionAutorizada(params) {
    const { operation: op, tenantId, actor, entradaCruda, now } = params;
    const opcionesCuota = { topeDeUsuario: actor.topeDeUsuario };
    // La entrada se valida DESPUÉS de autorizar, nunca antes: a quien no tiene
    // permiso no se le dice si su carga útil era válida.
    const validation = (0, catalog_1.validateOperationInput)(op, entradaCruda);
    if (!validation.ok) {
        logger.warn("ai-ejecucion: entrada rechazada", { reason: validation.reason, operationKey: op.key, tenantId });
        return { ok: false, code: "invalid-argument", message: validation.detail, reason: validation.reason };
    }
    // La cuota se cobra ANTES de llamar al proveedor. Cobrarla después dejaría
    // una ventana en la que dos peticiones simultáneas pasan las dos.
    const cuota = await (0, quota_1.consumeQuota)(op, tenantId, actor.uid, now, (0, firestore_1.getFirestore)(), opcionesCuota);
    if (!cuota.ok) {
        logger.info("ai-ejecucion: cuota agotada", { operationKey: op.key, tenantId, excedida: cuota.excedida });
        return { ok: false, code: "resource-exhausted", message: cuota.message, reason: cuota.excedida };
    }
    // El contexto se resuelve DESPUÉS de cobrar la cuota: a quien ya no le quedan
    // borradores no se le lee la colección de unidades. Y va en paralelo con el
    // proveedor porque no dependen el uno del otro.
    //
    // `resolverContextoConjunto` nunca lanza: si Firestore falla, devuelve «no se
    // sabe» y el borrador sale igual, preguntando como hoy.
    const [provider, contexto] = await Promise.all([
        params.provider ? Promise.resolve(params.provider) : (0, provider_1.resolveProvider)(op, tenantId),
        op.contextoDelConjunto ? (0, tenant_context_1.resolverContextoConjunto)((0, firestore_1.getFirestore)(), tenantId) : Promise.resolve({}),
    ]);
    // El `undefined` es la versión de prompt: producción usa siempre la activa del
    // catálogo. Solo la evaluación offline pasa otra.
    const resultado = await (0, execute_1.executeOperation)(op, validation.input, provider, undefined, contexto);
    // Se devuelve solo si el proveedor no llegó a responder. Si respondió y su
    // salida incumplió el contrato, los tokens se gastaron y la cuota se queda
    // consumida — devolverla sería mentir sobre el costo.
    if (!resultado.ok && (resultado.reason === "proveedor_error" || resultado.reason === "proveedor_no_responde")) {
        await (0, quota_1.refundQuota)(op, tenantId, actor.uid, now, (0, firestore_1.getFirestore)(), opcionesCuota);
    }
    // Se registra pase lo que pase. Un fallo ya consumió tokens, y la tasa de
    // fallo es la métrica que dice si esto sirve. Nunca lanza: si la telemetría
    // no se puede escribir, el administrador se queda igual con su borrador.
    await (0, usage_1.recordAiUsage)({
        tenantId,
        // Para la sombra es `ACTOR_SOMBRA`, y ese es todo el mecanismo que separa su
        // gasto del de los administradores al contar la factura. No hace falta un
        // campo nuevo: la columna que ya existe distingue las dos cosas.
        uid: actor.uid,
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
        logger.warn("ai-ejecucion: operación fallida", {
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
    logger.info("ai-ejecucion: operación ejecutada", {
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
        proveedor: provider.name,
        // Es lo que necesita la pantalla del Paso 2 para deshabilitar el botón
        // antes de que alguien choque contra el tope, en vez de después.
        cuotaRestante: cuota.restante,
        frasesMarcadas: resultado.frasesMarcadas ?? [],
    };
}
