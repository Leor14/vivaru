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

/**
 * Reglas del identificador de sesión, compartidas por las dos operaciones.
 *
 * Alfabeto acotado a propósito: este valor forma parte de la RUTA del
 * documento. Una barra convertiría la fila en una subcolección, y un `..` en
 * algo peor.
 */
const sesionId = z
  .string()
  .trim()
  .min(8)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "el identificador de sesión solo admite letras, dígitos, guion y guion bajo");

const feedbackComunicacionesSchema = z
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
    // Un UUID cumple de sobra. Las reglas viven arriba, en `sesionId`.
    sesionId,
    operationKey: z.literal("comunicaciones-redactar"),
    propuestas: z.number().int().min(1).max(100),
    aplicada: z.boolean(),
    deshecha: z.boolean(),
    guardada: z.boolean(),
    mostrados: z.array(z.enum(CATEGORIAS_DATO_FALTANTE)).max(MAX_CATEGORIAS),
    descartados: z.array(z.enum(CATEGORIAS_DATO_FALTANTE)).max(MAX_CATEGORIAS),
    /**
     * Preguntas que el administrador CONTESTÓ, añadiendo el dato a los hechos.
     *
     * Se separa de `descartados` porque miden cosas distintas y la primera
     * sesión real lo demostró: el único descarte fue confusión —no sabía dónde
     * responder—, no irrelevancia. Contestar no se puede confundir con nada.
     */
    respondidos: z.array(z.enum(CATEGORIAS_DATO_FALTANTE)).max(MAX_CATEGORIAS),
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

/**
 * Los tres ejes, como los deja la persona o como los propuso el modelo. Son
 * catálogos cerrados: **no hay dónde meter contenido**, que es la regla de esta
 * colección. `null` en `category` y `type` es la variante `buzon_simple`.
 */
const clasificacionPqrs = z
  .object({
    category: z.enum(["pqrs", "maintenance", "billing"]).nullable(),
    type: z.enum(["petition", "complaint", "claim", "suggestion", "other"]).nullable(),
    priority: z.enum(["low", "medium", "high"]).nullable(),
  })
  .strict();

/**
 * Feedback de la asistencia de PQRS — Fase 3 de `PRD-VAI-FEAT-002`.
 *
 * **Lo que de verdad viene a capturar es el par `sugerida` / `guardada`.** Las
 * dos puertas de G7 se cobran contra «la decisión real del administrador», y esa
 * comparación es justo lo que el gold set no puede dar: dice si el modelo
 * coincide con un anotador, no si coincide con quien atiende el ticket. Aquí las
 * dos van en la misma fila, así que la pregunta —«¿cuántas veces corrigió la
 * categoría sugerida?»— se contesta contando, no recordando.
 *
 * El resto mide el circuito de producto que F3 vino a mirar: cuántas lecturas
 * pidió, si se llevó la clasificación, si se llevó el borrador y cuánto lo
 * cambió antes de publicarlo.
 */
const feedbackPqrsSchema = z
  .object({
    sesionId,
    operationKey: z.literal("pqrs-asistir"),
    /** Lecturas pedidas para el mismo ticket. Tope bajo: hay uno en la pantalla. */
    lecturas: z.number().int().min(1).max(20),
    sugerida: clasificacionPqrs,
    /** Pulsó «usar esta clasificación»: la propuesta llegó a los selectores. */
    clasificacionAplicada: z.boolean(),
    /** Lo que quedó escrito en el ticket. `null` si no llegó a guardar. */
    guardada: clasificacionPqrs.nullable(),
    borradorCopiado: z.boolean(),
    respuestaGuardada: z.boolean(),
    distanciaEdicion: z.number().int().min(0).max(100).nullable(),
  })
  .strict()
  // La distancia mide cuánto cambió EL BORRADOR DEL MODELO antes de publicarlo.
  // Sin copiarlo no hay nada de qué medir distancia, y una respuesta escrita a
  // mano con distancia 100 diría lo contrario de lo que parece.
  .refine((v) => (v.borradorCopiado && v.respuestaGuardada ? v.distanciaEdicion !== null : v.distanciaEdicion === null), {
    message: "distanciaEdicion existe exactamente cuando se copió el borrador y se guardó la respuesta",
  })
  // En `buzon_simple` el modelo devuelve nulls por contrato y la pantalla no
  // pinta ni el editor ni el botón. Si llega una clasificación aplicada o
  // guardada en esa variante, el cliente está roto: no es una persona decidiendo.
  .refine((v) => !(v.sugerida.category === null && (v.clasificacionAplicada || v.guardada !== null)), {
    message: "en buzón simple no hay clasificación que aplicar ni que guardar",
  });

/**
 * Las dos operaciones que producen feedback.
 *
 * `union` y no `discriminatedUnion` a propósito: la rama de comunicaciones
 * queda **intacta**, con sus dos invariantes tal y como estaban. Es una ruta de
 * validación, y reescribirla para ganar un mensaje de error más bonito no vale
 * el riesgo de moverle algo a la que ya está en producción.
 */
export const feedbackSchema = z.union([feedbackComunicacionesSchema, feedbackPqrsSchema]);

export type FeedbackBorrador = z.infer<typeof feedbackSchema>;

export type AiFeedbackEntry = FeedbackBorrador & {
  tenantId: string;
  uid: string;
};

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
