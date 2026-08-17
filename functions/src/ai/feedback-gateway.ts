import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { callableCorsOrigins } from "../http-config";
import { resolveFeatureFlag } from "../feature-flags";
import { authorizeFeedbackCall, type GatewayMembership } from "./authorize";
import { findOperation } from "./catalog";
import { feedbackSchema, recordAiFeedback } from "./feedback";

/**
 * Registro de qué hizo la persona con el borrador (Paso 2.5).
 *
 * Vive en su propio archivo y no dentro de `gateway.ts` porque **no es la misma
 * puerta**: aquí no se invoca a ningún modelo, no se cobra cuota y no se gasta
 * un céntimo. Meterlo en el archivo que decide si se gasta dinero solo
 * conseguiría que revisar aquello fuese más caro.
 *
 * Igual que la puerta: todo el camino vive en `runFeedback`, y el callable es
 * una cáscara que traduce el resultado. Es lo que permite probar la costura
 * entera contra Firestore sin fabricar una sesión de `onCall`.
 */

const APP_CHECK_MONITOR_FLAG = "operacion-app-check-monitor" as const;

/**
 * Operaciones que producen feedback. Dejó de ser una sola en la Fase 3 de
 * `PRD-VAI-FEAT-002`.
 *
 * La clave llega del cliente y sirve **solo para consultar el catálogo**, que es
 * una tabla estática: de ahí salen los roles. Quien decide el conjunto y el
 * permiso sigue siendo la sesión, igual que en la puerta.
 */
const OPERACIONES_CON_FEEDBACK = ["comunicaciones-redactar", "pqrs-asistir"] as const;

export interface FeedbackRequest {
  app?: unknown;
  auth?: { uid?: string; token?: Record<string, unknown> };
  data?: unknown;
}

export type FeedbackOutcome =
  | { ok: true }
  | { ok: false; code: "unauthenticated" | "permission-denied" | "invalid-argument"; message: string; reason: string };

export async function runFeedback(request: FeedbackRequest): Promise<FeedbackOutcome> {
  const db = getFirestore();

  const uid = typeof request.auth?.uid === "string" ? request.auth.uid : undefined;
  const claims = request.auth?.token;
  const claimTenantId = typeof claims?.tenantId === "string" ? claims.tenantId : undefined;

  // Los roles salen del catálogo, no escritos a mano: quien puede pedir la
  // asistencia es quien puede contar qué hizo con ella. Si mañana cambian ahí,
  // cambian aquí solos.
  //
  // La clave se comprueba contra la lista de arriba ANTES de ir al catálogo: el
  // catálogo tiene operaciones que no producen feedback, y aceptar cualquiera
  // dejaría escribir filas de algo que esta puerta no sabe validar.
  const clave = (request.data as { operationKey?: unknown } | undefined)?.operationKey;
  const conocida = (OPERACIONES_CON_FEEDBACK as readonly string[]).includes(clave as string);
  const operacion = conocida ? findOperation(clave) : null;
  if (!operacion) {
    return { ok: false, code: "invalid-argument", message: "Esa operación no existe.", reason: "operacion_desconocida" };
  }

  const [membershipSnap, appCheckMonitor] = await Promise.all([
    uid && claimTenantId
      ? db.collection("tenantUsers").doc(`${claimTenantId}_${uid}`).get()
      : Promise.resolve(null),
    resolveFeatureFlag(APP_CHECK_MONITOR_FLAG, claimTenantId),
  ]);

  const membership: GatewayMembership | null =
    membershipSnap && membershipSnap.exists ? (membershipSnap.data() as GatewayMembership) : null;

  const decision = authorizeFeedbackCall(
    { appCheckPresent: request.app != null, uid, claims, data: request.data },
    { membership, appCheckMonitor: appCheckMonitor.enabled, allowedRoles: operacion.allowedRoles },
  );

  if (!decision.ok) {
    logger.warn("ai-feedback: rechazado", { reason: decision.reason, uid });
    return {
      ok: false,
      // La puerta puede devolver códigos que aquí no aplican; se normalizan a
      // los tres que este endpoint sabe producir.
      code:
        decision.code === "unauthenticated"
          ? "unauthenticated"
          : decision.code === "invalid-argument"
            ? "invalid-argument"
            : "permission-denied",
      message: decision.message,
      reason: decision.reason,
    };
  }

  // Se valida DESPUÉS de autorizar, misma regla que la puerta: a quien no tiene
  // permiso no se le dice si su carga útil era válida.
  const parsed = feedbackSchema.safeParse(request.data);
  if (!parsed.success) {
    logger.warn("ai-feedback: carga inválida", {
      tenantId: decision.tenantId,
      detail: parsed.error.issues[0]?.message,
    });
    return {
      ok: false,
      code: "invalid-argument",
      message: "No pudimos registrar tu actividad.",
      reason: "feedback_invalido",
    };
  }

  await recordAiFeedback({ ...parsed.data, tenantId: decision.tenantId, uid: decision.uid });
  return { ok: true };
}

export const registrarFeedbackIa = onCall<unknown>(
  {
    cors: callableCorsOrigins,
    // Mismo criterio que `aiInvoke`: lo decide la bandera de modo monitor, para
    // que pasar de observar a exigir no requiera desplegar.
    enforceAppCheck: false,
  },
  async (request) => {
    const outcome = await runFeedback({
      app: request.app,
      auth: request.auth ? { uid: request.auth.uid, token: request.auth.token as Record<string, unknown> } : undefined,
      data: request.data,
    });

    if (!outcome.ok) throw new HttpsError(outcome.code, outcome.message);
    return { ok: true as const };
  },
);
