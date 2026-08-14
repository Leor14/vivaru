import { z } from "zod";

import type { OperationDefinition } from "./catalog";
import { getPrompt, PROMPT_ACTIVO, type PromptVersion } from "./prompts";

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
export function buildFormatInstruction(operation: OperationDefinition): string {
  let forma: string;
  try {
    forma = JSON.stringify(z.toJSONSchema(operation.output), null, 2);
  } catch {
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
    // Las reglas duras del programa, dichas al modelo además de validadas.
    // Validarlas es lo que las hace ciertas; decirlas ahorra rechazos.
    //
    // Van AQUÍ y no en los prompts de tarea a propósito: son fidelidad a los
    // hechos, no estilo de redacción. Metidas en una sola versión, esa saldría
    // con ventaja y la comparación entre v1, v2 y v3 dejaría de medir lo que
    // dice medir.
    "Reglas:",
    "- No añadas claves que no estén en el esquema.",
    "- Si te falta un dato para redactar bien, NO lo inventes: enumera lo que",
    "  falta en `missingInformation` y deja el resto lo más conservador posible.",
    // Añadida el 13 de agosto de 2026, y la única que salió de ver a un
    // administrador de verdad en vez de de un razonamiento. Escribió «2500
    // pesos por residente» en un hecho y «por unidad» en otro, sin notarlo, y
    // el borrador publicó «por unidad» y descartó lo otro sin avisar — 3 de 3
    // veces. Puede que eligiera bien; el problema es que eligiera.
    "- Si dos hechos se contradicen entre sí, NO decidas cuál vale: dilo en",
    "  `qualityFlags` y pide la aclaración en `missingInformation`. Elegir por la",
    "  persona es peor que preguntarle, aunque aciertes.",
    // Segunda regla del mismo día y de la misma sesión. La de arriba no cubría
    // el caso: el modelo no veía contradicción entre «2500 por residente» y
    // «conciliar por unidad» —y puede que tenga razón, son cosas distintas—
    // pero aun así reescribía el importe como «por unidad».
    "- Copia los datos con las MISMAS palabras del administrador. No los",
    "  reformules por otros que signifiquen algo distinto, aunque creas que se",
    "  equivocó o que otro hecho sugiere lo contrario. Si crees que un dato está",
    "  mal, dilo en `qualityFlags`; no lo cambies.",
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
export function buildProviderPrompt(
  operation: OperationDefinition,
  input: unknown,
  version: PromptVersion = PROMPT_ACTIVO,
): string {
  return [
    getPrompt(version).instruccion,
    "",
    buildFormatInstruction(operation),
    "",
    "Datos proporcionados:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}
