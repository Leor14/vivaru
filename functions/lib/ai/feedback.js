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
exports.feedbackSchema = exports.AI_FEEDBACK_COLLECTION = void 0;
exports.recordAiFeedback = recordAiFeedback;
const firestore_1 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
const zod_1 = require("zod");
const catalog_1 = require("./catalog");
/**
 * Qué hizo la persona con lo que le propusimos (Paso 2.5) — la medición que el
 * piloto del Paso 2.6 necesita y que hasta ahora no existía.
 *
 * `aiUsage` responde «cuánto costó». Esto responde **«sirvió»**, que es la
 * pregunta que decide si la funcionalidad sigue, se corrige o se retira. Son
 * dos colecciones y no una a propósito: la de costo la escribe el servidor al
 * terminar la llamada y siempre; esta la escribe el cliente cuando el
 * administrador acaba de trabajar, puede no llegar nunca, y mezclarlas
 * convertiría un registro fiable en uno con huecos.
 *
 * ## Metadatos sí, contenido no
 *
 * Regla del Paso 0, y la garantía es la misma que en `aiUsage`: **el esquema no
 * tiene dónde meter contenido.** De un dato descartado viaja su categoría,
 * nunca la frase — «¿hasta qué hora estará cerrada la alberca de la torre 3?»
 * habla del conjunto. De la edición viaja un número calculado en el cliente.
 *
 * `.strict()` cierra la puerta a que un cliente futuro añada un campo con
 * texto: no se ignoraría, se rechazaría.
 */
exports.AI_FEEDBACK_COLLECTION = "aiFeedback";
/**
 * Tope de elementos por lista. No es por tamaño: es para que un cliente
 * manipulado no pueda usar esta colección como almacenamiento gratuito.
 * Una propuesta real trae cuatro o cinco datos faltantes.
 */
const MAX_CATEGORIAS = 40;
exports.feedbackSchema = zod_1.z
    .object({
    operationKey: zod_1.z.literal("comunicaciones-redactar"),
    propuestas: zod_1.z.number().int().min(1).max(100),
    aplicada: zod_1.z.boolean(),
    deshecha: zod_1.z.boolean(),
    guardada: zod_1.z.boolean(),
    mostrados: zod_1.z.array(zod_1.z.enum(catalog_1.CATEGORIAS_DATO_FALTANTE)).max(MAX_CATEGORIAS),
    descartados: zod_1.z.array(zod_1.z.enum(catalog_1.CATEGORIAS_DATO_FALTANTE)).max(MAX_CATEGORIAS),
    distanciaEdicion: zod_1.z.number().int().min(0).max(100).nullable(),
})
    .strict()
    // Una edición medida sin haber guardado no significa nada, y una guardada sin
    // medida tampoco: si llegan descuadradas, el cliente está mal, no los datos.
    .refine((v) => (v.guardada ? v.distanciaEdicion !== null : v.distanciaEdicion === null), {
    message: "distanciaEdicion solo existe si se guardó, y siempre que se guarde",
})
    // Deshacer sin haber aplicado es imposible en la pantalla. Si llega, es señal
    // de un cliente roto y no de una persona indecisa.
    .refine((v) => !(v.deshecha && !v.aplicada), {
    message: "no se puede deshacer lo que no se aplicó",
});
/**
 * Escribe una fila de feedback.
 *
 * **Nunca lanza**, igual que `recordAiUsage` y por el mismo motivo: perder una
 * fila de medición es molesto; que el administrador vea un error al cerrar un
 * comunicado que ya se guardó bien es absurdo y además mentira.
 */
async function recordAiFeedback(entry) {
    try {
        await (0, firestore_1.getFirestore)()
            .collection(exports.AI_FEEDBACK_COLLECTION)
            .add({ ...entry, createdAt: firestore_1.Timestamp.now() });
    }
    catch (error) {
        logger.error("aiFeedback: no se pudo registrar", {
            tenantId: entry.tenantId,
            detail: error instanceof Error ? error.message : String(error),
        });
    }
}
