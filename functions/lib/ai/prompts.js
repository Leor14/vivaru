"use strict";
/**
 * Prompts versionados del borrador de comunicaciones (Paso 2.3 de
 * `docs/hoja-de-ruta-ia.md`).
 *
 * **Las tres versiones varían en UN eje cada una, no un poco en todo.** Si se
 * cambian tres cosas a la vez y una gana, no se sabe por qué ganó ni cómo
 * repetirlo — y la evaluación offline deja de enseñar nada.
 *
 * Lo que NO varía: las reglas duras del contrato. Salen del esquema del
 * catálogo vía `buildFormatInstruction`, son idénticas en las tres versiones, y
 * por eso la comparación mide la guía de tarea y no otra cosa.
 *
 * La versión activa la declara la operación en el catálogo. Cambiarla exige
 * desplegar, y el plan lo pide así: «versión fijada, evaluación obligatoria
 * antes de cambiarla».
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROMPT_ACTIVO = exports.PROMPT_VERSIONS = exports.PROMPTS = void 0;
exports.getPrompt = getPrompt;
/**
 * v1 · Mínima.
 *
 * Hipótesis: con el contrato de salida y las reglas duras basta. Es la que hay
 * que batir — si v2 y v3 no la superan, la complejidad extra no se paga.
 */
const V1 = {
    version: "v1-minima",
    hipotesis: "El contrato de salida y las reglas duras bastan; no hace falta guía de redacción.",
    instruccion: [
        "Eres quien redacta los comunicados de un conjunto residencial en Latinoamérica.",
        "A partir del propósito y los hechos que te da el administrador, escribe un borrador.",
        "Usa únicamente los hechos proporcionados.",
    ].join("\n"),
};
/**
 * v2 · Con estructura.
 *
 * Hipótesis: hace falta describirle la forma que tienen los avisos reales. La
 * estructura y los cuatro datos salen de leer 108 avisos del corpus vecinal
 * (ver `datasets/chat-vecinal/analisis.md`), no de la intuición.
 */
const V2 = {
    version: "v2-estructura",
    hipotesis: "Describirle la estructura observada en avisos reales mejora el resultado.",
    instruccion: [
        "Eres quien redacta los comunicados de un conjunto residencial en Latinoamérica.",
        "A partir del propósito y los hechos que te da el administrador, escribe un borrador.",
        "Usa únicamente los hechos proporcionados.",
        "",
        "Un aviso de conjunto tiene esta forma:",
        "1. Saludo breve.",
        "2. Qué va a pasar, en una frase.",
        "3. Cuándo, cuánto dura y a qué zona o torre afecta.",
        "4. Qué tiene que hacer el residente, si tiene que hacer algo.",
        "5. Cierre cortés.",
        "",
        "Los cuatro datos que un residente busca siempre son: cuándo, cuánto dura, a",
        "quién afecta y qué debe hacer. Si alguno no te lo dieron, pídelo en",
        "`missingInformation` — no lo deduzcas ni lo aproximes.",
        "",
        "Escribe en español neutro de Latinoamérica. Frases cortas. Sin adornos.",
        "El título debe poder leerse en una notificación y decir de qué se trata.",
    ].join("\n"),
};
/**
 * v3 · Con ejemplo.
 *
 * Hipótesis: describir la forma no basta, hay que enseñar una. El ejemplo es
 * deliberadamente de un caso CON un dato faltante: es la conducta más difícil
 * de conseguir y la que más cuesta cuando falla.
 */
const V3 = {
    version: "v3-ejemplo",
    hipotesis: "Un ejemplo resuelto enseña más que describir la estructura, sobre todo el pedir lo que falta.",
    instruccion: [
        V2.instruccion,
        "",
        "Ejemplo.",
        "",
        "Entrada:",
        '{"proposito":"Avisar del mantenimiento del portón vehicular",',
        ' "hechos":["Es el jueves","El portón se abrirá de forma manual mientras dure"],',
        ' "tono":"informativo"}',
        "",
        "Salida:",
        '{"title":"Mantenimiento del portón vehicular este jueves",',
        ' "body":"Estimados residentes:\\n\\nEl jueves se realizará el mantenimiento del portón vehicular. Mientras duren los trabajos, el portón se abrirá de forma manual con apoyo del personal.\\n\\nAgradecemos su comprensión.",',
        ' "notificationSummary":"Mantenimiento del portón este jueves; apertura manual",',
        // Traducido a la forma categorizada del contrato v2. Es el MISMO ejemplo
        // —mismas dos preguntas, mismo orden— reescrito con la forma nueva. Dejarlo
        // con la vieja enseñaría al modelo algo que el esquema prohíbe, y eso no
        // sería «no tocar el prompt», sería sabotear a v3 en la comparación.
        ' "missingInformation":[{"categoria":"fecha","detalle":"¿A qué hora comienzan los trabajos?"},',
        '                       {"categoria":"duracion","detalle":"¿Cuánto tiempo durarán aproximadamente?"}],',
        ' "qualityFlags":[],',
        ' "assumptions":[]}',
        "",
        "Fíjate en que no se inventó la hora ni la duración: se pidieron.",
    ].join("\n"),
};
exports.PROMPTS = {
    "v1-minima": V1,
    "v2-estructura": V2,
    "v3-ejemplo": V3,
};
exports.PROMPT_VERSIONS = Object.keys(exports.PROMPTS);
/**
 * La que se usa en producción hasta que la evaluación diga otra cosa.
 *
 * Arrancó en `v1-minima` a propósito —era la que había que batir— y **la
 * evaluación del Paso 2.4 dijo otra cosa el 12 de agosto de 2026.**
 *
 * `v2-estructura` ganó **las cinco corridas reales**: 80, 80, 86, 88 y 95 por
 * ciento, frente a un v1 que se movió entre 70 y 86 y un v3 entre 63 y 85. Dos
 * razones para el cambio, y la segunda pesa más que la primera:
 *
 *  1. **Gana siempre**, y en la última corrida acertó 27 de 27 casos incómodos
 *     sin una sola invención.
 *  2. **Es la única estable.** A temperatura 0,2 el modelo no es determinista:
 *     v1 y v3 oscilan casi diez puntos entre corridas idénticas y v2 se movió
 *     dos. En algo que va a redactar avisos para residentes, la consistencia
 *     vale tanto como la media.
 *
 * Sus tres únicos fallos son los tres casos contrapeso del conjunto —pide
 * fecha y zona en comunicaciones que no las tienen porque son permanentes—, y
 * eso es preferible al fallo contrario. Detalle en
 * `datasets/evaluacion/resultados/2026-08-12-lectura.md`.
 */
exports.PROMPT_ACTIVO = "v2-estructura";
function getPrompt(version = exports.PROMPT_ACTIVO) {
    return exports.PROMPTS[version];
}
