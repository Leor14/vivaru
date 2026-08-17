import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

import { validateOperationInput, type FraseMarcada, type OperationDefinition } from "./catalog";
import { executeOperation } from "./execute";
import { resolveProvider, type AiProvider } from "./provider";
import { consumeQuota, refundQuota, type QuotaRemaining } from "./quota";
import { resolverContextoConjunto } from "./tenant-context";
import { recordAiUsage } from "./usage";

/**
 * El tramo de una operación asistida que va **después de autorizar**: validar la
 * entrada, cobrar cuota, resolver proveedor y contexto, ejecutar, y contarlo.
 *
 * ## Por qué existe (Fase 4 de `PRD-VAI-FEAT-002`)
 *
 * Hasta la sombra, todo lo asistido lo pedía una persona con sesión, así que
 * `runGateway` podía hacer dos trabajos pegados sin que se notara: «¿este
 * llamante puede?» y «ejecutar la operación y contarlo». La sombra rompe eso —
 * la dispara la creación de un ticket, no un administrador: no hay `uid`, ni
 * claims, ni membresía en `tenantUsers`, ni App Check. **Nada de lo que la
 * puerta comprueba existe.**
 *
 * De las tres salidas posibles se eligió esta, y las otras dos merecen quedar
 * escritas porque volverán a parecer buenas:
 *
 *  · **Fabricar un usuario falso** y pasarlo por la puerta era lo más corto, y
 *    el peor: falsear una membresía es exactamente lo que `authorize.ts` existe
 *    para impedir. Una excepción ahí deja de ser una puerta.
 *  · **Un camino propio** que llamara a `executeOperation` directo duplicaría
 *    cuota, validación, revisión de salida y telemetría. Dos copias de la parte
 *    que cuesta dinero divergen; es cuestión de meses.
 *  · **Extraer el tramo común** — esto. Un solo camino de ejecución y dos
 *    puertas, porque los llamantes de verdad son distintos: una persona con
 *    sesión (`runGateway`), y el servidor consigo mismo (`sombra-pqrs.ts`).
 *
 * **El contrato de este módulo es que la autorización YA ocurrió.** No comprueba
 * banderas, ni roles, ni conjunto: recibe un `tenantId` que quien llama tuvo que
 * resolver por su cuenta y del que se hace responsable. Quien lo use sin
 * autorizar antes abre un agujero, y por eso el nombre lo dice.
 */

/** Códigos que sabe devolver la ejecución de una operación. */
export type OperationOutcomeCode =
  | "unauthenticated"
  | "permission-denied"
  | "invalid-argument"
  | "failed-precondition"
  | "unimplemented"
  | "resource-exhausted"
  | "deadline-exceeded"
  | "unavailable"
  | "internal";

export type EjecucionOutcome =
  | {
      ok: true;
      operationKey: string;
      version: number;
      output: unknown;
      /**
       * Con qué proveedor se generó de verdad esta salida.
       *
       * No es telemetría de adorno: `ia-proveedor-real` apagada devuelve el
       * simulador, y una salida simulada guardada como si fuera del modelo
       * envenena cualquier conjunto de evaluación que la recoja. Quien persista
       * una salida tiene que poder decir de dónde vino **sin fiarse de que la
       * bandera estuviera bien puesta en ese momento.**
       */
      proveedor: string;
      /** Lo que le queda al conjunto y al usuario después de esta llamada. */
      cuotaRestante: QuotaRemaining;
      /**
       * Los trozos que la revisión de contrato marcó, con su posición, para que
       * la pantalla pueda señalarlos dentro del texto. Vacío si no marcó nada, y
       * ausente en las operaciones que no revisan la salida.
       *
       * **No se registran en `aiUsage`** — ver `FraseMarcada` en el catálogo.
       */
      frasesMarcadas: readonly FraseMarcada[];
    }
  | {
      ok: false;
      code: OperationOutcomeCode;
      /** Lo que ve la persona. */
      message: string;
      /** Motivo interno, para logs y pruebas. Nunca se le enseña al usuario. */
      reason: string;
    };

/** Cada forma de fallar en la ejecución tiene su código. */
const CODIGO_POR_FALLO = {
  proveedor_no_responde: "deadline-exceeded",
  proveedor_error: "unavailable",
  salida_ilegible: "internal",
  salida_incumple_contrato: "internal",
} as const;

/**
 * Quién pidió esto, a efectos de cuota y telemetría.
 *
 * `topeDeUsuario: false` significa **que no hay usuario**, no que este tenga
 * privilegios: el porqué está en `OpcionesCuota` (`quota.ts`), junto al techo de
 * 20 tickets diarios que provocaría aplicárselo a la sombra.
 */
export interface ActorOperacion {
  /** Va a la cuota y a la fila de `aiUsage`. Para la sombra, `ACTOR_SOMBRA`. */
  uid: string;
  topeDeUsuario: boolean;
}

export interface EjecucionParams {
  /** Ya buscada en el catálogo por quien autorizó. */
  operation: OperationDefinition;
  /** **Resuelto y verificado por quien llama.** Este módulo se fía. */
  tenantId: string;
  actor: ActorOperacion;
  /** Sin validar todavía: se valida aquí, y solo después de autorizar. */
  entradaCruda: unknown;
  now: Date;
  /** Inyectable para poder provocar fallos del proveedor en las pruebas. */
  provider?: AiProvider;
}

