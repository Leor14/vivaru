import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { callableCorsOrigins } from "../http-config";
import { resolveFeatureFlag } from "../feature-flags";
import { authorizeGatewayCall, conjuntoPedido, type GatewayMembership } from "./authorize";
import { findOperation } from "./catalog";
import { ejecutarOperacionAutorizada, type EjecucionOutcome, type OperationOutcomeCode } from "./ejecucion";
import type { AiProvider } from "./provider";

/**
 * Punto de entrada único de las operaciones asistidas (Pasos 1.2 a 1.7 de
 * `docs/hoja-de-ruta-ia.md`).
 *
 * Una sola puerta, y todo lo asistido pasa por ella. Hoy Vivaru tiene cuarenta
 * y una callables y cada una se acuerda por su cuenta de comprobar quién llama
 * y de qué conjunto es: funciona, pero la seguridad depende de que cada una se
 * acuerde. Aquí las comprobaciones ocurren una vez, en un sitio, y se prueban.
 *
 * **Todo el camino vive en `runGateway`, no en el callable.** Hasta el Paso 1.7
 * el cobro de cuota, la llamada al proveedor y la telemetría estaban dentro de
 * `onCall`, donde ninguna prueba llega: cada pieza estaba probada y la costura
 * entre ellas no. `aiInvoke` es ahora una cáscara que traduce el resultado a
 * `HttpsError` y nada más.
 *
 * El proveedor sigue siendo simulado; falta escribir el adaptador real.
 */

/** Bandera que apaga la puerta entera sin desplegar. */
const GATEWAY_FLAG = "ai-gateway" as const;

/**
 * Bandera de modo monitor de App Check. Encendida (el default), una llamada sin
 * token de App Check pasa y queda registrada; apagada, se rechaza.
 *
 * Está en positivo —«modo monitor encendido»— y no en negativo —«exigir App
 * Check»— por el kill switch: el maestro apaga todas las banderas, y si la
 * bandera dijera «exigir», apagarlo todo relajaría una comprobación de
 * seguridad. Así, apagarlo todo la endurece.
 */
const APP_CHECK_MONITOR_FLAG = "operacion-app-check-monitor" as const;

interface GatewayPayload {
  operationKey?: string;
  input?: unknown;
}

/**
 * Códigos y resultado de la puerta.
 *
 * Viven en `ejecucion.ts` desde la Fase 4 y se reexportan aquí con su nombre de
 * siempre: la forma no cambió, cambió quién la define. Lo que llama a la puerta
 * —`pqrs-gateway.ts`, las pruebas, el callable— no se entera.
 */
export type GatewayOutcomeCode = OperationOutcomeCode;
export type GatewayOutcome = EjecucionOutcome;

/**
 * Lo que devuelve un armador de entrada: la entrada lista, o un fallo con el
 * código que la puerta debe traducir.
 */
export type InputResolution =
  | { ok: true; input: unknown }
  | { ok: false; code: GatewayOutcomeCode; message: string; reason: string };

export interface GatewayDeps {
  /** Inyectable para poder provocar fallos del proveedor en las pruebas. */
  provider?: AiProvider;
  now?: Date;
  /**
   * Arma la entrada en el SERVIDOR, ignorando la que mandó el cliente.
   *
   * Existe para `pqrs-asistir`, cuyo esquema lleva escrito que la puebla el
   * servidor: el navegador manda un `ticketId` y nada más. Sin esto, la pantalla
   * tendría que afirmar `mensaje`, `historial` y —lo que importa— `variante`, y
   * `variante` es lo que decide la puerta dura de `buzon_simple`. Un cliente que
   * mintiera ahí recibiría clasificación donde el contrato de producto dice que
   * no debe haberla: la puerta dura la estaría decidiendo el navegador.
   *
   * Se llama **después de autorizar y antes de cobrar cuota**. Después de
   * autorizar porque leer el ticket de quien no tiene permiso es trabajo que no
   * se le debe; antes de cobrar porque si el ticket no existe no hay nada que
   * devolver — cobrar y reembolsar deja una ventana peor que un `get` de más.
   */
  resolveInput?: (contexto: { tenantId: string; uid: string }) => Promise<InputResolution>;
}

export interface GatewayRequest {
  app?: unknown;
  auth?: { uid?: string; token?: Record<string, unknown> };
  data?: unknown;
}

