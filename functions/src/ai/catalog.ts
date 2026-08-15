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

/**
 * Cuotas de la operación (Paso 1.6).
 *
 * No son solo control de costo: **el límite de inversión de Google es de la
 * cuenta entera, no por conjunto.** Sin esto, un conjunto que se desboque se
 * come el presupuesto y deja sin capacidad asistida a todos los demás. Es
 * aislamiento entre conjuntos antes que ahorro.
 *
 * Dos ventanas por conjunto —día y mes— porque resuelven cosas distintas: la
 * mensual ata el gasto al presupuesto, la diaria impide que se consuma el mes
 * entero en una tarde.
 */
export interface OperationQuota {
  perTenantDay: number;
  perTenantMonth: number;
  /** Impide que un solo usuario agote lo del conjunto. */
  perUserDay: number;
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
  /**
   * La operación quiere saber cómo es el conjunto —hoy, si tiene torres— y la
   * plataforma lo resuelve del servidor antes de llamar al modelo. Ver
   * `tenant-context.ts`.
   *
   * **Va aquí y no en el esquema de entrada porque no lo escribe nadie.** La
   * entrada sigue siendo lo que teclea el administrador; esto es lo que Vivaru
   * ya sabe y no debería volver a preguntarle. Separarlos es lo que permite
   * seguir diciendo que el cliente no afirma nada sobre su conjunto.
   */
  contextoDelConjunto?: boolean;
  input: z.ZodType;
  output: z.ZodType;
  limits: OperationLimits;
  quota: OperationQuota;
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
 * Los cuatro datos que un residente busca en un aviso, más una salida para todo
 * lo demás.
 *
 * **No es una taxonomía inventada:** sale de medir los 71 avisos operativos del
 * corpus vecinal. Faltan, respectivamente, en el 57%, el 95%, el 48% y el 84%
 * de los avisos reales (`datasets/linea-base/hipotesis-de-valor.md`). Y el
 * modelo converge solo a esta misma lista sin que ningún prompt se la enseñe,
 * que es el hallazgo más fuerte del Paso 2.4.
 *
 * `otro` no es pereza: sin escape, el modelo tendría que forzar dentro de una
 * de las cuatro cosas que no lo son —un monto, un teléfono— y una categoría
 * mal puesta es peor que ninguna. En la corrida del 12 de agosto pidió montos
 * y fechas de vencimiento, así que el caso existe de verdad.
 */
export const CATEGORIAS_DATO_FALTANTE = ["duracion", "fecha", "alcance", "accion", "otro"] as const;

export type CategoriaDatoFaltante = (typeof CATEGORIAS_DATO_FALTANTE)[number];

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
    /**
     * Datos críticos que faltan. Que los pida es mejor que que los invente.
     *
     * **Va categorizado, y esa es la razón de que la operación sea v2.** La
     * interfaz del Paso 2.5 tiene que poner «cuánto dura» arriba del todo —es
     * el dato que falta el 95% de las veces— y con una lista de frases sueltas
     * eso solo se puede hacer buscando palabras. La lectura del 2.4 documenta
     * dos veces lo que cuesta: «cuando una afirmación busca palabras exactas
     * sobre texto libre, mide al que la escribió». El calificador cayó en ello
     * dos veces en un día; la interfaz caería igual.
     *
     * La descripción de `categoria` no está de adorno: viaja al modelo dentro
     * del esquema vía `z.toJSONSchema` (Paso 1.4-real), así que las categorías
     * se explican **sin tocar ningún prompt de tarea** — que es lo que permite
     * que la comparación entre v1, v2 y v3 siga midiendo lo mismo.
     */
    missingInformation: z.array(
      z
        .object({
          categoria: z
            .enum(CATEGORIAS_DATO_FALTANTE)
            .describe(
              "duracion = cuánto dura o hasta cuándo; fecha = cuándo ocurre; alcance = a qué torres, zonas o unidades afecta; accion = qué debe hacer el residente; otro = cualquier otro dato que falte. Estas categorías NO son la lista de lo que hay que preguntar: si falta un dato importante que no encaja en ninguna de las cuatro primeras, pídelo igualmente con la categoría `otro`.",
            ),
          detalle: z
            .string()
            .trim()
            .min(1)
            .max(200)
            .describe("La pregunta concreta, en español, tal y como se le mostraría al administrador."),
        })
        .strict(),
    ),
    qualityFlags: z.array(z.string()),
    assumptions: z.array(z.string()).max(0),
  })
  .strict();

const OPERATIONS: Record<OperationKey, OperationDefinition> = {
  "comunicaciones-redactar": {
    key: "comunicaciones-redactar",
    // v2 (12 de agosto de 2026): `missingInformation` pasó de lista de frases a
    // lista categorizada. La ENTRADA no cambió, y eso es deliberado: los 59
    // casos del conjunto de evaluación siguen valiendo enteros, así que el
    // cambio de forma se puede medir contra las corridas anteriores en vez de
    // empezar de cero.
    //
    // v3 (14 de agosto de 2026): la operación recibe contexto del conjunto.
    // **Ningún esquema cambió** —el cliente manda exactamente los mismos tres
    // campos—, y aun así sube de versión: lo que llega al modelo YA NO ES LO
    // MISMO, y la versión es lo que permite que la telemetría y el conjunto de
    // evaluación distingan una corrida de otra. Dejarla en 2 haría que dos
    // números incomparables se leyeran como la misma serie, que es exactamente
    // el error que el contrato v2 documentó el 12 de agosto.
    version: 3,
    modulo: "comunicaciones",
    label: "Redactar borrador de comunicación",
    description:
      "A partir del propósito, los hechos y el tono que escribe el administrador, propone título, cuerpo y resumen para notificación. No decide audiencia ni publica.",
    flag: "ai-communications-draft",
    allowedRoles: ADMIN_ROLES,
    contextoDelConjunto: true,
    input: redactarComunicacionInput,
    output: redactarComunicacionOutput,
    // Primeros números, puestos para que existan: son la previsión de costo por
    // acción antes de tener una sola medición. Se revisan con la evaluación
    // offline del Paso 2.4, que es cuando habrá con qué corregirlos.
    limits: { maxInputChars: 4000, timeoutMs: 20_000, maxOutputTokens: 1500 },
    // Atados al presupuesto real, no puestos a ojo: en el peor caso una llamada
    // cuesta USD 0,0025, así que 300 al mes son USD 0,75 por conjunto. Con el
    // tope de 80.000 COP (~USD 20) caben unos 25 conjuntos antes de rozarlo.
    // La línea base del Paso 2 son 10-15 comunicaciones en total, así que las
    // 50 diarias no las va a tocar nadie: están para atrapar un bucle, no para
    // molestar a un administrador.
    quota: { perTenantDay: 50, perTenantMonth: 300, perUserDay: 20 },
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
