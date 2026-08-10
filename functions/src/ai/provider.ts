import type { OperationDefinition } from "./catalog";

/**
 * Adaptador del proveedor de IA (Paso 1.4 de `docs/hoja-de-ruta-ia.md`).
 *
 * **La única parte del sistema que sabe hablar con el proveedor.** Todo lo
 * demás pide «genera esto» y no sabe si detrás hay Vertex AI, otro proveedor o
 * nada. Es lo que permite que cambiar de modelo sea un cambio de un archivo.
 *
 * Hoy solo existe `stubAiProvider`. **Es el mismo patrón que `SriTransport` en
 * `functions/src/sri-ecuador.ts`**, y por el mismo motivo: allí el transporte
 * real espera el dato del experto SAP↔SRI, aquí la llamada real espera dos
 * decisiones del Paso 0 que cuestan dinero — la región de Vertex AI y el tope
 * de gasto configurado de verdad.
 *
 * No es un atajo. El criterio de este paso —«una respuesta deliberadamente
 * malformada se rechaza»— se prueba mejor con un simulador: al modelo real no
 * se le puede pedir que se equivoque cuando a uno le conviene.
 *
 * **Para meter el proveedor real** hace falta: región elegida, `@google-cloud/
 * vertexai` como dependencia, el id de modelo fijado (Gemini 3.1 Flash-Lite,
 * decisión del Paso 0), el tope de gasto puesto, y una implementación de
 * `AiProvider` que devuelva el texto crudo. Nada más de este archivo cambia.
 */

export interface AiGenerationRequest {
  operationKey: string;
  operationVersion: number;
  /**
   * Instrucciones para el modelo. Vacío hasta el Paso 2.3, que trae los prompts
   * versionados. El simulador no lo usa; el proveedor real sí.
   */
  prompt: string;
  /** Entrada ya validada contra el esquema del catálogo. */
  input: unknown;
  maxOutputTokens: number;
}

/**
 * Metadatos de la llamada. El adaptador los **transporta**; quien los escribe
 * es la telemetría del Paso 1.5. Sin contenido sensible: cuánto y con qué, no
 * qué se dijo.
 */
export interface AiUsage {
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
}

export interface AiGenerationResult {
  /** Texto crudo tal y como lo devolvió el modelo. Se parsea y valida fuera. */
  text: string;
  usage: AiUsage;
}

export interface AiProvider {
  readonly name: string;
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>;
}

/**
 * Respuesta simulada por operación. Es válida contra el esquema del catálogo a
 * propósito: el camino feliz tiene que poder recorrerse entero antes de que
 * exista el proveedor real.
 *
 * Se nota que es simulada al leerla, y eso también es a propósito: si algún día
 * aparece en una pantalla, tiene que ser evidente que no la escribió un modelo.
 */
function respuestaSimulada(request: AiGenerationRequest): string {
  if (request.operationKey === "comunicaciones-redactar") {
    const input = request.input as { proposito?: string; hechos?: string[] } | undefined;
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
export const stubAiProvider: AiProvider = {
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
export function fakeAiProvider(options: {
  text?: string;
  throws?: Error;
  /** Milisegundos que tarda. Para probar el corte por tiempo. */
  delayMs?: number;
}): AiProvider {
  return {
    name: "fake",
    async generate() {
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
      if (options.throws) throw options.throws;
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
export function resolveProvider(_operation: OperationDefinition): AiProvider {
  return stubAiProvider;
}
