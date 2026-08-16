import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

import { callableCorsOrigins } from "../http-config";
import { runGateway, type GatewayOutcome, type GatewayRequest, type InputResolution } from "./gateway";
import {
  construirEntradaPqrs,
  ticketPerteneceAlConjunto,
  variantePqrsDe,
  type RecorteEntrada,
} from "./pqrs-ticket";

/**
 * Puerta de la asistencia de PQRS (Fase 3 de `PRD-VAI-FEAT-002`).
 *
 * **Por qué existe en vez de llamar a `aiInvoke` desde la pantalla.** El esquema
 * de entrada de `pqrs-asistir` lleva escrito desde la Fase 2 que la puebla el
 * servidor. Si el drawer llamara a la puerta genérica, el navegador tendría que
 * afirmar `mensaje`, `historial` y `variante` — y `variante` es lo que decide la
 * puerta dura de `buzon_simple`: nulls siempre. Un cliente que mandara `con_sla`
 * en un conjunto de buzón simple recibiría clasificación donde el contrato de
 * producto dice que no debe haberla. **La puerta dura la estaría decidiendo el
 * navegador**, que es exactamente lo que la PRD §7 evita resolviendo todo en
 * servidor.
 *
 * Aquí el cliente manda `ticketId` y nada más. Todo lo demás —conjunto, texto,
 * historial, variante— lo lee el servidor.
 *
 * No duplica ninguna comprobación: rol, banderas, cuota, validación, proveedor y
 * telemetría siguen viviendo en `runGateway`. Esto es la parte que aquella no
 * puede saber — cómo se llega del `ticketId` a la entrada de la operación.
 */

const OPERACION = "pqrs-asistir" as const;

export interface AsistirPqrsRequest {
  app?: unknown;
  auth?: { uid?: string; token?: Record<string, unknown> };
  data?: unknown;
}

export type AsistirPqrsOutcome =
  | (Extract<GatewayOutcome, { ok: true }> & { recorte: RecorteEntrada })
  | Extract<GatewayOutcome, { ok: false }>;

/**
 * Lee el ticket y arma la entrada. Se le pasa a la puerta como armador, así que
 * corre **después** de que el rol, las banderas y el conjunto ya dijeron que sí.
 */
async function armarEntrada(tenantId: string, ticketId: string, recorteRef: { valor: RecorteEntrada | null }): Promise<InputResolution> {
  const db = getFirestore();

  const [ticketSnap, settingsSnap] = await Promise.all([
    db.collection("tickets").doc(ticketId).get(),
    db.collection("tenantSettings").doc(tenantId).get(),
  ]);

  // Un ticket de otro conjunto se responde igual que uno que no existe — el
  // porqué está en `ticketPerteneceAlConjunto`, con su prueba negativa al lado.
  const ticket = ticketSnap.exists ? (ticketSnap.data() as Record<string, unknown>) : null;
  if (!ticketPerteneceAlConjunto(ticket, tenantId)) {
    return {
      ok: false,
      code: "permission-denied",
      message: "No encontramos ese ticket.",
      reason: "ticket_fuera_del_conjunto",
    };
  }

  const variante = variantePqrsDe(settingsSnap.exists ? settingsSnap.data() : null);
  const construida = construirEntradaPqrs(ticket, variante);

  if (!construida.ok) {
    return {
      ok: false,
      code: "failed-precondition",
      message: "Este ticket no tiene texto que analizar.",
      reason: construida.reason,
    };
  }

  recorteRef.valor = construida.recorte;
  return { ok: true, input: construida.entrada };
}

export async function runAsistirTicketPqrs(request: AsistirPqrsRequest): Promise<AsistirPqrsOutcome> {
  const ticketId = (request.data as { ticketId?: unknown } | undefined)?.ticketId;
  if (typeof ticketId !== "string" || !ticketId.trim()) {
    return {
      ok: false,
      code: "invalid-argument",
      message: "No sabemos de qué ticket hablas.",
      reason: "ticket_id_ausente",
    };
  }

  // El recorte lo produce el armador y lo necesita la respuesta; la puerta no
  // tiene por qué conocerlo, así que viaja por fuera en vez de ensuciar su
  // contrato con un campo que solo usa una operación.
  const recorteRef: { valor: RecorteEntrada | null } = { valor: null };

  const gatewayRequest: GatewayRequest = {
    app: request.app,
    auth: request.auth,
    // Sin `input`: lo arma el servidor. Lo que mandara el cliente se descarta.
    data: { operationKey: OPERACION },
  };

  const outcome = await runGateway(gatewayRequest, {
    resolveInput: ({ tenantId }) => armarEntrada(tenantId, ticketId.trim(), recorteRef),
  });

  if (!outcome.ok) return outcome;

  logger.info("pqrs-asistir: asistencia entregada", {
    ticketId: ticketId.trim(),
    recorte: recorteRef.valor,
  });

  return {
    ...outcome,
    recorte: recorteRef.valor ?? { mensaje: false, historialOmitido: 0 },
  };
}

export const asistirTicketPqrs = onCall<{ ticketId?: string }>(
  {
    cors: callableCorsOrigins,
    // Mismo criterio que `aiInvoke` y que el feedback: lo decide la bandera de
    // modo monitor, para que pasar de observar a exigir no requiera desplegar.
    enforceAppCheck: false,
  },
  async (request) => {
    const outcome = await runAsistirTicketPqrs({
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
      recorte: outcome.recorte,
    };
  },
);
