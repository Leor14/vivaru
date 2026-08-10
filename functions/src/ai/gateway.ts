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

/**
 * Punto de entrada único de las operaciones asistidas (Paso 1.2 de
 * `docs/hoja-de-ruta-ia.md`).
 *
 * Una sola puerta, y todo lo asistido pasa por ella. Hoy Vivaru tiene cuarenta
 * y una callables y cada una se acuerda por su cuenta de comprobar quién llama
 * y de qué conjunto es: funciona, pero la seguridad depende de que cada una se
 * acuerde. Aquí las comprobaciones ocurren una vez, en un sitio, y se prueban.
 *
 * **Todavía no llama a ningún modelo.** Al terminar el paso hay una puerta que
 * abre y rechaza bien, sin nada detrás. Lo de detrás es el Paso 1.3.
 */

/**
 * Operaciones que existen. Vacío hasta el Paso 1.3, que trae el catálogo con su
 * versión, esquemas, permisos y límites. Mientras esté vacío la puerta abre y
 * responde `unimplemented`, que es la verdad.
 */
export const KNOWN_OPERATIONS: ReadonlySet<string> = new Set<string>();

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

export async function runGateway(request: {
  app?: unknown;
  auth?: { uid?: string; token?: Record<string, unknown> };
  data?: unknown;
}): Promise<{ decision: GatewayDecision }> {
  const db = getFirestore();

  const uid = typeof request.auth?.uid === "string" ? request.auth.uid : undefined;
  const claims = request.auth?.token;
  const claimTenantId = typeof claims?.tenantId === "string" ? claims.tenantId : undefined;

  // Todo lo que necesita la decisión, pedido a la vez. El conjunto para leer la
  // membresía y los overrides sale de los claims, nunca de `request.data`.
  const [membershipSnap, gateway, appCheckMonitor] = await Promise.all([
    uid && claimTenantId
      ? db.collection("tenantUsers").doc(`${claimTenantId}_${uid}`).get()
      : Promise.resolve(null),
    resolveFeatureFlag(GATEWAY_FLAG, claimTenantId),
    resolveFeatureFlag(APP_CHECK_MONITOR_FLAG, claimTenantId),
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
      knownOperations: KNOWN_OPERATIONS,
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

  return { decision };
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
    const { decision } = await runGateway({
      app: request.app,
      auth: request.auth ? { uid: request.auth.uid, token: request.auth.token as Record<string, unknown> } : undefined,
      data: request.data,
    });

    if (!decision.ok) {
      logger.warn("ai-gateway: rechazada", { reason: decision.reason, uid: request.auth?.uid });
      throw new HttpsError(decision.code, decision.message);
    }

    // Inalcanzable mientras KNOWN_OPERATIONS esté vacío. El Paso 1.3 pone aquí
    // la búsqueda en el catálogo y la validación de entrada.
    throw new HttpsError("unimplemented", "Esa operación no existe.");
  },
);
