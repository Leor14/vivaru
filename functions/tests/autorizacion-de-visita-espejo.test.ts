import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ESPERA_DE_AUTORIZACION_MS,
  estaResuelta,
  estadoDeAutorizacion,
  puedeEntrar,
  segundosRestantes,
} from "../src/autorizacion-de-visita";

/**
 * `PRD-V-FLOW-005` — la derivación de la caducidad, y su espejo.
 *
 * **Las dos copias tienen que decir lo mismo, y no se pueden importar la una a la otra** (`src/`
 * no importa `functions/`: rompe el `next build`). Se comparan **como texto**, igual que el
 * catálogo de avisos — que llevaba desde siempre diciendo «deben mantenerse en sincronía» y
 * **nada lo comprobaba**.
 *
 * **Aquí divergir tiene un síntoma feo:** la pantalla del guardia diría que a la petición le
 * quedan dos minutos mientras el servidor la da por caducada, o al revés.
 */

const SERVIDOR = "src/autorizacion-de-visita.ts";
const CLIENTE = "../src/features/visitors/autorizacion.ts";

/** El cuerpo ejecutable, sin comentarios: los dos ficheros explican distinto a propósito. */
function cuerpo(ruta: string): string {
  return readFileSync(ruta, "utf-8")
    .replace(/\/\*\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//"))
    .join("\n");
}

describe("la autorización de una visita caduca sola", () => {
  const ahora = 1_756_600_000_000;

  it("el espejo dice exactamente lo mismo que el original", () => {
    const servidor = cuerpo(SERVIDOR);
    const cliente = cuerpo(CLIENTE);
    // Que el extractor encuentre algo: con los dos vacíos, la comparación pasaría sin comparar.
    expect(servidor.length).toBeGreaterThan(300);
    expect(cliente).toBe(servidor);
  });

  describe("`CA5` — la caducidad se DERIVA, no la escribe ningún job", () => {
    it("antes de los cinco minutos sigue pendiente", () => {
      expect(estadoDeAutorizacion("pendiente", ahora - 4 * 60_000, ahora)).toBe("pendiente");
    });

    it("a los cinco minutos exactos ya está expirada", () => {
      expect(estadoDeAutorizacion("pendiente", ahora - ESPERA_DE_AUTORIZACION_MS, ahora)).toBe("expirada");
    });

    it("y una de hace una hora ES expirada, aunque nadie haya corrido nada", () => {
      expect(estadoDeAutorizacion("pendiente", ahora - 60 * 60_000, ahora)).toBe("expirada");
    });

    it("un estado ya resuelto NO caduca por mucho que pase el tiempo", () => {
      expect(estadoDeAutorizacion("autorizada", ahora - 60 * 60_000, ahora)).toBe("autorizada");
      expect(estadoDeAutorizacion("rechazada", ahora - 60 * 60_000, ahora)).toBe("rechazada");
    });
  });

  describe("un pase del flujo de QR no tiene autorización, y eso NO es un estado", () => {
    it("devuelve null y no un valor por defecto que signifique dos cosas", () => {
      expect(estadoDeAutorizacion(undefined, null, ahora)).toBeNull();
      expect(estadoDeAutorizacion("", null, ahora)).toBeNull();
    });

    it("y por eso puede entrar: `R1` solo gobierna las visitas de portería", () => {
      expect(puedeEntrar(null)).toBe(true);
    });
  });

  describe("`R1` y `CA8` — a `inside` solo se llega desde `autorizada`", () => {
    it("ni pendiente, ni rechazada, ni expirada", () => {
      expect(puedeEntrar("autorizada")).toBe(true);
      expect(puedeEntrar("pendiente")).toBe(false);
      expect(puedeEntrar("rechazada")).toBe(false);
      expect(puedeEntrar("expirada")).toBe(false);
    });
  });

  describe("`R6` y `CA6` — resuelta no se re-resuelve, pero expirada SÍ se rescata", () => {
    it("autorizada y rechazada están resueltas", () => {
      expect(estaResuelta("autorizada")).toBe(true);
      expect(estaResuelta("rechazada")).toBe(true);
    });

    /**
     * **La distinción que hace posible `CA6`.** Si `expirada` contara como resuelta, el guardia
     * no podría rescatarla por la vía B y tendría que recapturar los datos con el visitante
     * delante — que es exactamente lo que la ficha quiere evitar.
     */
    it("expirada NO lo está: es lo que deja al guardia rescatarla por la vía B", () => {
      expect(estaResuelta("expirada")).toBe(false);
      expect(estaResuelta("pendiente")).toBe(false);
    });
  });

  describe("la cuenta atrás de la pantalla", () => {
    it("cuenta los segundos que quedan", () => {
      expect(segundosRestantes(ahora - 60_000, ahora)).toBe(240);
    });

    it("y no baja de cero", () => {
      expect(segundosRestantes(ahora - 60 * 60_000, ahora)).toBe(0);
      expect(segundosRestantes(null, ahora)).toBe(0);
    });
  });
});
