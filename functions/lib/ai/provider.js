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
exports.stubAiProvider = void 0;
exports.fakeAiProvider = fakeAiProvider;
exports.resolveProvider = resolveProvider;
const feature_flags_1 = require("../feature-flags");
/**
 * Respuesta simulada por operación. Es válida contra el esquema del catálogo a
 * propósito: el camino feliz tiene que poder recorrerse entero antes de que
 * exista el proveedor real.
 *
 * Se nota que es simulada al leerla, y eso también es a propósito: si algún día
 * aparece en una pantalla, tiene que ser evidente que no la escribió un modelo.
 */
function respuestaSimulada(request) {
    if (request.operationKey === "comunicaciones-redactar") {
        const input = request.input;
        const hechos = Array.isArray(input?.hechos) ? input.hechos : [];
        return JSON.stringify({
            title: "[SIMULADO] Borrador de comunicación",
            body: `[SIMULADO] ${input?.proposito ?? ""}\n\n${hechos.map((h) => `- ${h}`).join("\n")}`,
            notificationSummary: "[SIMULADO] Resumen para notificación",
            missingInformation: [],
            qualityFlags: ["respuesta_simulada"],
            // Vacío siempre: la regla dura de la PRD. Un simulador que la incumpliera
            // enseñaría a ignorar el validador.
            assumptions: [],
        });
    }
    return JSON.stringify({});
}
/** Proveedor simulado. Determinista: la misma entrada da la misma salida. */
exports.stubAiProvider = {
    name: "stub",
    async generate(request) {
        const text = respuestaSimulada(request);
        return {
            text,
            usage: {
                model: "stub",
                promptVersion: "stub",
                // Aproximación grosera y suficiente: nadie decide nada con esto
                // mientras el proveedor sea simulado.
                inputTokens: Math.ceil(JSON.stringify(request.input ?? "").length / 4),
                outputTokens: Math.ceil(text.length / 4),
            },
        };
    },
};
/**
 * Proveedor de pruebas: devuelve el texto que se le dé, o falla como se le pida.
 * Existe para poder provocar a voluntad las cuatro formas de salir mal.
 */
function fakeAiProvider(options) {
    return {
        name: "fake",
        async generate() {
            if (options.delayMs)
                await new Promise((resolve) => setTimeout(resolve, options.delayMs));
            if (options.throws)
                throw options.throws;
            return {
                text: options.text ?? "",
                usage: { model: "fake", promptVersion: "fake", inputTokens: 0, outputTokens: 0 },
            };
        },
    };
}
/**
 * Proveedor que se usa en tiempo de ejecución, elegido por bandera.
 *
 * `ia-proveedor-real` apagada (el default) → simulado. Encendida → Vertex AI.
 * Se gobierna desde `/superadmin/flags`, así que **volver al simulado si el
 * proveedor se cae o se desmadra el gasto no requiere desplegar** — que es para
 * lo que se construyó el mecanismo del Paso 1.1.
 *
 * Y falla al lado seguro: el kill switch maestro apaga todas las banderas, así
 * que bajarlo devuelve al simulado además de cerrar la puerta.
 *
 * El SDK se carga solo si hace falta. Importarlo arriba lo metería en el
 * arranque en frío de la función aunque la bandera esté apagada.
 */
async function resolveProvider(_operation, tenantId) {
    const real = await (0, feature_flags_1.resolveFeatureFlag)("ia-proveedor-real", tenantId);
    if (!real.enabled)
        return exports.stubAiProvider;
    const { createVertexProvider } = await Promise.resolve().then(() => __importStar(require("./provider-vertex")));
    return createVertexProvider();
}
