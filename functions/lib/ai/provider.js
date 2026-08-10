"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stubAiProvider = void 0;
exports.fakeAiProvider = fakeAiProvider;
exports.resolveProvider = resolveProvider;
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
 * Proveedor que se usa en tiempo de ejecución.
 *
 * Hoy siempre el simulado. Cuando exista el real, aquí va la elección — y lo
 * natural es gobernarla con una bandera, para poder volver al simulado sin
 * desplegar si el proveedor se cae.
 */
function resolveProvider(_operation) {
    return exports.stubAiProvider;
}