export async function runGateway(request: GatewayRequest, deps: GatewayDeps = {}): Promise<GatewayOutcome> {
  const db = getFirestore();
  const now = deps.now ?? new Date();

  const uid = typeof request.auth?.uid === "string" ? request.auth.uid : undefined;
  const claims = request.auth?.token;

  // Buscar la operación en el catálogo NO es confiar en el cliente: la clave es
  // una etiqueta para consultar una tabla estática, no una autoridad. El rol
  // sigue saliendo de la membresía, y el conjunto se comprueba contra ella.
  const payload = (request.data ?? {}) as GatewayPayload;
  const operation = findOperation(payload.operationKey);

  /**
   * **El conjunto sobre el que se trabaja, no el del claim** (`PLAT-002` §7.4).
   *
   * Sale de `conjuntoPedido`, que es la MISMA función que usa la decisión. No
   * es ceremonia: aquí se leen la membresía y las tres banderas, y si este
   * fichero dedujera el conjunto por su cuenta bastaría con que uno de los dos
   * cambiara para autorizar un conjunto y leer las banderas de otro — sin error
   * y sin síntoma.
   *
   * Que el conjunto venga del cuerpo no concede nada: la membresía se lee de
   * ESE conjunto, así que pedir uno ajeno devuelve `sin_membresia`.
   */
  const tenantSolicitado = conjuntoPedido({ appCheckPresent: request.app != null, uid, claims, data: request.data });

  // Todo lo que necesita la decisión, pedido a la vez.
  const [membershipSnap, gateway, appCheckMonitor, operationFlag] = await Promise.all([
    uid && tenantSolicitado
      ? db.collection("tenantUsers").doc(`${tenantSolicitado}_${uid}`).get()
      : Promise.resolve(null),
    resolveFeatureFlag(GATEWAY_FLAG, tenantSolicitado),
    resolveFeatureFlag(APP_CHECK_MONITOR_FLAG, tenantSolicitado),
    operation ? resolveFeatureFlag(operation.flag, tenantSolicitado) : Promise.resolve(null),
  ]);

  const membership: GatewayMembership | null =
    membershipSnap && membershipSnap.exists ? (membershipSnap.data() as GatewayMembership) : null;

  const appCheckPresent = request.app != null;

  const decision = authorizeGatewayCall(
    { appCheckPresent, uid, claims, data: request.data },
    {
      membership,
      gatewayEnabled: gateway.enabled,
      appCheckMonitor: appCheckMonitor.enabled,
      operation,
      operationFlagEnabled: operationFlag?.enabled ?? false,
    },
  );

  // Modo monitor: la llamada pasa, pero queda el rastro. Es lo que hay que
  // mirar antes de apagar el modo monitor — si el tráfico legítimo no trae
  // token, exigirlo cierra la puerta para todos.
  if (!appCheckPresent && appCheckMonitor.enabled) {
    logger.info("ai-gateway: llamada sin App Check (modo monitor)", {
      uid,
      // El solicitado: este rastro se escribe ANTES de saber si se concede, y
      // decir el concedido aquí obligaría a no registrar los rechazos, que son
      // justo los que hay que mirar antes de apagar el modo monitor.
      tenantId: tenantSolicitado,
      permitida: decision.ok,
    });
  }

  if (!decision.ok) {
    logger.warn("ai-gateway: rechazada", { reason: decision.reason, uid });
    return { ok: false, code: decision.code, message: decision.message, reason: decision.reason };
  }

  // A partir de aquí `tenantId` es el CONCEDIDO, no el solicitado: sale de la
  // decisión, que solo lo devuelve tras comprobar la membresía en él. Es el
  // único que toca los contadores de cuota y la telemetría.
  //
  // Este comentario decía «es SIEMPRE el de la sesión, lo que mandara el
  // cliente ya provocó un rechazo mucho antes». Dejó de ser cierto con el
  // selector de conjunto: ahora el cliente SÍ dice cuál, y lo que lo hace
  // seguro es la membresía, no el rechazo.
  const { operation: op, tenantId, uid: actorUid } = decision;

  // Hay operaciones cuya entrada NO la manda el cliente: la arma el servidor a
  // partir de un identificador. Cuando hay armador, lo que viniera en
  // `payload.input` se descarta entero — no se mezcla, porque mezclar dejaría
  // que el cliente colara justo el campo que el servidor quería decidir.
  let entradaCruda: unknown = payload.input;
  if (deps.resolveInput) {
    const resuelta = await deps.resolveInput({ tenantId, uid: actorUid });
    if (!resuelta.ok) {
      logger.warn("ai-gateway: entrada no resuelta", {
        reason: resuelta.reason,
        operationKey: op.key,
        tenantId,
      });
      return { ok: false, code: resuelta.code, message: resuelta.message, reason: resuelta.reason };
    }
    entradaCruda = resuelta.input;
  }

  // A partir de aquí la puerta ya hizo su trabajo. Todo lo que sigue —validar,
  // cobrar, ejecutar y contarlo— es idéntico venga de una sesión o de la sombra
  // de la Fase 4, y por eso vive en un módulo aparte desde entonces.
  return ejecutarOperacionAutorizada({
    operation: op,
    tenantId,
    // Una persona con sesión sí tiene tope por usuario: es lo que impide que un
    // administrador se coma solo la cuota del conjunto.
    actor: { uid: actorUid, topeDeUsuario: true },
    entradaCruda,
    now,
    provider: deps.provider,
  });
}

export const aiInvoke = onCall<GatewayPayload>(
  {
    cors: callableCorsOrigins,
    // A propósito en `false`: el rechazo lo decide la bandera de modo monitor,
    // que se cambia desde Firestore. Con `true` aquí, pasar de monitor a
    // exigir requeriría desplegar — justo lo que el Paso 1.1 vino a evitar.
    enforceAppCheck: false,
  },
  async (request) => {
    const outcome = await runGateway({
      app: request.app,
      auth: request.auth ? { uid: request.auth.uid, token: request.auth.token as Record<string, unknown> } : undefined,
      data: request.data,
    });

    if (!outcome.ok) throw new HttpsError(outcome.code, outcome.message);

    return {
      operationKey: outcome.operationKey,
      version: outcome.version,
      output: outcome.output,
      cuotaRestante: outcome.cuotaRestante,
    };
  },
);
