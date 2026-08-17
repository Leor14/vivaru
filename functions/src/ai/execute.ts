import type { FraseMarcada, MarcaDeRevision, OperationDefinition } from "./catalog";
import { buildProviderPrompt } from "./prompt";
import type { AiProvider, AiUsage } from "./provider";
import type { ContextoConjunto } from "./tenant-context";

/**
 * Ejecución de una operación: llamar al proveedor y **validar lo que vuelve**
 * (Paso 1.4 de `docs/hoja-de-ruta-ia.md`).
 *
 * De las dos mitades del paso, esta es la que importa. El modelo devuelve
 * texto, y puede devolver JSON perfecto, JSON con una clave de más, JSON con
 * `assumptions` lleno, o prosa suelta. Sin validador, un objeto a medias llega
 * al módulo y el administrador ve un formulario medio lleno con datos que nadie
 * escribió.
 *
 * La regla es que **se rechaza entero**. Nunca se devuelve lo que se pudo
 * salvar: media propuesta con la mitad inventada es peor que ninguna, porque
 * parece revisada.
 */

export type ExecutionFailureReason =
  | "proveedor_no_responde"
  | "proveedor_error"
  | "salida_ilegible"
  | "salida_incumple_contrato";

export interface ExecutionSuccess {
  ok: true;
  /** Salida ya parseada y validada contra el esquema del catálogo. */
  output: unknown;
  usage: AiUsage;
  latencyMs: number;
  /**
   * Lo que corrigió `revisarSalida`, si corrigió algo. Se devuelve en vez de
   * registrarse aquí: este módulo no depende del runtime de Functions —es lo
   * que permite al evaluador offline importarlo—, y meterle el logger le
   * cambiaría esa propiedad por una línea de traza.
   */
  marcas?: readonly MarcaDeRevision[];
  /**
   * Los trozos que dispararon esas marcas, con su posición dentro del campo
   * revisado. Van separados de `marcas` porque tienen destinos distintos: la
   * categoría se registra en `aiUsage` y esto se le enseña a la persona.
   */
  frasesMarcadas?: readonly FraseMarcada[];
}

export interface ExecutionFailure {
  ok: false;
  reason: ExecutionFailureReason;
  /** Lo que ve la persona. Los cuatro apuntan al camino manual. */
  message: string;
  /** Para los logs. Nunca se le enseña al usuario. */
  detail: string;
  latencyMs: number;
}

export type ExecutionResult = ExecutionSuccess | ExecutionFailure;

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
function desenvolverJson(text: string): string {
  const limpio = text.trim();
  if (!limpio.startsWith("```")) return limpio;

  return limpio
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

/** Corta la promesa a los milisegundos del catálogo. */
async function conCorteDeTiempo<T>(promise: Promise<T>, timeoutMs: number): Promise<T | "timeout"> {
  let timer: NodeJS.Timeout | undefined;
  const corte = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });

  try {
    return await Promise.race([promise, corte]);
  } finally {
    // Sin esto el temporizador mantiene viva la instancia hasta que dispara, y
    // en Cloud Functions eso se paga.
    if (timer) clearTimeout(timer);
  }
}

export async function executeOperation(
  operation: OperationDefinition,
  input: unknown,
  provider: AiProvider,
  // La evaluación offline corre el mismo camino con versiones distintas;
  // producción pasa `undefined` y usa la activa de la operación.
  promptVersion?: string,
  // Lo que Vivaru sabe del conjunto y el administrador no tiene que escribir.
  // Lo resuelve la puerta; aquí solo se transporta hasta el prompt. Ausente, el
  // mensaje sale idéntico al de siempre.
  contexto?: ContextoConjunto,
): Promise<ExecutionResult> {
  const inicio = Date.now();
  const transcurrido = () => Date.now() - inicio;

  // Resuelta una sola vez: el mensaje al modelo y la telemetría tienen que
  // contar la misma versión.
  const version = promptVersion ?? operation.prompts.activo;

  let resultado;
  try {
    resultado = await conCorteDeTiempo(
      provider.generate({
        operationKey: operation.key,
        operationVersion: operation.version,
        prompt: buildProviderPrompt(operation, input, version, contexto),
        promptVersion: version,
        input,
        maxOutputTokens: operation.limits.maxOutputTokens,
      }),
      operation.limits.timeoutMs,
    );
  } catch (error) {
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

  let crudo: unknown;
  try {
    crudo = JSON.parse(desenvolverJson(resultado.text));
  } catch {
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

  // Última pasada, sobre la salida ya validada. Aquí no se rechaza nada: se
  // corrige. Ver `revisarSalida` en el catálogo — vive ahí y se aplica aquí para
  // que la pantalla y el evaluador offline vean exactamente lo mismo.
  const revisada = operation.revisarSalida?.(validada.data);

  return {
    ok: true,
    output: revisada ? revisada.salida : validada.data,
    usage: resultado.usage,
    latencyMs: transcurrido(),
    ...(revisada?.marcas.length ? { marcas: revisada.marcas } : {}),
    ...(revisada?.frasesMarcadas.length ? { frasesMarcadas: revisada.frasesMarcadas } : {}),
  };
}