export async function ejecutarOperacionAutorizada(params: EjecucionParams): Promise<EjecucionOutcome> {
  const { operation: op, tenantId, actor, entradaCruda, now } = params;
  const opcionesCuota = { topeDeUsuario: actor.topeDeUsuario };

  // La entrada se valida DESPUÉS de autorizar, nunca antes: a quien no tiene
  // permiso no se le dice si su carga útil era válida.
  const validation = validateOperationInput(op, entradaCruda);
  if (!validation.ok) {
    logger.warn("ai-ejecucion: entrada rechazada", { reason: validation.reason, operationKey: op.key, tenantId });
    return { ok: false, code: "invalid-argument", message: validation.detail, reason: validation.reason };
  }

  // La cuota se cobra ANTES de llamar al proveedor. Cobrarla después dejaría
  // una ventana en la que dos peticiones simultáneas pasan las dos.
  const cuota = await consumeQuota(op, tenantId, actor.uid, now, getFirestore(), opcionesCuota);
  if (!cuota.ok) {
    logger.info("ai-ejecucion: cuota agotada", { operationKey: op.key, tenantId, excedida: cuota.excedida });
    return { ok: false, code: "resource-exhausted", message: cuota.message, reason: cuota.excedida };
  }

  // El contexto se resuelve DESPUÉS de cobrar la cuota: a quien ya no le quedan
  // borradores no se le lee la colección de unidades. Y va en paralelo con el
  // proveedor porque no dependen el uno del otro.
  //
  // `resolverContextoConjunto` nunca lanza: si Firestore falla, devuelve «no se
  // sabe» y el borrador sale igual, preguntando como hoy.
  const [provider, contexto] = await Promise.all([
    params.provider ? Promise.resolve(params.provider) : resolveProvider(op, tenantId),
    op.contextoDelConjunto ? resolverContextoConjunto(getFirestore(), tenantId) : Promise.resolve({}),
  ]);

  // El `undefined` es la versión de prompt: producción usa siempre la activa del
  // catálogo. Solo la evaluación offline pasa otra.
  const resultado = await executeOperation(op, validation.input, provider, undefined, contexto);

  // Se devuelve solo si el proveedor no llegó a responder. Si respondió y su
  // salida incumplió el contrato, los tokens se gastaron y la cuota se queda
  // consumida — devolverla sería mentir sobre el costo.
  if (!resultado.ok && (resultado.reason === "proveedor_error" || resultado.reason === "proveedor_no_responde")) {
    await refundQuota(op, tenantId, actor.uid, now, getFirestore(), opcionesCuota);
  }

  // Se registra pase lo que pase. Un fallo ya consumió tokens, y la tasa de
  // fallo es la métrica que dice si esto sirve. Nunca lanza: si la telemetría
  // no se puede escribir, el administrador se queda igual con su borrador.
  await recordAiUsage({
    tenantId,
    // Para la sombra es `ACTOR_SOMBRA`, y ese es todo el mecanismo que separa su
    // gasto del de los administradores al contar la factura. No hace falta un
    // campo nuevo: la columna que ya existe distingue las dos cosas.
    uid: actor.uid,
    operationKey: op.key,
    operationVersion: op.version,
    provider: provider.name,
    model: resultado.ok ? resultado.usage.model : provider.name,
    promptVersion: resultado.ok ? resultado.usage.promptVersion : "n/a",
    inputTokens: resultado.ok ? resultado.usage.inputTokens : 0,
    outputTokens: resultado.ok ? resultado.usage.outputTokens : 0,
    latencyMs: resultado.latencyMs,
    outcome: resultado.ok ? "ok" : resultado.reason,
    // Qué corrigió la revisión de contrato, si corrigió algo. Va en la fila de
    // uso y no en un log porque **es una cifra que hay que contar**: cuántas
    // veces el borrador afirmó una acción es lo que dirá en la Fase 4 si la
    // comprobación sigue haciendo falta, y los logs no se cuentan.
    //
    // Va la CATEGORÍA y nunca `frasesMarcadas`: el trozo de borrador es texto
    // del conjunto, y lo que protege a esta colección es no tener un solo campo
    // libre donde pueda entrar. Esa frase va a la pantalla, no a la fila.
    ...(resultado.ok && resultado.marcas?.length ? { marcasDeRevision: resultado.marcas } : {}),
  });

  if (!resultado.ok) {
    logger.warn("ai-ejecucion: operación fallida", {
      operationKey: op.key,
      tenantId,
      reason: resultado.reason,
      detail: resultado.detail,
    });
    return {
      ok: false,
      code: CODIGO_POR_FALLO[resultado.reason],
      message: resultado.message,
      reason: resultado.reason,
    };
  }

  logger.info("ai-ejecucion: operación ejecutada", {
    operationKey: op.key,
    version: op.version,
    tenantId,
    latencyMs: resultado.latencyMs,
    usage: resultado.usage,
  });

  return {
    ok: true,
    operationKey: op.key,
    version: op.version,
    output: resultado.output,
    proveedor: provider.name,
    // Es lo que necesita la pantalla del Paso 2 para deshabilitar el botón
    // antes de que alguien choque contra el tope, en vez de después.
    cuotaRestante: cuota.restante,
    frasesMarcadas: resultado.frasesMarcadas ?? [],
  };
}
