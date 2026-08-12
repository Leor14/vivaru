"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFormatInstruction = buildFormatInstruction;
exports.buildProviderPrompt = buildProviderPrompt;
const zod_1 = require("zod");
const prompts_1 = require("./prompts");
/**
 * Instrucción de FORMATO para el proveedor (Paso 1.4-real).
 *
 * **Esto no es el prompt de la operación.** Los prompts versionados —los que
 * dicen cómo se redacta bien una comunicación, y que se comparan entre sí en la
 * evaluación offline— son el Paso 2.3. Aquí solo se le explica al modelo qué
 * forma debe tener la respuesta.
 *
 * La separación importa: el formato lo puede derivar la plataforma del esquema
 * del catálogo, y por eso vale para cualquier operación sin escribir nada. El
 * contenido no se deriva de nada: hay que escribirlo, versionarlo y evaluarlo.
 *
 * La forma se saca del propio esquema Zod con `z.toJSONSchema`, así que **no
 * puede desincronizarse del validador**: si mañana cambia el contrato, cambia
 * lo que se le pide al modelo, sin tocar este archivo.
 */
function buildFormatInstruction(operation) {
    let forma;
    try {
        forma = JSON.stringify(zod_1.z.toJSONSchema(operation.output), null, 2);
    }
    catch {
        // Un esquema que no se pueda expresar como JSON Schema no debe romper la
        // llamada: se pide JSON a secas y el validador hará su trabajo igual.
        forma = "(sin esquema disponible)";
    }
    return [
        `Tarea: ${operation.description}`,
        "",
        "Responde ÚNICAMENTE con un objeto JSON válido que cumpla este esquema.",
        "Sin texto antes ni después, sin explicaciones y sin bloque de código.",
        "",
        forma,
        "",
        // Las tres reglas duras del programa, dichas al modelo además de validadas.
        // Validarlas es lo que las hace ciertas; decirlas ahorra rechazos.
        "Reglas:",
        "- No añadas claves que no estén en el esquema.",
        "- Si te falta un dato para redactar bien, NO lo inventes: enumera lo que",
        "  falta en `missingInformation` y deja el resto lo más conservador posible.",
        "- `assumptions` debe ir vacío. Si asumiste algo, la respuesta se descarta.",
    ].join("\n");
}
/**
 * Mensaje completo: instrucción de TAREA (versionada, Paso 2.3) + instrucción de
 * FORMATO (derivada del esquema) + los datos que escribió la persona.
 *
 * El orden importa poco para el modelo y mucho para quien lee esto: primero qué
 * hacer, luego con qué forma, y al final los datos.
 */
function buildProviderPrompt(operation, input, version = prompts_1.PROMPT_ACTIVO) {
    return [
        (0, prompts_1.getPrompt)(version).instruccion,
        "",
        buildFormatInstruction(operation),
        "",
        "Datos proporcionados:",
        JSON.stringify(input, null, 2),
    ].join("\n");
}
