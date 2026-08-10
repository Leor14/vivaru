import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

import type { ExecutionFailureReason } from "./execute";

/**
 * Telemetría de uso y costo (Paso 1.5 de `docs/hoja-de-ruta-ia.md`).
 *
 * Existe para poder responder «cuánto gastó este conjunto este mes» **mirando
 * datos y no estimando**. Sin esto no hay línea base, y sin línea base no hay
 * proyecto: hay opinión.
 *
 * Dos reglas que no se negocian, y las dos vienen del Paso 0:
 *
 *  - **Metadatos sí, contenido no.** Ni el propósito, ni los hechos, ni el
 *    borrador, ni el prompt. Cuánto y con qué, nunca qué se dijo. La forma de
 *    que eso no dependa de que alguien se acuerde es que el tipo de este
 *    archivo no tenga dónde meterlo.
 *  - **Retención de 12 meses.** La purga vive en `data-retention.ts`.
 */

export const AI_USAGE_COLLECTION = "aiUsage";

/**
 * Precios por millón de tokens, en dólares.
 *
 * **Versionada a propósito.** El costo se calcula al escribir y se guarda ya
 * calculado, junto con la versión de esta tabla. Guardar solo los tokens y
 * multiplicar después por el precio de hoy miente sobre el pasado: si el
 * proveedor sube el precio en noviembre, agosto se recalcularía caro y la
 * historia quedaría falsificada.
 *
 * Los valores de Gemini son la decisión del Paso 0 (verificada el 8 de agosto
 * de 2026). Al cambiarlos, subir `PRICE_TABLE_VERSION` — nunca editar en sitio.
 */
export const PRICE_TABLE_VERSION = "2026-08";

const PRICES_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  "gemini-3.1-flash-lite": { input: 0.25, output: 1.5 },
  "gemini-3.6-flash": { input: 0.5, output: 3.0 },
  /** El simulador no cuesta nada, y que se vea en los datos es lo correcto. */
  stub: { input: 0, output: 0 },
  fake: { input: 0, output: 0 },
};

/** Función pura: se prueba sin Firestore y sin proveedor. */
export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const precio = PRICES_USD_PER_MILLION[model];
  // Modelo desconocido → 0 y un aviso. Inventar un precio sería peor: un número
  // plausible y falso no se cuestiona, un cero raro sí.
  if (!precio) {
    logger.warn("aiUsage: modelo sin precio en la tabla", { model, version: PRICE_TABLE_VERSION });
    return 0;
  }

  const costo = (inputTokens / 1_000_000) * precio.input + (outputTokens / 1_000_000) * precio.output;
  // Seis decimales: una llamada de este tamaño cuesta millonésimas de dólar y
  // redondear a centavos las convertiría todas en cero.
  return Math.round(costo * 1_000_000) / 1_000_000;
}

/** Cómo terminó la llamada. `ok` o el motivo exacto del fallo. */
export type AiUsageOutcome = "ok" | ExecutionFailureReason;

/**
 * Lo que se registra. **No hay ningún campo de texto libre** donde pueda
 * colarse contenido del conjunto, y esa ausencia es la garantía.
 */
export interface AiUsageEntry {
  tenantId: string;
  uid: string;
  operationKey: string;
  operationVersion: number;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  outcome: AiUsageOutcome;
}

/**
 * Escribe una fila de telemetría.
 *
 * **Nunca lanza.** Si Firestore falla, el administrador se queda con su
 * borrador y nosotros con un aviso en los logs: perder una fila de medición es
 * molesto, perder el trabajo de la persona por no poder medirlo es absurdo.
 *
 * Se registran también los FALLOS, y no por completitud: una llamada que falla
 * ya consumió tokens —el modelo respondió, lo que no pasó fue el validador— y
 * sobre todo, la tasa de fallo es la métrica que dice si esto sirve. Un
 * registro solo de éxitos es un tablero precioso que siempre da buenas noticias.
 */
export async function recordAiUsage(entry: AiUsageEntry): Promise<void> {
  try {
    const estimatedCostUsd = estimateCostUsd(entry.model, entry.inputTokens, entry.outputTokens);

    await getFirestore()
      .collection(AI_USAGE_COLLECTION)
      .add({
        ...entry,
        estimatedCostUsd,
        priceTableVersion: PRICE_TABLE_VERSION,
        createdAt: Timestamp.now(),
      });
  } catch (error) {
    logger.error("aiUsage: no se pudo registrar el consumo", {
      operationKey: entry.operationKey,
      tenantId: entry.tenantId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
