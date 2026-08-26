import { describe, expect, it } from "vitest";

import {
  contactoRoto,
  estadoDesdeEvento,
  verificarFirmaSvix,
  TOLERANCIA_RELOJ_S,
} from "../src/email-webhook";

/**
 * `PRD-V-FLOW-003` §11.1 / CF8 — la firma del webhook de entregabilidad.
 *
 * **Es la única puerta del producto abierta a internet.** Todo lo demás son callables con sesión
 * y procesos programados; esto lo llama un servidor ajeno. Si la firma no se comprueba, cualquiera
 * puede marcar correos como entregados, y el fallo **no se ve**: no rompe una pantalla, deja la
 * métrica mintiendo. «100% de entrega conocida» pasaría a ser «100% de lo que alguien quiso
 * declarar», que es peor que no medir.
 *
 * **El vector es de la documentación de Svix, no generado aquí.** Firmar con el mismo código que
 * verifica probaría solo que es consistente consigo mismo: pasaría en verde con el algoritmo
 * entero equivocado. Con un vector externo, lo que se prueba es que implementamos SU esquema.
 */

// Vector publicado por Svix.
const SECRETO = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const ID = "msg_p5jXN8AQM9LWM0D4loKWxJek";
const TS = "1614265330";
const CUERPO = '{"test": 2432232314}';
const FIRMA = "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=";
const AHORA = Number(TS);

const cab = (over: Partial<{ id: string; timestamp: string; signature: string }> = {}) => ({
  id: ID,
  timestamp: TS,
  signature: FIRMA,
  ...over,
});

describe("FLOW-003 · firma del webhook", () => {
  it("acepta el vector conocido de Svix", () => {
    expect(verificarFirmaSvix(SECRETO, cab(), CUERPO, AHORA)).toEqual({ ok: true });
  });

  /**
   * **Lo que de verdad sostiene la métrica es este bloque**, no el de arriba. Una verificación que
   * dijera `ok` siempre pasaría la primera prueba igual de bien.
   */
  it("RECHAZA si el cuerpo cambió aunque sea un carácter", () => {
    const r = verificarFirmaSvix(SECRETO, cab(), '{"test": 2432232315}', AHORA);
    expect(r.ok).toBe(false);
  });

  it("RECHAZA con otro secreto", () => {
    expect(verificarFirmaSvix("whsec_" + Buffer.from("otro").toString("base64"), cab(), CUERPO, AHORA).ok).toBe(false);
  });

  it("RECHAZA si el id no es el firmado — la firma cubre las tres partes", () => {
    expect(verificarFirmaSvix(SECRETO, cab({ id: "msg_otro" }), CUERPO, AHORA).ok).toBe(false);
  });

  it("RECHAZA una firma vieja reproducida", () => {
    const r = verificarFirmaSvix(SECRETO, cab(), CUERPO, AHORA + TOLERANCIA_RELOJ_S + 1);
    expect(r).toEqual({ ok: false, motivo: "fuera de la ventana de tiempo" });
  });

  it("RECHAZA también una del futuro: el reloj adelantado es el mismo ataque", () => {
    const r = verificarFirmaSvix(SECRETO, cab(), CUERPO, AHORA - TOLERANCIA_RELOJ_S - 1);
    expect(r).toEqual({ ok: false, motivo: "fuera de la ventana de tiempo" });
  });

  it("acepta justo en el borde de la ventana", () => {
    expect(verificarFirmaSvix(SECRETO, cab(), CUERPO, AHORA + TOLERANCIA_RELOJ_S).ok).toBe(true);
  });

  it.each([
    ["sin id", { id: undefined }],
    ["sin marca de tiempo", { timestamp: undefined }],
    ["sin firma", { signature: undefined }],
  ])("RECHAZA %s", (_c, over) => {
    expect(verificarFirmaSvix(SECRETO, cab(over as never), CUERPO, AHORA).ok).toBe(false);
  });

  it("RECHAZA si no hay secreto configurado — nunca 'pasa por defecto'", () => {
    // El modo de fallo peor: desplegar sin el secreto y que todo entre.
    expect(verificarFirmaSvix("", cab(), CUERPO, AHORA)).toEqual({ ok: false, motivo: "sin secreto configurado" });
  });

  it("acepta si UNA de varias casa — el proveedor manda dos al rotar la clave", () => {
    const conRotacion = `v1,${Buffer.from("firma-vieja").toString("base64")} ${FIRMA}`;
    expect(verificarFirmaSvix(SECRETO, cab({ signature: conRotacion }), CUERPO, AHORA).ok).toBe(true);
  });

  it("ignora versiones que no son v1 en vez de lanzar", () => {
    expect(() => verificarFirmaSvix(SECRETO, cab({ signature: "v2,loquesea" }), CUERPO, AHORA)).not.toThrow();
    expect(verificarFirmaSvix(SECRETO, cab({ signature: "v2,loquesea" }), CUERPO, AHORA).ok).toBe(false);
  });

  it("no lanza con una firma de longitud distinta — `timingSafeEqual` sí lo haría", () => {
    // Es la trampa de usar comparación en tiempo constante: revienta si los buffers
    // miden distinto, y una firma corta la manda cualquiera.
    expect(() => verificarFirmaSvix(SECRETO, cab({ signature: "v1,YWJj" }), CUERPO, AHORA)).not.toThrow();
    expect(verificarFirmaSvix(SECRETO, cab({ signature: "v1,YWJj" }), CUERPO, AHORA).ok).toBe(false);
  });

  it("no lanza con una marca de tiempo que no es número", () => {
    expect(verificarFirmaSvix(SECRETO, cab({ timestamp: "ayer" }), CUERPO, AHORA)).toEqual({
      ok: false,
      motivo: "marca de tiempo no numérica",
    });
  });
});

describe("FLOW-003 · qué evento mueve qué estado", () => {
  it.each([
    ["email.sent", "enviado"],
    ["email.delivered", "entregado"],
    ["email.delivery_delayed", "demorado"],
    ["email.bounced", "rebotado"],
    ["email.complained", "marcado_spam"],
  ])("%s → %s", (evento, estado) => {
    expect(estadoDesdeEvento(evento)).toBe(estado);
  });

  /**
   * **Que estos den `null` es una decisión, no un hueco.** Saber si alguien abrió un correo exige
   * un píxel de seguimiento; esta colección existe para saber si el aviso LLEGÓ, no para vigilar a
   * quien lo recibe. Si algún día alguien los añade, esta prueba obliga a decidirlo a propósito.
   */
  it.each(["email.opened", "email.clicked", "email.inventado"])("%s se ignora", (evento) => {
    expect(estadoDesdeEvento(evento)).toBeNull();
  });

  it("solo el rebote y la queja rompen el contacto", () => {
    expect(contactoRoto("rebotado")).toBe("bounced");
    expect(contactoRoto("marcado_spam")).toBe("complained");
    expect(contactoRoto("entregado")).toBeNull();
    expect(contactoRoto("demorado")).toBeNull();
  });
});
