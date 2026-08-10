import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { callableCorsOrigins } from "../http-config";
import { resolveFeatureFlag } from "../feature-flags";
import {
  authorizeGatewayCall,
  type GatewayDecision,
  type GatewayMembership,
} from "./authorize";
import { findOperation, validateOperationInput, type InputValidation } from "./catalog";
import { executeOperation, type ExecutionFailureReason } from "./execute";
import { resolveProvider } from "./provider";

/**
 * Punto de entrada único de las operaciones asistidas (Paso 1.2 de
 * `docs/hoja-de-ruta-ia.md`, ampliado con el catálogo en el 1.3).
 *
 * Una sola puerta, y todo lo asistido pasa por ella. Hoy Vivaru tiene cuarenta
 * y una callables y cada una se acuerda por su cuenta de comprobar quién llama
 * y de qué conjunto es: funciona, pero la seguridad depende de que cada una se
 * acuerde. Aquí las comprobaciones ocurren una vez, en un sitio, y se prueban.
 *
 * **El proveedor es simulado todavía** (`stubAiProvider`): la llamada real a
 * Vertex AI espera la región y el tope de gasto, que son decisiones del Paso 0.
 * Lo que sí es real y definitivo es el validador de salida — ver `execute.ts`.
 */

/** Cada forma de fallar tiene su código; las cuatro llevan al camino manual. */
const CODIGO_POR_FALLO: Record<ExecutionFailureReason, "deadline-exceeded" | "unavailable" | "internal"> = {
  proveedor_no_responde: "deadline-exceeded",
  proveedor_error: "unavailable",
  salida_ilegible: "internal",
  salida_incumple_contrato: "internal",
};

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

export interface GatewayOutcome {
  decision: GatewayDecision;
  /** Solo cuando la decisión concedió. La entrada ya parseada por Zod. */
  validation?: InputValidation;
}

export async function runGateway(request: {
  app?: unknown;
  auth?: { uid?: string; token?: Record<string, unknown> };
  data?: unknown;
}): Promise<GatewayOutcome> {
  const db = getFirestore();

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

  if (!decision.ok) return { decision };

  // La entrada se valida DESPUÉS de autorizar, nunca antes: a quien no tiene
  // permiso no se le dice si su carga útil era válida.
  return { decision, validation: validateOperationInput(decision.operation, payload.input) };
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
    const { decision, validation } = await runGateway({
      app: request.app,
      auth: request.auth ? { uid: request.auth.uid, token: request.auth.token as Record<string, unknown> } : undefined,
      data: request.data,
    });

    if (!decision.ok) {
      logger.warn("ai-gateway: rechazada", { reason: decision.reason, uid: request.auth?.uid });
      throw new HttpsError(decision.code, decision.message);
    }

    if (!validation || !validation.ok) {
      logger.warn("ai-gateway: entrada rechazada", {
        reason: validation?.reason ?? "sin_validacion",
        operationKey: decision.operation.key,
        tenantId: decision.tenantId,
      });
      throw new HttpsError("invalid-argument", validation?.detail ?? "La información enviada no es válida.");
    }

    const operation = decision.operation;
    const resultado = await executeOperation(operation, validation.input, resolveProvider(operation));

    // Los metadatos se registran aquí de momento. El Paso 1.5 los lleva a una
    // colección para poder responder «cuánto gastó este conjunto este mes»
    // mirando datos en vez de estimando.
    logger.info("ai-gateway: operación ejecutada", {
      operationKey: operation.key,
      version: operation.version,
      tenantId: decision.tenantId,
      ok: resultado.ok,
      latencyMs: resultado.latencyMs,
      ...(resultado.ok ? { usage: resultado.usage } : { reason: resultado.reason, detail: resultado.detail }),
    });

    if (!resultado.ok) {
      throw new HttpsError(CODIGO_POR_FALLO[resultado.reason], resultado.message);
    }

    return {
      operationKey: operation.key,
      version: operation.version,
      output: resultado.output,
    };
  },
);
