/**
 * **El estado de autorización de una visita de portería. Función pura, sin reloj propio.**
 *
 * `PRD-V-FLOW-005` R3. Una petición espera **cinco minutos** y luego caduca — **y la caducidad NO
 * la escribe ningún trabajo programado: se DERIVA del sello de tiempo al leer**. Un `pendiente` de
 * hace una hora **es** `expirada` aunque nadie haya corrido nada.
 *
 * Esa decisión es lo que evita el modo de fallo que este repositorio ya conoce: un estado que
 * depende de un cron se queda atascado el día que el cron no corre, y nadie se entera hasta que
 * alguien mira. Aquí no hay nada que correr.
 *
 * **Recibe los milisegundos, no el documento.** En el servidor la marca es un `Timestamp` de
 * Firestore y en el navegador una cadena ISO; convertir en cada lado y pasar un número deja esta
 * función igual en los dos y hace que su espejo se pueda comparar como texto.
 *
 * Original en `functions/src/autorizacion-de-visita.ts` — **manda ese**. Guardián en
 * `functions/tests/autorizacion-de-visita-espejo.test.ts`, que compara los dos como texto.
 */

/** Lo que espera el SISTEMA, que no es lo que se le promete a nadie. */
export const ESPERA_DE_AUTORIZACION_MS = 5 * 60 * 1000;

export type EstadoDeAutorizacion = "pendiente" | "autorizada" | "rechazada" | "expirada";

/**
 * El estado real de la autorización.
 *
 * Devuelve `null` cuando el pase **no** es de portería —los del flujo de QR no llevan este campo,
 * y su ausencia es justo lo que los distingue—, para que quien lo consuma no tenga que inventarse
 * un valor por defecto que signifique dos cosas.
 */
export function estadoDeAutorizacion(
  estadoGuardado: string | null | undefined,
  solicitadaEnMs: number | null,
  ahoraMs: number,
): EstadoDeAutorizacion | null {
  if (!estadoGuardado) return null;
  if (estadoGuardado !== "pendiente") {
    return estadoGuardado as EstadoDeAutorizacion;
  }
  if (solicitadaEnMs == null) return "pendiente";
  return ahoraMs - solicitadaEnMs >= ESPERA_DE_AUTORIZACION_MS ? "expirada" : "pendiente";
}

/** `R1`: solo desde `autorizada` se entra. Lo comprueban la callable, la regla y la pantalla. */
export function puedeEntrar(estado: EstadoDeAutorizacion | null): boolean {
  return estado === null || estado === "autorizada";
}

/** `R6`: una vez resuelta, no se re-resuelve. `expirada` NO es resuelta: la vía B la rescata. */
export function estaResuelta(estado: EstadoDeAutorizacion | null): boolean {
  return estado === "autorizada" || estado === "rechazada";
}

/** Segundos que quedan de espera, para la cuenta atrás de la pantalla. */
export function segundosRestantes(solicitadaEnMs: number | null, ahoraMs: number): number {
  if (solicitadaEnMs == null) return 0;
  return Math.max(0, Math.ceil((solicitadaEnMs + ESPERA_DE_AUTORIZACION_MS - ahoraMs) / 1000));
}
