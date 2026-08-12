"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeOperation = executeOperation;
const prompt_1 = require("./prompt");
const prompts_1 = require("./prompts");
/**
 * Los cuatro mensajes terminan igual a propósito: pase lo que pase, el flujo
 * tradicional sigue abierto. Es el principio de fallback determinista del plan
 * — ninguna función central del SaaS depende de que el proveedor responda.
 */
const SEGUIR_A_MANO = "Puedes continuar con el proceso manual.";
/**
 * Quita el envoltorio de bloque de código si viene.
 *
 * Es limpieza de transporte, **no indulgencia con el contrato**: los modelos
 * devuelven a menudo el JSON dentro de ```json … ``` y eso no es incumplir la
 * forma pedida, es empaquetarla. Lo de dentro se sigue validando estricto, y si
 * sobra una clave se rechaza igual.
 */
function desenvolverJson(text) {
    const limpio = text.trim();
    if (!limpio.startsWith("```"))
        return limpio;
    return limpio
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
}
/** Corta la promesa a los milisegundos del catálogo. */
async function conCorteDeTiempo(promise, timeoutMs) {
    let timer;
    const corte = new Promise((resolve) => {
        timer = setTimeout(() => resolve("timeout"), timeoutMs);
    });
    try {
        return await Promise.race([promise, corte]);
    }
    finally {
        // Sin esto el temporizador mantiene viva la instancia hasta que dispara, y
        // en Cloud Functions eso se paga.
        if (timer)
            clearTimeout(timer);
    }
}
async function executeOperation(operation, input, provider, 
// La evaluación offline del Paso 2.4 corre el mismo camino con versiones
// distintas; producción usa siempre la activa.
promptVersion = prompts_1.PROMPT_ACTIVO) {
    const inicio = Date.now();
    const transcurrido = () => Date.now() - inicio;
    let resultado;
    try {
        resultado = await conCorteDeTiempo(provider.generate({
            operationKey: operation.key,
            operationVersion: operation.version,
            prompt: (0, prompt_1.buildProviderPrompt)(operation, input, promptVersion),
            promptVersion,
            input,
            maxOutputTokens: operation.limits.maxOutputTokens,
        }), operation.limits.timeoutMs);
    }
    catch (error) {
        return {
            ok: false,
            reason: "proveedor_error",
            message: `No pudimos generar la propuesta. ${SEGUIR_A_MANO}`,
            detail: error instanceof Error ? error.message : String(error),
            latencyMs: transcurrido(),
        };
    }
    if (resultado === "timeout") {
        return {
            ok: false,
            reason: "proveedor_no_responde",
            message: `La propuesta está tardando demasiado. ${SEGUIR_A_MANO}`,
            detail: `Superó ${operation.limits.timeoutMs} ms.`,
            latencyMs: transcurrido(),
        };
    }
    let crudo;
    try {
        crudo = JSON.parse(desenvolverJson(resultado.text));
    }
    catch {
        // El fallo más común de todos: el modelo contesta en prosa.
        return {
            ok: false,
            reason: "salida_ilegible",
            message: `No pudimos generar la propuesta. ${SEGUIR_A_MANO}`,
            detail: "La respuesta del modelo no es JSON.",
            latencyMs: transcurrido(),
        };
    }
    const validada = operation.output.safeParse(crudo);
    if (!validada.success) {
        // Aquí muere una respuesta con `assumptions` llena, con una clave de más, o
        // con un campo obligatorio ausente. Entera, no a medias.
        const primero = validada.error.issues[0];
        return {
            ok: false,
            reason: "salida_incumple_contrato",
            message: `La propuesta no cumplió las reglas de Vivaru y se descartó. ${SEGUIR_A_MANO}`,
            detail: primero ? `${primero.path.join(".") || "(raíz)"}: ${primero.message}` : "Esquema incumplido.",
            latencyMs: transcurrido(),
        };
    }
    return {
        ok: true,
        output: validada.data,
        usage: resultado.usage,
        latencyMs: transcurrido(),
    };
}
