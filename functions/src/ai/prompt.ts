import { z } from "zod";

import type { OperationDefinition } from "./catalog";
import type { ContextoConjunto } from "./tenant-context";

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
    // Van en el catálogo de la operación y no en los prompts de tarea a
    // propósito: son fidelidad a los hechos, no estilo de redacción. Metidas en
    // una sola versión, esa saldría con ventaja y la comparación entre
    // versiones dejaría de medir lo que dice medir.
    "Reglas:",
    ...operation.reglasDuras,
  ].join("\n");
}

/**
 * Cómo se le cuenta al modelo qué forma tiene el conjunto.
 *
 * **Son hechos, no instrucciones, y esa fue la decisión.** No dicen «no
 * preguntes por el alcance»: dicen cómo es el edificio y dejan que el modelo
 * saque la consecuencia. Prohibírselo mataría también «¿qué zonas comunes
 * afecta?», que en un edificio de once pisos es una pregunta buena — el corpus
 * de Quito, sin una sola «torre», tiene 109 menciones de «piso». Por eso la
 * frase del edificio único dice en voz alta lo que **sí** tiene.
 *
 * Se exportan para que la corrida y los documentos citen la frase exacta que se
 * evaluó, en vez de una paráfrasis.
 */
export const CONTEXTO_CON_AGRUPACIONES =
  "El conjunto está dividido en varias agrupaciones (torres, bloques o manzanas).";

export const CONTEXTO_EDIFICIO_UNICO =
  "El conjunto es un edificio único: no tiene torres ni bloques. Sí tiene pisos y zonas comunes.";

/**
 * Mensaje completo: instrucción de TAREA (versionada, Paso 2.3) + instrucción de
 * FORMATO (derivada del esquema) + el contexto del conjunto + los datos que
 * escribió la persona.
 *
 * El orden importa poco para el modelo y mucho para quien lee esto: primero qué
 * hacer, luego con qué forma, y al final los datos.
 *
 * **Sin contexto —o con un contexto que no sabe nada— el mensaje sale idéntico
 * al de antes del 14 de agosto de 2026, byte a byte.** No es una casualidad de
 * la implementación: es lo que permite volver a medir el suelo y comparar la
 * corrida nueva con las seis anteriores. Hay una prueba que lo sostiene.
 */
export function buildProviderPrompt(
  operation: OperationDefinition,
  input: unknown,
  version?: string,
  contexto?: ContextoConjunto,
): string {
  // La versión pertenece a la operación desde que hay más de una: pedirle a
  // PQRS un prompt de comunicaciones tiene que romper aquí, en voz alta, y no
  // salir como un mensaje a medias que el modelo intente complacer.
  const elegida = version ?? operation.prompts.activo;
  const definicion = operation.prompts.versiones[elegida];
  if (!definicion) {
    throw new Error(`La operación «${operation.key}» no tiene la versión de prompt «${elegida}».`);
  }

  const hecho =
    contexto?.tieneAgrupaciones === undefined
      ? null
      : contexto.tieneAgrupaciones
        ? CONTEXTO_CON_AGRUPACIONES
        : CONTEXTO_EDIFICIO_UNICO;

  return [
    definicion.instruccion,
    "",
    buildFormatInstruction(operation),
    "",
    // Va ANTES de los datos del administrador y separado de ellos: es lo que
    // Vivaru sabe, no lo que él escribió. Mezclarlo con los hechos invitaría al
    // modelo a devolverlo como si se lo hubieran dictado.
    ...(hecho ? ["Contexto del conjunto (lo sabe Vivaru, no lo escribió el administrador):", hecho, ""] : []),
    "Datos proporcionados:",
    JSON.stringify(input, null, 2),
  ].join("\n");
}
