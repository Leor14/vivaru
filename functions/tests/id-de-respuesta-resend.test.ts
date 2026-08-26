import { describe, expect, it } from "vitest";

import { idDeRespuestaResend } from "../src/email";

/**
 * `PRD-V-FLOW-003` — el identificador del mensaje del proveedor.
 *
 * **Por qué existe esta prueba, y por qué es de una función pura.** La ficha construye toda su
 * idempotencia sobre este valor —§7.1: el id del proveedor ES el id del documento de
 * `emailDeliveries`, «para que la idempotencia del webhook la garantice la base»— y hasta hoy
 * `sendNotificationEmail` miraba solo `response.ok` y **descartaba el cuerpo de la respuesta**. El
 * id no existía en ninguna parte del producto.
 *
 * Se extrajo como función pura porque **no hay en este repositorio ningún patrón para simular
 * `fetch`**, y `email.ts` lo captura al cargar el módulo: probarlo por ahí exigiría inventar un
 * arnés entero para verificar un `JSON.parse`. Es el mismo criterio de
 * `src/features/billing/estado-de-cuenta.ts`, que se prueba sin emulador por la misma razón.
 *
 * **Lo que estas pruebas vigilan de verdad no es que extraiga el id: es que NUNCA LANCE.** Cuando
 * esto corre, Resend ya aceptó el correo y el destinatario lo va a recibir. Perder el rastro es
 * malo; convertir un correo entregado en un error para quien lo mandó es peor.
 */
describe("FLOW-003 · id de la respuesta de Resend", () => {
  it("saca el id de la respuesta real de Resend", () => {
    expect(idDeRespuestaResend('{"id":"49a3999c-0ce1-4ea6-ab68-afcd6dc2e794"}')).toBe(
      "49a3999c-0ce1-4ea6-ab68-afcd6dc2e794",
    );
  });

  it("tolera los campos de más que el proveedor pueda añadir", () => {
    // Un proveedor puede ampliar su respuesta sin avisar; leer solo lo nuestro es lo que
    // hace que eso no nos rompa.
    expect(idDeRespuestaResend('{"id":"abc123","from":"x@y.z","to":["a@b.c"],"created_at":"2026-08-26"}')).toBe("abc123");
  });

  /**
   * Los cinco casos en que no hay id. **Ninguno puede lanzar**, y por eso van juntos: lo que
   * comparten no es la forma de la entrada, es la obligación de la salida.
   */
  it.each([
    ["cuerpo vacío", ""],
    ["no es JSON — una página de error HTML", "<html><body>502 Bad Gateway</body></html>"],
    ["JSON sin id", '{"message":"queued"}'],
    ["id vacío", '{"id":""}'],
    ["id en blanco", '{"id":"   "}'],
    ["id que no es texto", '{"id":12345}'],
    ["JSON que no es un objeto", "[1,2,3]"],
    ["null", "null"],
  ])("devuelve null sin lanzar: %s", (_caso, cuerpo) => {
    expect(() => idDeRespuestaResend(cuerpo)).not.toThrow();
    expect(idDeRespuestaResend(cuerpo)).toBeNull();
  });

  it("recorta los espacios, para que el id sirva como id de documento", () => {
    // Va a ser la CLAVE de un documento de Firestore. Un espacio delante crearía un segundo
    // documento para el mismo correo, y la idempotencia del webhook dejaría de existir en
    // silencio — sin error y sin rojo.
    expect(idDeRespuestaResend('{"id":"  abc123  "}')).toBe("abc123");
  });
});
