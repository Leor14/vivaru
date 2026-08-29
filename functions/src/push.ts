// Envío de Web Push (PRD-V-PLAT-005). El push es SOMBRA de la notificación:
// este módulo no decide a quién avisar — recibe lo que createNotifications ya
// escribió y lo empuja a los dispositivos registrados. Best-effort con el
// mismo contrato que el correo (R3): un fallo aquí jamás rompe el aviso in-app.
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

import { isFeatureEnabled } from "./feature-flags";

/** Mismo criterio que email.ts: los links relativos del catálogo se vuelven absolutos aquí. */
const APP_BASE_URL = "https://www.grupovivaru.com";

export interface AvisoParaPush {
  userId: string;
  tenantId?: string | null;
  title: string;
  description: string;
  link?: string | null;
}

/** FCM exige URL absoluta en webpush.fcmOptions.link; el catálogo guarda rutas. */
export function enlaceAbsoluto(link: string | null | undefined): string {
  if (!link) return APP_BASE_URL;
  return link.startsWith("http") ? link : `${APP_BASE_URL}${link}`;
}

/**
 * Códigos de FCM que significan «este token murió»: el documento se purga en el
 * propio envío (§6 de la ficha — no hace falta job). `invalid-argument` entra
 * porque es lo que responde un token corrupto, no solo uno caducado.
 */
const CODIGOS_DE_TOKEN_MUERTO = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export function esTokenMuerto(code: string | undefined): boolean {
  return code !== undefined && CODIGOS_DE_TOKEN_MUERTO.has(code);
}

/** FCM acepta hasta 500 tokens por multicast. */
const TOKENS_POR_LOTE = 500;

/**
 * Empuja una tanda de avisos ya escritos en `notifications`.
 *
 * - Sin `tenantId` no hay push: la bandera es por conjunto y el registro solo
 *   existe en el portal del residente, que siempre tiene conjunto.
 * - Los tokens se buscan por `userId` Y `tenantId`: un usuario con dos
 *   membresías recibe en cada dispositivo solo lo del conjunto con el que lo
 *   registró («recibir push de otro conjunto» está prohibido en §3).
 * - 0 tokens es el caso normal, no un error (CA10).
 */
export async function empujarAvisos(avisos: AvisoParaPush[]): Promise<void> {
  if (avisos.length === 0) return;
  const db = getFirestore();

  // La bandera se resuelve una vez por conjunto, no por aviso (R2: la
  // comprueba el servidor; el front solo decide si invita a registrarse).
  const banderaPorConjunto = new Map<string, Promise<boolean>>();
  const banderaDe = (tenantId: string) => {
    let p = banderaPorConjunto.get(tenantId);
    if (!p) {
      p = isFeatureEnabled("producto-notificaciones-push", tenantId);
      banderaPorConjunto.set(tenantId, p);
    }
    return p;
  };

  for (const aviso of avisos) {
    const tenantId = aviso.tenantId ?? null;
    if (!tenantId) continue;

    try {
      if (!(await banderaDe(tenantId))) continue;

      const snap = await db
        .collection("pushTokens")
        .where("userId", "==", aviso.userId)
        .where("tenantId", "==", tenantId)
        .get();
      if (snap.empty) continue; // CA10: sin dispositivos no pasa nada, ni un log.

      const tokens = snap.docs.map((d) => d.id);
      for (let i = 0; i < tokens.length; i += TOKENS_POR_LOTE) {
        const lote = tokens.slice(i, i + TOKENS_POR_LOTE);
        const respuesta = await getMessaging().sendEachForMulticast({
          tokens: lote,
          notification: { title: aviso.title, body: aviso.description },
          webpush: {
            fcmOptions: { link: enlaceAbsoluto(aviso.link) },
            notification: { icon: "/brand/icon-192.png" },
          },
        });

        // La purga y la marca de uso van en el mismo batch, best-effort.
        const batch = db.batch();
        let cambios = 0;
        respuesta.responses.forEach((r, j) => {
          const ref = db.collection("pushTokens").doc(lote[j]);
          if (r.success) {
            batch.update(ref, { lastUsedAt: Timestamp.now() });
            cambios++;
          } else if (esTokenMuerto(r.error?.code)) {
            batch.delete(ref);
            cambios++;
          } else {
            logger.warn("[push] envío fallido sin purga", {
              code: r.error?.code,
              tenantId,
            });
          }
        });
        if (cambios > 0) await batch.commit();
      }
    } catch (e) {
      // R3: el push nunca rompe nada — ni siquiera el push del aviso siguiente.
      logger.error("[push] tanda fallida", { tenantId, error: e });
    }
  }
}
