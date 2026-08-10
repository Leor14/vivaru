"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPERATION_KEYS = void 0;
exports.findOperation = findOperation;
exports.validateOperationInput = validateOperationInput;
const zod_1 = require("zod");
const ADMIN_ROLES = ["tenant_admin", "admin_tenant"];
/**
 * Entrada del borrador de comunicaciones: **solo lo que escribe el
 * administrador**. Es la razón por la que esta capacidad puede construirse hoy
 * y las otras no — su entrada no sale de la base de datos.
 *
 * Lo que NO está aquí y no es un olvido: audiencia, torres, unidades, vigencia,
 * estado y publicación. La IA no los toca ni los propone (regla del Paso 2.5).
 * Si no llegan al esquema de entrada, no hay forma de que salgan en el de
 * salida.
 */
const redactarComunicacionInput = zod_1.z
    .object({
    proposito: zod_1.z.string().trim().min(10).max(500),
    /** Hechos que da el administrador. El modelo redacta con estos y no añade. */
    hechos: zod_1.z.array(zod_1.z.string().trim().min(3).max(500)).min(1).max(20),
    tono: zod_1.z.enum(["informativo", "urgente", "cordial"]),
})
    .strict();
/**
 * Salida del borrador, tal y como la fija la PRD (Paso 2.3).
 *
 * `assumptions` **debe venir vacío** y es una regla dura, no una advertencia:
 * si el modelo asumió un dato que nadie le dio, la propuesta no se inserta
 * sola. El validador del Paso 1.4 rechazará la respuesta entera.
 *
 * `.strict()` a propósito: una clave de más es señal de que el modelo se salió
 * del contrato, y eso no se ignora, se rechaza.
 */
const redactarComunicacionOutput = zod_1.z
    .object({
    title: zod_1.z.string().trim().min(1).max(160),
    body: zod_1.z.string().trim().min(1),
    notificationSummary: zod_1.z.string().trim().min(1).max(280),
    /** Datos críticos que faltan. Que los pida es mejor que que los invente. */
    missingInformation: zod_1.z.array(zod_1.z.string()),
    qualityFlags: zod_1.z.array(zod_1.z.string()),
    assumptions: zod_1.z.array(zod_1.z.string()).max(0),
})
    .strict();
const OPERATIONS = {
    "comunicaciones-redactar": {
        key: "comunicaciones-redactar",
        version: 1,
        modulo: "comunicaciones",
        label: "Redactar borrador de comunicación",
        description: "A partir del propósito, los hechos y el tono que escribe el administrador, propone título, cuerpo y resumen para notificación. No decide audiencia ni publica.",
        flag: "ai-communications-draft",
        allowedRoles: ADMIN_ROLES,
        input: redactarComunicacionInput,
        output: redactarComunicacionOutput,
        // Primeros números, puestos para que existan: son la previsión de costo por
        // acción antes de tener una sola medición. Se revisan con la evaluación
        // offline del Paso 2.4, que es cuando habrá con qué corregirlos.
        limits: { maxInputChars: 4000, timeoutMs: 20_000, maxOutputTokens: 1500 },
    },
};
exports.OPERATION_KEYS = Object.keys(OPERATIONS);
/** `null` si la clave no está en el catálogo. No lanza: decide el llamador. */
function findOperation(key) {
    if (typeof key !== "string")
        return null;
    return Object.prototype.hasOwnProperty.call(OPERATIONS, key)
        ? OPERATIONS[key]
        : null;
}
/**
 * Valida la entrada contra el esquema de la operación.
 *
 * Se llama **después** de autorizar, nunca antes: a quien no tiene permiso no
 * se le dice si su carga útil era válida.
 *
 * El tope de tamaño va primero porque es la comprobación que protege de una
 * entrada absurda sin recorrerla entera.
 */
function validateOperationInput(operation, raw) {
    const serialized = JSON.stringify(raw ?? null);
    if (serialized.length > operation.limits.maxInputChars) {
        return {
            ok: false,
            reason: "entrada_demasiado_grande",
            detail: `La información enviada supera el límite de ${operation.limits.maxInputChars} caracteres.`,
        };
    }
    const parsed = operation.input.safeParse(raw);
    if (!parsed.success) {
        const primero = parsed.error.issues[0];
        const campo = primero?.path.join(".");
        return {
            ok: false,
            reason: "entrada_invalida",
            detail: campo ? `Revisa el campo «${campo}».` : "La información enviada no es válida.",
        };
    }
    return { ok: true, input: parsed.data };
}
