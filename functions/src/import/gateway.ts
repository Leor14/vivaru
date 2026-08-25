import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { callableCorsOrigins } from "../http-config";
import { esMiembroDelConjunto } from "../tenant-membership";
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

    // **El conjunto se acepta del cuerpo, y se COMPRUEBA.** Este comentario
    // decía lo contrario —«sale de la sesión, nunca del cuerpo»— y era correcto
    // mientras el claim fuera el conjunto en el que se trabaja. Con el selector
    // de `PLAT-002` el claim pasó a significar «el último conjunto conocido»
    // (§7.4), así que confiar en él **atribuye la medición al conjunto
    // equivocado sin que nadie manipule nada**: quien administra A y B, parado
    // en B, dejaba sus importaciones contadas en A. Las métricas con las que se
    // decide el producto mezclaban dos clientes.
    //
    // Lo que hacía seguro al claim no era venir del token, era estar
    // verificado. Se conserva eso y se cambia la fuente: si el cuerpo trae un
    // conjunto, vale **solo si hay membresía en él**. Sin cuerpo, el claim,
    // que es el comportamiento de siempre.
    const claims = request.auth?.token as Record<string, unknown> | undefined;
    const role = claims?.role;
    const delClaim = typeof claims?.tenantId === "string" ? claims.tenantId : "";
    const pedido = typeof (request.data as { tenantId?: unknown } | undefined)?.tenantId === "string"
      ? ((request.data as { tenantId: string }).tenantId)
      : "";

    let tenantId = delClaim;
    if (pedido && pedido !== delClaim) {
      if (!(await esMiembroDelConjunto(pedido, uid))) {
        throw new HttpsError("permission-denied", "No perteneces a ese conjunto.");
      }
      tenantId = pedido;
    }

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
