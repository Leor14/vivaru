import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { callableCorsOrigins } from "../http-config";
import {
  RegistroInvalido,
  normalizarRegistro,
  registrarImportacionEn,
} from "./telemetria";

/**
 * Callable que registra un intento de importación (`PRD-V-FEAT-002`, `CA-13`).
 *
 * **Es best-effort de punta a punta.** Si esto falla, la importación ya ocurrió
 * y enseñarle un error a la persona sería mentirle sobre lo que pasó con sus
 * datos. Se registra el fallo en los logs y se sigue — misma decisión que tomó
 * el registro de feedback del canario.
 *
 * **Ojo al desplegar:** una callable nueva nace **sin permiso de invocación** en
 * Cloud Run y el síntoma es un «error interno» sin ninguna pista. Hay que
 * comprobarlo después del despliegue; está escrito en `docs/pendientes.md` y ya
 * costó una tarde con `aiInvoke`.
 */
export const registrarImportacion = onCall(
  { cors: callableCorsOrigins, memory: "256MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    // El conjunto sale de la sesión, nunca del cuerpo: si el navegador pudiera
    // decir a qué conjunto pertenece la medición, podría atribuirle intentos a
    // otro. Es la misma regla que la puerta de IA.
    const claims = request.auth?.token as Record<string, unknown> | undefined;
    const tenantId = typeof claims?.tenantId === "string" ? claims.tenantId : "";
    const role = claims?.role;

    if (!tenantId && role !== "superadmin") {
      throw new HttpsError("permission-denied", "Tu sesión no pertenece a ningún conjunto.");
    }

    try {
      const registro = normalizarRegistro(request.data);
      await registrarImportacionEn(getFirestore(), tenantId, uid, registro);
      return { ok: true };
    } catch (error) {
      if (error instanceof RegistroInvalido) {
        throw new HttpsError("invalid-argument", error.message);
      }
      logger.error("registrarImportacion: no se pudo registrar", {
        uid,
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      // No se propaga: la importación ya pasó y el registro es secundario.
      return { ok: false };
    }
  },
);
