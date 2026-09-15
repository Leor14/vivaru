import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { construirAvisoDeMora, textoDeAvisoEnviado, TITULO_AVISO_DE_MORA } from "@/features/billing/aviso-de-mora";

/**
 * **`D-1` — el aviso de mora de Cartera llega solo a las unidades elegidas.**
 *
 * Lote «Análisis de la plataforma», plan T1.3 (la reproducción) y T2.3 (el arreglo). En la fase 1
 * era un guardián con `it.fails` que leía `handleSendOverdueBulkMessage`: el comunicado salía sin
 * audiencia y lo veía todo el conjunto. El arreglo sacó su construcción a
 * `features/billing/aviso-de-mora.ts`, que se prueba aquí por comportamiento; el guardián que queda
 * comprueba que la pantalla la usa, para que nadie vuelva a escribir el comunicado a mano.
 */

describe("D-1 · el aviso de mora va dirigido a las unidades elegidas", () => {
  it("va dirigido a esas unidades, sin repetir y sin vacías", () => {
    const aviso = construirAvisoDeMora({ unitIds: ["u-1", "u-2", "u-1", " "], mensaje: "  Tienes saldo pendiente.  " });
    expect(aviso).toEqual({
      title: TITULO_AVISO_DE_MORA,
      message: "Tienes saldo pendiente.",
      status: "published",
      audience: "units",
      audienceTowers: [],
      audienceUnitIds: ["u-1", "u-2"],
    });
  });

  it("no se construye sin unidades: un comunicado dirigido sin unidades no lo podría leer nadie", () => {
    expect(() => construirAvisoDeMora({ unitIds: [], mensaje: "Hola" })).toThrow(/al menos una unidad/);
  });

  it("el mensaje de éxito dice a cuántas unidades se publicó, sin afirmar que están en mora", () => {
    expect(textoDeAvisoEnviado(1)).toBe("Aviso publicado para los residentes de 1 unidad.");
    expect(textoDeAvisoEnviado(3)).toBe("Aviso publicado para los residentes de 3 unidades.");
    expect(textoDeAvisoEnviado(3)).not.toMatch(/mora/);
  });
});

describe("D-1 · Cartera usa la función, y no escribe el comunicado a mano", () => {
  const pagina = fs.readFileSync(path.resolve(__dirname, "..", "src/app/(admin)/admin/billing/page.tsx"), "utf8");
  const inicio = pagina.indexOf("async function handleSendOverdueBulkMessage");
  const cuerpo = inicio >= 0 ? pagina.slice(inicio, pagina.indexOf("\n  }\n", inicio)) : "";

  it("control: encuentra el aviso masivo", () => {
    expect(cuerpo.length).toBeGreaterThan(0);
  });

  it("el aviso masivo construye el comunicado con construirAvisoDeMora y lo anuncia con textoDeAvisoEnviado", () => {
    expect(cuerpo).toContain("construirAvisoDeMora(");
    expect(cuerpo).toContain("textoDeAvisoEnviado(");
    expect(cuerpo).not.toMatch(/en mora\)/);
  });
});
