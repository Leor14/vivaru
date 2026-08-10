import { z } from "zod";

import type { FeatureFlagKey } from "../feature-flags";

/**
 * Catálogo de operaciones asistidas (Paso 1.3 de `docs/hoja-de-ruta-ia.md`).
 *
 * **Nada se invoca si no está aquí.** No es burocracia: es lo que impide que
 * dentro de seis meses haya once llamadas distintas que nadie sabe de dónde
 * salieron, cuánto cuestan ni quién puede pedirlas.
 *
 * Una entrada no dice «la IA puede redactar». Dice: existe `X`, versión N,
 * recibe exactamente esto, tiene que devolver exactamente esto, la piden estos
 * roles, la gobierna esta bandera y tiene estos límites.
 *
 * **Se registra una operación cuando se va a construir, no antes.** Meter aquí
 * las cinco capacidades del portafolio sería inventar esquemas para cosas que
 * no se tocan en meses — la misma trampa que ajustar un prompt hasta que pasen
 * tus tres ejemplos, en otra forma.
 */

/**
 * Claves en kebab-case y **sin puntos**, igual que las banderas: se usan como
 * segmento de field path al agregar telemetría y cuotas, y un punto ahí se
 * parsearía como anidamiento. El agrupado por módulo va en `modulo`.
 */
export type OperationKey = "comunicaciones-redactar";

export interface OperationLimits {
  /** Tope del tamaño de la entrada serializada. Se comprueba antes de nada. */
  maxInputChars: number;
  /** Corte de la llamada al proveedor. Lo aplica el adaptador (Paso 1.4). */
  timeoutMs: number;
  /** Techo de salida. Sostiene la previsión de costo por acción. */
  maxOutputTokens: number;
}

export interface OperationDefinition {
  key: OperationKey;
  /**
   * Versión de la OPERACIÓN — su contrato. Sube cuando cambian los esquemas.
   * Es un eje distinto de la versión del prompt, que llega en el Paso 2.3: un
   * mismo contrato puede probarse con tres prompts, y eso es justo lo que hace
   * la evaluación offline del 2.4.
   */
  version: number;
  /** Módulo del producto al que pertenece. Para agrupar en telemetría. */
  modulo: string;
  label: string;
  description: string;
  /** Bandera propia, ADEMÁS de `ai-gateway`. Permite apagar solo esta. */
  flag: FeatureFlagKey;
  /** Roles que pueden pedirla. Antes estaba escrito a mano en la puerta. */
  allowedRoles: readonly string[];
  input: z.ZodType;
  output: z.ZodType;
  limits: OperationLimits;
}

const ADMIN_ROLES = ["tenant_admin", "admin_tenant"] as const;

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
const redactarComunicacionInput = z
  .object({
    proposito: z.string().trim().min(10).max(500),
    /** Hechos que da el administrador. El modelo redacta con estos y no añade. */
    hechos: z.array(z.string().trim().min(3).max(500)).min(1).max(20),
    tono: z.enum(["informativo", "urgente", "cordial"]),
  })
  .strict();

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
const redactarComunicacionOutput = z
  .object({
    title: z.string().trim().min(1).max(160),
    body: z.string().trim().min(1),
    notificationSummary: z.string().trim().min(1).max(280),
    /** Datos críticos que faltan. Que los pida es mejor que que los invente. */
    missingInformation: z.array(z.string()),
    qualityFlags: z.array(z.string()),
    assumptions: z.array(z.string()).max(0),
  })
  .strict();

const OPERATIONS: Record<OperationKey, OperationDefinition> = {
  "comunicaciones-redactar": {
    key: "comunicaciones-redactar",
    version: 1,
    modulo: "comunicaciones",
    label: "Redactar borrador de comunicación",
    description:
      "A partir del propósito, los hechos y el tono que escribe el administrador, propone título, cuerpo y resumen para notificación. No decide audiencia ni publica.",
    flag: "ai-communications-draft",
    allowedRoles: ADMIN_ROLES,
    input: redactarComunicacionInput,
    output: redactarComunicacionOutput,
    // Primeros números, puestos para que existan: son la previsión de costo por
    // acción antes de tener una sola medición. Se revisan con la evaluación
    // offline del Paso 2.4, que es cuando habrá con qué corregirlos.
    limits: { maxInputChars: 4000, timeoutMs: 20_000, maxOutputTokens: 1500 },
  },
};

export const OPERATION_KEYS = Object.keys(OPERATIONS) as OperationKey[];

/** `null` si la clave no está en el catálogo. No lanza: decide el llamador. */
export function findOperation(key: unknown): OperationDefinition | null {
  if (typeof key !== "string") return null;
  return Object.prototype.hasOwnProperty.call(OPERATIONS, key)
    ? OPERATIONS[key as OperationKey]
    : null;
}

export type InputValidation =
  | { ok: true; input: unknown }
  | { ok: false; reason: "entrada_demasiado_grande" | "entrada_invalida"; detail: string };

/**
 * Valida la entrada contra el esquema de la operación.
 *
 * Se llama **después** de autorizar, nunca antes: a quien no tiene permiso no
 * se le dice si su carga útil era válida.
 *
 * El tope de tamaño va primero porque es la comprobación que protege de una
 * entrada absurda sin recorrerla entera.
 */
export function validateOperationInput(operation: OperationDefinition, raw: unknown): InputValidation {
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
