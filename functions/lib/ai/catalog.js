"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPERATION_KEYS = exports.CATEGORIAS_DATO_FALTANTE = void 0;
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
 * Los cuatro datos que un residente busca en un aviso, más una salida para todo
 * lo demás.
 *
 * **No es una taxonomía inventada:** sale de medir los 71 avisos operativos del
 * corpus vecinal. Faltan, respectivamente, en el 57%, el 95%, el 48% y el 84%
 * de los avisos reales (`datasets/linea-base/hipotesis-de-valor.md`). Y el
 * modelo converge solo a esta misma lista sin que ningún prompt se la enseñe,
 * que es el hallazgo más fuerte del Paso 2.4.
 *
 * `otro` no es pereza: sin escape, el modelo tendría que forzar dentro de una
 * de las cuatro cosas que no lo son —un monto, un teléfono— y una categoría
 * mal puesta es peor que ninguna. En la corrida del 12 de agosto pidió montos
 * y fechas de vencimiento, así que el caso existe de verdad.
 */
exports.CATEGORIAS_DATO_FALTANTE = ["duracion", "fecha", "alcance", "accion", "otro"];
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
    /**
     * Datos críticos que faltan. Que los pida es mejor que que los invente.
     *
     * **Va categorizado, y esa es la razón de que la operación sea v2.** La
     * interfaz del Paso 2.5 tiene que poner «cuánto dura» arriba del todo —es
     * el dato que falta el 95% de las veces— y con una lista de frases sueltas
     * eso solo se puede hacer buscando palabras. La lectura del 2.4 documenta
     * dos veces lo que cuesta: «cuando una afirmación busca palabras exactas
     * sobre texto libre, mide al que la escribió». El calificador cayó en ello
     * dos veces en un día; la interfaz caería igual.
     *
     * La descripción de `categoria` no está de adorno: viaja al modelo dentro
     * del esquema vía `z.toJSONSchema` (Paso 1.4-real), así que las categorías
     * se explican **sin tocar ningún prompt de tarea** — que es lo que permite
     * que la comparación entre v1, v2 y v3 siga midiendo lo mismo.
     */
    missingInformation: zod_1.z.array(zod_1.z
        .object({
        categoria: zod_1.z
            .enum(exports.CATEGORIAS_DATO_FALTANTE)
            .describe("duracion = cuánto dura o hasta cuándo; fecha = cuándo ocurre; alcance = a qué torres, zonas o unidades afecta; accion = qué debe hacer el residente; otro = cualquier otro dato que falte. Estas categorías NO son la lista de lo que hay que preguntar: si falta un dato importante que no encaja en ninguna de las cuatro primeras, pídelo igualmente con la categoría `otro`."),
        detalle: zod_1.z
            .string()
            .trim()
            .min(1)
            .max(200)
            .describe("La pregunta concreta, en español, tal y como se le mostraría al administrador."),
    })
        .strict()),
    qualityFlags: zod_1.z.array(zod_1.z.string()),
    assumptions: zod_1.z.array(zod_1.z.string()).max(0),
})
    .strict();
const OPERATIONS = {
    "comunicaciones-redactar": {
        key: "comunicaciones-redactar",
        // v2 (12 de agosto de 2026): `missingInformation` pasó de lista de frases a
        // lista categorizada. La ENTRADA no cambió, y eso es deliberado: los 59
        // casos del conjunto de evaluación siguen valiendo enteros, así que el
        // cambio de forma se puede medir contra las corridas anteriores en vez de
        // empezar de cero.
        version: 2,
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
        // Atados al presupuesto real, no puestos a ojo: en el peor caso una llamada
        // cuesta USD 0,0025, así que 300 al mes son USD 0,75 por conjunto. Con el
        // tope de 80.000 COP (~USD 20) caben unos 25 conjuntos antes de rozarlo.
        // La línea base del Paso 2 son 10-15 comunicaciones en total, así que las
        // 50 diarias no las va a tocar nadie: están para atrapar un bucle, no para
        // molestar a un administrador.
        quota: { perTenantDay: 50, perTenantMonth: 300, perUserDay: 20 },
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
