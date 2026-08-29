import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TOLERANCIA_MONEDA } from "../src/payments";
import { MOTIVOS, VENTANA_DIAS, efectoContable, idDeLinea } from "../src/conciliacion";

/**
 * **Las reglas de la conciliación viven en DOS sitios, y nada las vigilaba.**
 *
 * - `functions/src/conciliacion.ts` — quien DECIDE, porque es quien escribe.
 * - `src/features/finanzas/conciliacion-reglas.ts` — quien OFRECE los candidatos
 *   en la bandeja.
 *
 * Que estén dos veces es forzoso: `src/` no puede importar de `functions/`
 * —rompe el build de App Hosting, ver `CLAUDE.md`—. Lo que no puede pasar es que
 * **discrepen en silencio**, y el síntoma no sería un error: sería la pantalla
 * ofreciendo un movimiento que el servidor va a rechazar, o —peor— **ocultando
 * uno que sí valía**, que nadie descubre porque no se ve lo que no está.
 *
 * **Se compara como TEXTO**, igual que el guardián del calendario de cobranza:
 * leer un fichero no es importarlo.
 */

const RAIZ = path.resolve(__dirname, "../..");

function leer(relativo: string): string {
  const contenido = fs.readFileSync(path.join(RAIZ, relativo), "utf8");
  expect(contenido.length, `${relativo} está vacío o no se pudo leer`).toBeGreaterThan(100);
  return contenido;
}

const espejo = leer("src/features/finanzas/conciliacion-reglas.ts");

describe("El servidor y la bandeja aplican las mismas reglas", () => {
  it("R3 · la ventana de fecha es la misma", () => {
    const m = espejo.match(/VENTANA_DIAS = (\d+)/);
    expect(m, "no encontré VENTANA_DIAS en el espejo — ¿se renombró?").not.toBeNull();
    expect(Number(m![1])).toBe(VENTANA_DIAS);
  });

  it("R2 · la tolerancia de dinero es la misma", () => {
    const m = espejo.match(/TOLERANCIA_MONEDA = ([\d.]+)/);
    expect(m, "no encontré TOLERANCIA_MONEDA en el espejo").not.toBeNull();
    expect(Number(m![1])).toBe(TOLERANCIA_MONEDA);
  });

  it("R2 · el signo del efecto se calcula igual, y no por valor absoluto", () => {
    // Es la mitad de R2 que ninguna otra regla cubre: sin ella, una salida de
    // banco casaría con una entrada del libro del mismo importe.
    expect(espejo).toContain('type === "ingreso" ? 1 : -1');
    expect(efectoContable({ type: "egreso", amount: 300000 })).toBe(-300000);
  });

  it("R4 · la propuesta única está escrita igual en los dos", () => {
    expect(espejo).toContain("candidatos.length === 1");
  });

  it("R5 · la clave natural lleva los mismos cinco campos, y la descripción entre ellos", () => {
    const bloque = espejo.slice(espejo.indexOf("export function claveNatural"));
    for (const campo of ["tenantId", "bankAccountId", "date", "toFixed(2)", "normalizarDescripcion"]) {
      expect(bloque, `la clave natural del espejo perdió ${campo}`).toContain(campo);
    }
  });

  it("R6 · el catálogo de motivos del espejo no inventa códigos que el servidor rechazaría", () => {
    const codigos = [...espejo.matchAll(/codigo: "([a-z_]+)"/g)].map((m) => m[1]);
    expect(codigos.length, "no encontré ningún motivo en el espejo").toBeGreaterThan(3);
    for (const c of codigos) {
      expect(MOTIVOS as readonly string[], `el espejo ofrece «${c}», que el servidor no acepta`).toContain(c);
    }
  });

  it("R5 · el id derivado sale igual en los dos — comprobado con el valor, no leyendo", () => {
    // Las dos partes calculan este id por su cuenta (`node:crypto` en el
    // servidor, Web Crypto en el navegador) y **tienen que coincidir**, o
    // reimportar un extracto crearía documentos nuevos en vez de reconocerlos.
    // El mismo literal está afirmado en `tests/conciliacion-reglas.test.ts`.
    const id = idDeLinea({
      tenantId: "tenant-santa-maria",
      bankAccountId: "7TY7nFs1sVzOm1S1ISwI",
      date: "2026-06-08",
      amount: -300000,
      description: "Mantenimiento bomba de agua",
    });
    expect(id).toBe("bsl_936552b9a7d451c6c42a2d009ea1b16e");
    expect(espejo).toContain('"SHA-256"');
    expect(espejo).toContain("bsl_");
  });
});
