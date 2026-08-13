import { getFirestore, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { z } from "zod";

import { CATEGORIAS_DATO_FALTANTE } from "./catalog";

/**
 * Qué hizo la persona con lo que le propusimos (Paso 2.5) — la medición que el
 * piloto del Paso 2.6 necesita y que hasta ahora no existía.
 *
 * `aiUsage` responde «cuánto costó». Esto responde **«sirvió»**, que es la
 * pregunta que decide si la funcionalidad sigue, se corrige o se retira. Son
 * dos colecciones y no una a propósito: la de costo la escribe el servidor al
 * terminar la llamada y siempre; esta la escribe el cliente cuando el
 * administrador acaba de trabajar, puede no llegar nunca, y mezclarlas
 * convertiría un registro fiable en uno con huecos.
 *
 * ## Metadatos sí, contenido no
 *
 * Regla del Paso 0, y la garantía es la misma que en `aiUsage`: **el esquema no
 * tiene dónde meter contenido.** De un dato descartado viaja su categoría,
 * nunca la frase — «¿hasta qué hora estará cerrada la alberca de la torre 3?»
 * habla del conjunto. De la edición viaja un número calculado en el cliente.
 *
 * `.strict()` cierra la puerta a que un cliente futuro añada un campo con
 * texto: no se ignoraría, se rechazaría.
 */

export const AI_FEEDBACK_COLLECTION = "aiFeedback";

/**
 * Tope de elementos por lista. No es por tamaño: es para que un cliente
 * manipulado no pueda usar esta colección como almacenamiento gratuito.
 * Una propuesta real trae cuatro o cinco datos faltantes.
 */
const MAX_CATEGORIAS = 40;

export const feedbackSchema = z
  .object({
    /**
     * Identificador de la sesión de borrador, generado en el navegador.
     *
     * **Existe para poder mandar la misma fila varias veces.** El navegador
     * envía cuando puede —al cerrar el modal, y también al ocultarse la
     * pestaña, que es lo único que se dispara de forma fiable cuando alguien
     * recarga o se va—. Sin identificador, cada envío crearía una fila nueva y
     * un mismo borrador contaría dos o tres veces; con él, el último envío
     * pisa al anterior y la fila queda con el estado más completo.
     *
     * No identifica a una persona ni a un comunicado: nace y muere con el
     * panel abierto.
     */
    // Alfabeto acotado a propósito: este valor forma parte de la RUTA del
    // documento. Una barra convertiría la fila en una subcolección, y un `..`
    // en algo peor. Un UUID cumple de sobra.
    sesionId: z
      .string()
      .trim()
      .min(8)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, "el identificador de sesión solo admite letras, dígitos, guion y guion bajo"),
    operationKey: z.literal("comunicaciones-redactar"),
    propuestas: z.number().int().min(1).max(100),
    aplicada: z.boolean(),
    deshecha: z.boolean(),
    guardada: z.boolean(),
    mostrados: z.array(z.enum(CATEGORIAS_DATO_FALTANTE)).max(MAX_CATEGORIAS),
    descartados: z.array(z.enum(CATEGORIAS_DATO_FALTANTE)).max(MAX_CATEGORIAS),
    distanciaEdicion: z.number().int().min(0).max(100).nullable(),
  })
  .strict()
  // Una edición medida sin haber guardado no significa nada, y una guardada sin
  // medida tampoco: si llegan descuadradas, el cliente está mal, no los datos.
  .refine((v) => (v.guardada ? v.distanciaEdicion !== null : v.distanciaEdicion === null), {
    message: "distanciaEdicion solo existe si se guardó, y siempre que se guarde",
  })
  // Deshacer sin haber aplicado es imposible en la pantalla. Si llega, es señal
  // de un cliente roto y no de una persona indecisa.
  .refine((v) => !(v.deshecha && !v.aplicada), {
    message: "no se puede deshacer lo que no se aplicó",
  });

export type FeedbackBorrador = z.infer<typeof feedbackSchema>;

export interface AiFeedbackEntry extends FeedbackBorrador {
  tenantId: string;
  uid: string;
}

/**
 * Escribe una fila de feedback.
 *
 * **Nunca lanza**, igual que `recordAiUsage` y por el mismo motivo: perder una
 * fila de medición es molesto; que el administrador vea un error al cerrar un
 * comunicado que ya se guardó bien es absurdo y además mentira.
 */
export async function recordAiFeedback(entry: AiFeedbackEntry): Promise<void> {
  try {
    // El id lo compone el SERVIDOR con el conjunto que resolvió de la sesión,
    // no el cliente. Así dos conjuntos no pueden pisarse la fila ni aunque
    // alguien reutilice un `sesionId` ajeno a propósito.
    const id = `${entry.tenantId}_${entry.sesionId}`;
    await getFirestore()
      .collection(AI_FEEDBACK_COLLECTION)
      .doc(id)
      // `merge` para que el envío tardío —el que trae si se guardó y cuánto se
      // editó— complete la fila que dejó el envío temprano en vez de duplicarla.
      .set({ ...entry, createdAt: Timestamp.now() }, { merge: true });
  } catch (error) {
    logger.error("aiFeedback: no se pudo registrar", {
      tenantId: entry.tenantId,
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
