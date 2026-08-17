import { resolveFeatureFlag } from "../feature-flags";
import type { OperationDefinition } from "./catalog";

/**
 * Adaptador del proveedor de IA (Paso 1.4 de `docs/hoja-de-ruta-ia.md`).
 *
 * **La única parte del sistema que sabe hablar con el proveedor.** Todo lo
 * demás pide «genera esto» y no sabe si detrás hay Vertex AI, otro proveedor o
 * nada. Es lo que permite que cambiar de modelo sea un cambio de un archivo.
 *
 * Hay tres implementaciones, y las tres importan:
 *
 *  · `stubAiProvider` — simulado, determinista y gratis. Sigue siendo el
 *    DEFAULT: el proveedor real se enciende por bandera.
 *  · `fakeAiProvider` — para provocar a voluntad las cuatro formas de fallar.
 *    Al modelo real no se le puede pedir que se equivoque cuando conviene, así
 *    que aquí el simulador no es un sustituto pobre, es la herramienta correcta.
 *  · `createVertexProvider` en `provider-vertex.ts` — la llamada de verdad.
 *
 * Es el mismo patrón que `SriTransport` en `functions/src/sri-ecuador.ts`:
 * interfaz estable, implementación intercambiable.
 */

export interface AiGenerationRequest {
  operationKey: string;
  operationVersion: number;
  /** Instrucciones completas para el modelo: tarea + formato + datos. */
  prompt: string;
  /** Qué versión de prompt se usó. Va a la telemetría para poder comparar. */
  promptVersion: string;
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
      // Devuelve datos faltantes a propósito, y no por realismo: la lista de lo
      // que falta ES la funcionalidad del Paso 2.5, y con el proveedor real
      // apagado —que es como nace— una lista siempre vacía dejaría la parte
      // principal de la pantalla sin poder construirse ni verse sin pagar.
      // Van dos y de categorías distintas para que se note el orden: la
      // interfaz debe subir `duracion` por encima de `fecha`.
      missingInformation: [
        { categoria: "duracion", detalle: "[SIMULADO] ¿Cuánto tiempo durará?" },
        { categoria: "fecha", detalle: "[SIMULADO] ¿Qué día exactamente?" },
      ],
      qualityFlags: ["respuesta_simulada"],
      // Vacío siempre: la regla dura de la PRD. Un simulador que la incumpliera
      // enseñaría a ignorar el validador.
      assumptions: [],
    });
  }

  if (request.operationKey === "pqrs-asistir") {
    const input = request.input as { mensaje?: string; variante?: string } | undefined;
    // El simulador respeta la puerta dura de la variante: un stub que
    // clasificara en `buzon_simple` enseñaría a ignorar el contrato, igual que
    // uno que llenara `assumptions` en comunicaciones.
    const buzonSimple = input?.variante === "buzon_simple";

    return JSON.stringify({
      summary: `[SIMULADO] Resumen del ticket: ${(input?.mensaje ?? "").slice(0, 120)}`,
      suggestedCategory: buzonSimple ? null : "pqrs",
      suggestedType: buzonSimple ? null : "petition",
      suggestedPriority: "medium",
      priorityReason: "[SIMULADO] Motivo de la prioridad",
      needsHumanReview: true,
      requests: ["[SIMULADO] Solicitud extraída"],
      missingInformation: ["[SIMULADO] ¿Qué dato falta?"],
      nextSteps: ["[SIMULADO] Paso sugerido para el administrador"],
      draftResponse: "[SIMULADO] Borrador de respuesta al residente.",
      safetyFlags: [],
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
        promptVersion: request.promptVersion,
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
 * Proveedor que se usa en tiempo de ejecución, elegido por bandera.
 *
 * `ia-proveedor-real` apagada (el default) → simulado. Encendida → Vertex AI.
 * Se gobierna desde `/superadmin/flags`, así que **volver al simulado si el
 * proveedor se cae o se desmadra el gasto no requiere desplegar** — que es para
 * lo que se construyó el mecanismo del Paso 1.1.
 *
 * Y falla al lado seguro: el kill switch maestro apaga todas las banderas, así
 * que bajarlo devuelve al simulado además de cerrar la puerta.
 *
 * El SDK se carga solo si hace falta. Importarlo arriba lo metería en el
 * arranque en frío de la función aunque la bandera esté apagada.
 */
export async function resolveProvider(
  _operation: OperationDefinition,
  tenantId: string,
): Promise<AiProvider> {
  const real = await resolveFeatureFlag("ia-proveedor-real", tenantId);
  if (!real.enabled) return stubAiProvider;

  const { createVertexProvider } = await import("./provider-vertex");
  return createVertexProvider();
}
