import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { callableCorsOrigins } from "../http-config";
import { resolveFeatureFlag } from "../feature-flags";
import { authorizeGatewayCall, type GatewayMembership } from "./authorize";
import { findOperation, validateOperationInput } from "./catalog";
import { executeOperation } from "./execute";
import { resolveProvider, type AiProvider } from "./provider";
import { consumeQuota, refundQuota, type QuotaRemaining } from "./quota";
import { recordAiUsage } from "./usage";

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

/** Códigos que sabe devolver la puerta, incluidos los de ejecución. */
export type GatewayOutcomeCode =
  | "unauthenticated"
  | "permission-denied"
  | "invalid-argument"
  | "failed-precondition"
  | "unimplemented"
  | "resource-exhausted"
  | "deadline-exceeded"
  | "unavailable"
  | "internal";

export type GatewayOutcome =
  | {
      ok: true;
      operationKey: string;
      version: number;
      output: unknown;
      /** Lo que le queda al conjunto y al usuario después de esta llamada. */
      cuotaRestante: QuotaRemaining;
    }
  | {
      ok: false;
      code: GatewayOutcomeCode;
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

export interface GatewayDeps {
  /** Inyectable para poder provocar fallos del proveedor en las pruebas. */
  provider?: AiProvider;
  now?: Date;
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
  const claimTenantId = typeof claims?.tenantId === "string" ? claims.tenantId : undefined;

  // Buscar la operación en el catálogo NO es confiar en el cliente: la clave es
  // una etiqueta para consultar una tabla estática, no una autoridad. Todo lo
  // que decide permisos —conjunto, rol— sigue saliendo de la sesión.
  const payload = (request.data ?? {}) as GatewayPayload;
  const operation = findOperation(payload.operationKey);

  // Todo lo que necesita la decisión, pedido a la vez.
  const [membershipSnap, gateway, appCheckMonitor, operationFlag] = await Promise.all([
    uid && claimTenantId
      ? db.collection("tenantUsers").doc(`${claimTenantId}_${uid}`).get()
      : Promise.resolve(null),
    resolveFeatureFlag(GATEWAY_FLAG, claimTenantId),
    resolveFeatureFlag(APP_CHECK_MONITOR_FLAG, claimTenantId),
    operation ? resolveFeatureFlag(operation.flag, claimTenantId) : Promise.resolve(null),
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
      tenantId: claimTenantId,
      permitida: decision.ok,
    });
  }

  if (!decision.ok) {
    logger.warn("ai-gateway: rechazada", { reason: decision.reason, uid });
    return { ok: false, code: decision.code, message: decision.message, reason: decision.reason };
  }

  // A partir de aquí, `tenantId` es SIEMPRE el de la sesión. Es el único que
  // toca los contadores de cuota y la telemetría — lo que mandara el cliente ya
  // provocó un rechazo mucho antes.
  const { operation: op, tenantId, uid: actorUid } = decision;

  // La entrada se valida DESPUÉS de autorizar, nunca antes: a quien no tiene
  // permiso no se le dice si su carga útil era válida.
  const validation = validateOperationInput(op, payload.input);
  if (!validation.ok) {
    logger.warn("ai-gateway: entrada rechazada", { reason: validation.reason, operationKey: op.key, tenantId });
    return { ok: false, code: "invalid-argument", message: validation.detail, reason: validation.reason };
  }

  // La cuota se cobra ANTES de llamar al proveedor. Cobrarla después dejaría
  // una ventana en la que dos peticiones simultáneas pasan las dos.
  const cuota = await consumeQuota(op, tenantId, actorUid, now);
  if (!cuota.ok) {
    logger.info("ai-gateway: cuota agotada", { operationKey: op.key, tenantId, excedida: cuota.excedida });
    return { ok: false, code: "resource-exhausted", message: cuota.message, reason: cuota.excedida };
  }

  const provider = deps.provider ?? resolveProvider(op);
  const resultado = await executeOperation(op, validation.input, provider);

  // Se devuelve solo si el proveedor no llegó a responder. Si respondió y su
  // salida incumplió el contrato, los tokens se gastaron y la cuota se queda
  // consumida — devolverla sería mentir sobre el costo.
  if (!resultado.ok && (resultado.reason === "proveedor_error" || resultado.reason === "proveedor_no_responde")) {
    await refundQuota(op, tenantId, actorUid, now);
  }

  // Se registra pase lo que pase. Un fallo ya consumió tokens, y la tasa de
  // fallo es la métrica que dice si esto sirve. Nunca lanza: si la telemetría
  // no se puede escribir, el administrador se queda igual con su borrador.
  await recordAiUsage({
    tenantId,
    uid: actorUid,
    operationKey: op.key,
    operationVersion: op.version,
    provider: provider.name,
    model: resultado.ok ? resultado.usage.model : provider.name,
    promptVersion: resultado.ok ? resultado.usage.promptVersion : "n/a",
    inputTokens: resultado.ok ? resultado.usage.inputTokens : 0,
    outputTokens: resultado.ok ? resultado.usage.outputTokens : 0,
    latencyMs: resultado.latencyMs,
    outcome: resultado.ok ? "ok" : resultado.reason,
  });

  if (!resultado.ok) {
    logger.warn("ai-gateway: operación fallida", {
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

  logger.info("ai-gateway: operación ejecutada", {
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
    // Es lo que necesita la pantalla del Paso 2 para deshabilitar el botón
    // antes de que alguien choque contra el tope, en vez de después.
    cuotaRestante: cuota.restante,
  };
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
